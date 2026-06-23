// POST /api/profile/refresh
// Re-roda diagnostico com Profile.rawCv armazenado + targetRole atual.
// Opcionalmente aplica skills de microacoes concluidas ao perfilJson antes
// do recalculo (user marcou ações como feitas e quer cristalizar no score).
//
// UX: evita que o user precise re-colar o CV pra refazer o diagnóstico.
// Reusa o rawCv já persistido (TTL 90 dias) — se expirou (rawCvRedactedAt
// preenchido pelo cron de redact-cv), retorna 400 com redirectTo /.
//
// Defesas (vide skill seguranca-careertwin):
//  - auth() na rota (defense in depth com middleware)
//  - userId vem SEMPRE da sessão, nunca do body (anti IDOR)
//  - rate limit por userId (mesmo bucket de /api/analyze)
//  - enforceUsage atômico (consome cota Free, fix TOCTOU)
//  - body validado por schema strict() (campos extras rejeitados)
//  - LLM tratada como entrada não-confiável (DiagShape.safeParse no retorno)
//  - audit log PROFILE_UPDATED com meta sanitizado (sem PII raw)

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { promptDiag } from "@/lib/prompts";
import { DiagShape } from "@/lib/validators";
import { computeAllSubScores } from "@/lib/scoring/subscores";
import { searchJobs } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { enforceUsage, trackTokenUsage, checkDailyBudget } from "@/lib/billing/enforce";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { grantAchievement } from "@/lib/achievements";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cap razoável pra skills agregadas. Mesmo limite usado em outras rotas (~30
// skills cobre Lead com folga; mais que isso é ruído pro scoring).
const SKILLS_CAP = 30;

// Body schema: apenas applyCompletedSkills opcional. strict() rejeita extras
// (anti social-engineering via campos como userId, perfil, etc).
const RefreshBody = z
  .object({
    applyCompletedSkills: z.boolean().optional(),
  })
  .strict();

// Fallbacks textuais quando a LLM nao devolve explicacao (mesmo padrao do analyze).
const FALLBACK_EXPL = {
  aderencia_vagas:
    "Aderencia calculada pelo cruzamento entre as skills do seu perfil e as skills mais pedidas nas vagas pesquisadas. [Mercado]",
  relevancia_habilidades:
    "Reflete quantas skills voce declarou, se sao reconhecidas pela taxonomia e quao diversas sao. [Curriculo]",
  otimizacao_perfil:
    "Mede quantos campos do seu perfil estao preenchidos (CV, cargo-alvo, skills, LinkedIn, GitHub etc). [Curriculo]",
  experiencia_mercado:
    "Estima anos de experiencia a partir das datas do CV e compara senioridade declarada com o cargo-alvo. [Curriculo]",
};

function pickExplicacao(llmText, key) {
  const s = String(llmText || "").trim();
  return s.length > 0 ? s : FALLBACK_EXPL[key];
}

async function handler(req) {
  // 1) Sessao obrigatoria. userId NUNCA vem do body — anti IDOR.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Faça login para atualizar seu diagnóstico.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  // 2) Rate limit (mesmo bucket de /api/analyze — refresh é equivalente em custo LLM).
  const limit = await guardLLM(req, {
    name: "analyze",
    userId,
    perMinuteUser: 10,
    perMinuteAnon: 0,
  });
  if (!limit.ok) return tooMany(limit);

  // 3) Enforcement de plano (atomico — incrementa só se passar).
  const enforce = await enforceUsage(userId, "analyze");
  if (!enforce.ok) {
    return NextResponse.json(
      {
        error: "Você atingiu o limite do plano Free (3 diagnósticos/mês). Faça upgrade pra Pro.",
        code: "LIMIT_REACHED",
        feature: "analyze",
        plan: enforce.plan,
        limit: enforce.limit,
        upgradeUrl: "/precos",
      },
      { status: 402 }
    );
  }
  const userPlan = enforce.plan;

  // 3.5) Pre-check budget diario (cost amplification defense — Wave 11).
  const budget = await checkDailyBudget(userId, userPlan);
  if (!budget.ok) {
    await audit({
      userId,
      action: "SECURITY_BUDGET_EXCEEDED",
      target: `User:${userId}`,
      req,
      meta: { feature: "analyze", route: "profile.refresh", used: budget.used, cap: budget.cap },
    });
    return NextResponse.json(
      {
        error: "Você atingiu o limite diário de uso de IA. Volte amanhã ou faça upgrade.",
        code: "BUDGET_EXCEEDED",
        used: budget.used,
        cap: budget.cap,
        upgradeUrl: "/precos",
      },
      { status: 402 }
    );
  }

  // 4) Body opcional. Tolera vazio (default applyCompletedSkills=false).
  let rawBody = {};
  try {
    rawBody = await req.json();
  } catch {
    // body vazio é válido — usa defaults.
  }
  const parsed = RefreshBody.safeParse(rawBody || {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const applyCompletedSkills = parsed.data.applyCompletedSkills === true;

  // 5) Carrega Profile com escopo de dono (userId do auth, não do body).
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      rawCv: true,
      rawCvRedactedAt: true,
      targetRole: true,
      perfilJson: true,
      skills: true,
      nome: true,
      cargoAtual: true,
      senioridade: true,
    },
  });

  // rawCv pode ter sido apagado pelo cron de redact-cv (TTL 90 dias).
  // rawCvRedactedAt sinaliza isso — UX dedicada pra esse caso.
  if (!profile?.rawCv || profile.rawCvRedactedAt) {
    return NextResponse.json(
      {
        error:
          "Seu CV não está mais armazenado (TTL de 90 dias por LGPD). Cole de novo na home pra continuar.",
        code: "NO_RAW_CV",
        redirectTo: "/",
      },
      { status: 400 }
    );
  }
  if (!profile.targetRole) {
    return NextResponse.json(
      {
        error: "Defina seu cargo-alvo em /conta primeiro.",
        code: "NO_TARGET_ROLE",
        redirectTo: "/conta",
      },
      { status: 400 }
    );
  }

  // 6) Snapshot anterior (pra delta + skills concluídas, se applyCompletedSkills).
  //    findFirst com userId no WHERE — anti IDOR redundante (a sessão já escopa).
  const previousSnapshot = await prisma.scoreSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { gaps: true },
  });

  // 7) Se aplicar skills, agrega habilidades de gaps concluídas ao perfil
  //    + coleta impactoPontos pra aplicar como bonus deterministico nos
  //    sub-scores (cap pra prevenir gaming). Skills armazenadas só após user
  //    explicitar consentimento na UI (modal "Aplicar conquistas?").
  //    Sem applyCompletedSkills, perfilJson fica intacto e nenhum bonus aplicado.
  //
  //    Bug fix: gaps antigos podem nao ter impactoDimensao/impactoPontos (LLM
  //    nao retornava esses campos consistentemente em versoes anteriores).
  //    Defaults: 5 pts em relevancia_habilidades (skill adicionada = mais
  //    relevancia). Sem isso, user marca done -> score nao sobe -> loop infinito.
  const DEFAULT_BONUS_PTS = 5;
  const DEFAULT_BONUS_DIM = "relevancia_habilidades";
  const VALID_DIMENSIONS = new Set([
    "aderencia_vagas",
    "relevancia_habilidades",
    "otimizacao_perfil",
    "experiencia_mercado",
  ]);
  let appliedSkills = [];
  let mergedSkills = Array.isArray(profile.skills) ? [...profile.skills] : [];
  let completedHabilidades = []; // pra passar pro LLM (evita loop)
  let projectedGains = {
    aderencia_vagas: 0,
    relevancia_habilidades: 0,
    otimizacao_perfil: 0,
    experiencia_mercado: 0,
  };
  let completedGapsDebug = []; // so usado se DEBUG_REFRESH ativo
  if (applyCompletedSkills && previousSnapshot) {
    const completed = previousSnapshot.gaps.filter((g) => g.completedAt);
    const existing = new Set(mergedSkills.map((s) => String(s).toLowerCase()));
    for (const g of completed) {
      const skill = String(g.habilidade || "").trim();
      if (!skill) continue;
      completedHabilidades.push(skill);
      const lc = skill.toLowerCase();
      if (!existing.has(lc)) {
        appliedSkills.push(skill);
        existing.add(lc);
        mergedSkills.push(skill);
      }
      // Acumula projected gain por dimensao (cap 15 pts por sub-score)
      // Defaults: se gap nao tem impactoDimensao/impactoPontos (snapshots
      // antigos), assume DEFAULT_BONUS_DIM + DEFAULT_BONUS_PTS. Garante que
      // QUALQUER gap concluida contribui pro score (fix do bug do loop).
      const dim = VALID_DIMENSIONS.has(g.impactoDimensao) ? g.impactoDimensao : DEFAULT_BONUS_DIM;
      const pts = Number.isFinite(g.impactoPontos) && g.impactoPontos > 0
        ? g.impactoPontos
        : DEFAULT_BONUS_PTS;
      projectedGains[dim] = Math.min(15, projectedGains[dim] + pts);
      completedGapsDebug.push({
        hab: skill,
        dim,
        pts,
        ptsFromLLM: g.impactoPontos,
        dimFromLLM: g.impactoDimensao,
      });
    }
    if (mergedSkills.length > SKILLS_CAP) {
      mergedSkills = mergedSkills.slice(0, SKILLS_CAP);
    }
  }

  // Logging diagnostico opt-in via DEBUG_REFRESH=1. Sem isso, log normal
  // nao mostra esses dados (LGPD: habilidades podem ser PII fraca).
  if (process.env.DEBUG_REFRESH === "1") {
    console.log("[refresh] completedGaps:", JSON.stringify(completedGapsDebug));
    console.log("[refresh] projectedGains:", JSON.stringify(projectedGains));
  }

  // 8) LLM: re-extrai perfil + explicações + gaps a partir do mesmo CV.
  //    Conteúdo tratado como dado opaco no prompt (delimitado por """).
  //    DiagShape valida o shape antes de usar (saída do LLM = não-confiável).
  const cv = profile.rawCv;
  const role = profile.targetRole;

  let llmDiag;
  let llmUsage = null; // Wave 11: capturado pra trackTokenUsage
  try {
    // Passa completedHabilidades pro LLM evitar repetir as mesmas microacoes
    // (loop "marca done -> volta mesma sugestao -> marca de novo").
    const { result: raw, usage } = await completeJSONWithUsage(
      await promptDiag(role.trim(), cv.trim(), completedHabilidades),
      {
        route: "profile.refresh",
        userId,
      }
    );
    llmUsage = usage;
    const valid = DiagShape.safeParse(raw);
    if (!valid.success) {
      console.error("profile.refresh: LLM shape inválido");
      // Tokens ja gastos — track antes do 502.
      if (llmUsage) await trackTokenUsage(userId, "analyze", llmUsage);
      return NextResponse.json(
        {
          error: "A IA devolveu resposta em formato inesperado. Tente novamente em alguns segundos.",
          code: "LLM_INVALID",
        },
        { status: 502 }
      );
    }
    llmDiag = valid.data;
  } catch (e) {
    // Nao vazar detalhes ao cliente. Detalhe so no log do servidor.
    console.error("profile.refresh: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu analisar agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }

  // Token tracking + post-budget audit (Wave 11). Falha silenciosa.
  if (llmUsage) {
    await trackTokenUsage(userId, "analyze", llmUsage);
    try {
      const budgetAfter = await checkDailyBudget(userId, userPlan);
      if (!budgetAfter.ok) {
        await audit({
          userId,
          action: "SECURITY_BUDGET_EXCEEDED",
          target: `User:${userId}`,
          req,
          meta: {
            feature: "analyze",
            route: "profile.refresh",
            used: budgetAfter.used,
            cap: budgetAfter.cap,
            phase: "post-llm",
          },
        });
      }
    } catch (e) {
      console.error("profile.refresh: post-budget check falhou", e?.message);
    }
  }

  // 9) Busca vagas (falha graceful — score continua valido com 0 vagas).
  let jobsForScore = [];
  try {
    const r = await searchJobs({ role: role.trim(), location: "Brasil", limit: 50 });
    jobsForScore = r.jobs || [];
  } catch (e) {
    console.error("profile.refresh: searchJobs falhou", e?.message);
  }

  // 10) Monta profile sintético pro cálculo determinístico.
  //     Se applyCompletedSkills, mescla as skills aplicadas com as extraídas pelo LLM.
  //     Caso contrário, usa apenas o que veio do LLM (mesmo padrão de /api/analyze).
  const llmSkills = Array.isArray(llmDiag.perfil.skills) ? llmDiag.perfil.skills : [];
  let finalSkills;
  if (applyCompletedSkills) {
    // Une skills aplicadas + LLM, dedup case-insensitive, cap.
    const seen = new Set();
    finalSkills = [];
    for (const s of [...mergedSkills, ...llmSkills]) {
      const t = String(s || "").trim();
      if (!t) continue;
      const lc = t.toLowerCase();
      if (seen.has(lc)) continue;
      seen.add(lc);
      finalSkills.push(t);
      if (finalSkills.length >= SKILLS_CAP) break;
    }
  } else {
    finalSkills = llmSkills;
  }

  const syntheticProfile = {
    nome: llmDiag.perfil.nome || profile.nome || null,
    cargoAtual: llmDiag.perfil.cargo_atual || profile.cargoAtual || null,
    senioridade: llmDiag.perfil.senioridade || profile.senioridade || null,
    targetRole: role,
    skills: finalSkills,
    rawCv: cv,
  };

  // 11) Score determinístico — mesma função usada em /api/analyze.
  //     Quando applyCompletedSkills, aplica projectedGains como bonus aos
  //     sub-scores correspondentes (capado a 15 pts por dimensao, 25 total).
  //     Sem isso, o score NUNCA subia (loop infinito do user).
  //
  //     Cap total subiu de 20 -> 25 pra dar movimento visivel quando user
  //     conclui 3-4 microacoes. Cap de 15 por dimensao mantido (previne abuso).
  //     Recalculo do overall *sempre* roda quando applyCompletedSkills=true e
  //     houve bonus, mesmo que LLM tenha re-extraido skills levemente diferentes
  //     (que faz o overall base oscilar e mascarava o ganho real do bonus).
  const computed = computeAllSubScores(syntheticProfile, role, jobsForScore);

  if (process.env.DEBUG_REFRESH === "1") {
    console.log("[refresh] sub_scores antes do bonus:", JSON.stringify(computed.sub_scores));
    console.log("[refresh] overall antes do bonus:", computed.overall);
  }

  if (applyCompletedSkills) {
    let totalBonus = 0;
    const MAX_TOTAL_BONUS = 25;
    // Ordem deterministica de aplicacao: dimensoes com maior gain primeiro,
    // pra cap nao prejudicar arbitrariamente a dimensao com mais conquistas.
    const orderedDims = Object.keys(projectedGains).sort(
      (a, b) => (projectedGains[b] || 0) - (projectedGains[a] || 0),
    );
    for (const dim of orderedDims) {
      const gain = projectedGains[dim] || 0;
      if (gain <= 0) continue;
      const remaining = Math.max(0, MAX_TOTAL_BONUS - totalBonus);
      const applied = Math.min(gain, remaining);
      if (applied > 0 && computed.sub_scores[dim]) {
        const newValor = Math.min(100, computed.sub_scores[dim].valor + applied);
        computed.sub_scores[dim].valor = newValor;
        totalBonus += applied;
      }
    }
    // So recalcula overall se houve bonus aplicado real. Sem isso, mantem
    // o overall original do computeAllSubScores (evita drift de arredondamento).
    if (totalBonus > 0) {
      computed.overall = Math.round(
        computed.sub_scores.aderencia_vagas.valor * 0.4 +
          computed.sub_scores.relevancia_habilidades.valor * 0.3 +
          computed.sub_scores.otimizacao_perfil.valor * 0.2 +
          computed.sub_scores.experiencia_mercado.valor * 0.1,
      );
    }
    if (process.env.DEBUG_REFRESH === "1") {
      console.log("[refresh] totalBonus aplicado:", totalBonus);
      console.log("[refresh] sub_scores depois do bonus:", JSON.stringify(computed.sub_scores));
      console.log("[refresh] overall depois do bonus:", computed.overall);
    }
  }

  const overall = computed.overall;

  // 12) Merge: números do código + explicações do LLM (com fallback).
  const sub_scores = {
    aderencia_vagas: {
      valor: computed.sub_scores.aderencia_vagas.valor,
      explicacao: pickExplicacao(llmDiag.sub_scores_explicacoes?.aderencia_vagas, "aderencia_vagas"),
      _meta: computed.sub_scores.aderencia_vagas._meta,
    },
    relevancia_habilidades: {
      valor: computed.sub_scores.relevancia_habilidades.valor,
      explicacao: pickExplicacao(
        llmDiag.sub_scores_explicacoes?.relevancia_habilidades,
        "relevancia_habilidades"
      ),
      _meta: computed.sub_scores.relevancia_habilidades._meta,
    },
    otimizacao_perfil: {
      valor: computed.sub_scores.otimizacao_perfil.valor,
      explicacao: pickExplicacao(
        llmDiag.sub_scores_explicacoes?.otimizacao_perfil,
        "otimizacao_perfil"
      ),
      _meta: computed.sub_scores.otimizacao_perfil._meta,
    },
    experiencia_mercado: {
      valor: computed.sub_scores.experiencia_mercado.valor,
      explicacao: pickExplicacao(
        llmDiag.sub_scores_explicacoes?.experiencia_mercado,
        "experiencia_mercado"
      ),
      _meta: computed.sub_scores.experiencia_mercado._meta,
    },
  };

  // 13) Persiste num único $transaction:
  //      - Profile.update (se applyCompletedSkills mudou as skills)
  //      - ScoreSnapshot.create
  //      - Gap.createMany (vinculado ao snapshot novo)
  //
  //     Tudo escopado por userId (sem IDOR). Falha total da transaction => 500 limpo.
  let snapshot;
  try {
    snapshot = await prisma.$transaction(async (tx) => {
      // Atualiza skills no Profile se aplicou conquistas (e perfilJson p/ refletir).
      // perfilJson recebe shape minimo compativel — UI lê skills do campo Profile.skills.
      if (applyCompletedSkills && appliedSkills.length > 0) {
        const updatedPerfilJson = {
          ...(profile.perfilJson && typeof profile.perfilJson === "object"
            ? profile.perfilJson
            : {}),
          skills: finalSkills,
        };
        await tx.profile.update({
          where: { userId },
          data: {
            skills: finalSkills,
            perfilJson: updatedPerfilJson,
          },
        });
      }

      const snap = await tx.scoreSnapshot.create({
        data: {
          userId,
          role,
          overall,
          subScores: sub_scores,
          perfilJson: llmDiag.perfil,
          gaps: {
            create: (llmDiag.gaps || []).map((g) => ({
              habilidade: g.habilidade,
              frequencia: g.frequencia || null,
              porque: g.porque || null,
              microacao: g.microacao || null,
              impactoDimensao: g.impacto?.dimensao || null,
              impactoPontos: g.impacto?.pontos ?? null,
            })),
          },
        },
        include: { gaps: true },
      });

      return snap;
    });
  } catch (e) {
    console.error("profile.refresh: persistência falhou", e?.message);
    return NextResponse.json(
      {
        error: "Tudo certo com a análise, mas não consegui salvar agora. Tente de novo.",
        code: "PERSIST_FAILED",
      },
      { status: 500 }
    );
  }

  const previousOverall = previousSnapshot?.overall ?? 0;
  const delta = overall - previousOverall;

  // 14) Audit log — meta sanitizado (sem PII raw, só metadados).
  //     Ação PROFILE_UPDATED cobre tanto o snapshot novo quanto a mudança
  //     opcional de skills no Profile.
  await audit({
    userId,
    action: "PROFILE_UPDATED",
    target: `ScoreSnapshot:${snapshot.id}`,
    req,
    meta: {
      reason: "refresh_diagnosis",
      previousOverall,
      newOverall: overall,
      delta,
      appliedSkillsCount: appliedSkills.length,
      applyCompletedSkills,
    },
  });

  // 15) Achievements: FIRST_REFRESH + tiers SCORE_70/80/90 quando o novo
  // overall cruza os thresholds. Idempotentes via unique constraint.
  // Falhas sao silenciosas — diagnostico ja foi persistido.
  try {
    await grantAchievement(userId, "FIRST_REFRESH", { snapshotId: snapshot.id });
    if (overall >= 70) {
      await grantAchievement(userId, "SCORE_70", { overall, snapshotId: snapshot.id });
    }
    if (overall >= 80) {
      await grantAchievement(userId, "SCORE_80", { overall, snapshotId: snapshot.id });
    }
    if (overall >= 90) {
      await grantAchievement(userId, "SCORE_90", { overall, snapshotId: snapshot.id });
    }
  } catch (e) {
    console.error("profile.refresh: achievements falhou", e?.message);
  }

  return NextResponse.json({
    ok: true,
    snapshotId: snapshot.id,
    score: overall,
    previousScore: previousOverall,
    delta,
    appliedSkills,
  });
}

export const POST = withApiGuard(handler);
