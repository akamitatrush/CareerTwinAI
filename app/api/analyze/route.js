import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { promptDiag } from "@/lib/prompts";
import { AnalyzeBody, DiagShape } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { searchJobs } from "@/lib/jobs";
import { computeAllSubScores } from "@/lib/scoring/subscores";
import { notify, NotificationTemplates } from "@/lib/notifications";
import { enforceUsage, trackTokenUsage, checkDailyBudget } from "@/lib/billing/enforce";
import { audit } from "@/lib/audit";
import { grantAchievement } from "@/lib/achievements";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TTL de 90 dias pro rawCv. LGPD principle of storage limitation. Cron diario
// (/api/cron/redact-cv) apaga rawCv/linkedinRaw quando expira.
const RAW_CV_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// Fallbacks textuais quando a LLM nao devolve a explicacao (ou devolve vazia).
// Sao genericos de proposito — UI ainda renderiza o numero (que e o cabeca).
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

// === Resultado de erro do core() em forma de "envelope". Tanto o branch JSON
// quanto o branch SSE precisam serializar pra um shape padrao:
//  - { kind: "json", status, body } => resposta HTTP normal
//  - { kind: "ok", payload } => sucesso
// O wrapper de cada branch decide como entregar.
function jsonError(status, body) {
  return { kind: "json", status, body };
}
function okPayload(payload) {
  return { kind: "ok", payload };
}

/**
 * Core do /api/analyze. Stateless, recebe um `emit` opcional pra emitir steps
 * de progresso (usado pelo branch SSE; no JSON branch e um no-op). Retorna
 * envelope padronizado pra ambos os branches.
 *
 * Otimizacao chave: LLM + searchJobs rodam em PARALELO via Promise.allSettled.
 * searchJobs nao precisa do output do LLM — so do role. Reduz tempo total
 * de ~18s (15s LLM + 3s jobs sequencial) pra ~15s (max do paralelo).
 */
async function core(req, emit = () => {}) {
  // Sessao opcional: logado → persiste com escopo de dono; anonimo → efemero.
  // Nao ha IDOR aqui: persistencia so acontece quando userId vem de auth().
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = await guardLLM(req, { name: "analyze", userId, perMinuteAnon: 3, perMinuteUser: 10 });
  if (!limit.ok) {
    // Retorna a Response direta pra preservar headers de rate-limit
    return { kind: "raw", response: tooMany(limit) };
  }

  // Enforcement de plano (apenas pra logados; anonimos rodam efemero e ja
  // sao rate-limited mais agressivamente acima). 402 Payment Required.
  // enforceUsage AGORA INCREMENTA ATOMICAMENTE — nao chamar trackUsage depois.
  let userPlan = null;
  if (userId) {
    const lim = await enforceUsage(userId, "analyze");
    if (!lim.ok) {
      return jsonError(402, {
        error: "Voce atingiu o limite do plano Free (3 diagnosticos/mes). Faca upgrade pra Pro.",
        code: "LIMIT_REACHED",
        feature: "analyze",
        plan: lim.plan,
        limit: lim.limit,
        upgradeUrl: "/precos",
      });
    }
    // Pre-check de budget diario (cost amplification defense). Mesmo passando
    // no enforceUsage (count nao bateu o limite mensal), o custo agregado USD
    // de TODAS as features do user pode estar acima do cap diario do plano —
    // atacante tentando rodar LLM em loop pra esgotar API budget. 402 antes
    // do LLM rodar = $0 gasto. Reutilizamos planId em trackTokenUsage abaixo.
    userPlan = lim.plan;
    const budget = await checkDailyBudget(userId, userPlan);
    if (!budget.ok) {
      await audit({
        userId,
        action: "SECURITY_BUDGET_EXCEEDED",
        target: `User:${userId}`,
        req,
        meta: { feature: "analyze", used: budget.used, cap: budget.cap },
      });
      return jsonError(402, {
        error: "Voce atingiu o limite diario de uso de IA. Volte amanha ou faca upgrade.",
        code: "BUDGET_EXCEEDED",
        used: budget.used,
        cap: budget.cap,
        upgradeUrl: "/precos",
      });
    }
  }

  emit({ type: "step", step: "validating" });

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, {
      error: "Não consegui entender o que foi enviado. Tente de novo.",
      code: "BAD_JSON",
    });
  }
  const parsed = AnalyzeBody.safeParse(body);
  if (!parsed.success) {
    // Mensagem específica por campo, sem expor o schema todo.
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    const cv = typeof body?.cv === "string" ? body.cv : "";
    if (!role) {
      return jsonError(400, {
        error: "Diga qual cargo você quer (campo cargo-alvo).",
        code: "ROLE_REQUIRED",
      });
    }
    if (cv.trim().length < 60) {
      return jsonError(400, {
        error: "Seu currículo está muito curto. Cole pelo menos um parágrafo com experiências e habilidades.",
        code: "CV_TOO_SHORT",
      });
    }
    if (cv.length > 40_000) {
      return jsonError(400, {
        error: "Seu currículo passou do limite de 40 mil caracteres. Resuma para os trechos mais relevantes.",
        code: "CV_TOO_LONG",
      });
    }
    return jsonError(400, {
      error: "Faltam dados ou algum campo está em formato inválido. Confira currículo e cargo-alvo.",
      code: "INVALID_INPUT",
    });
  }
  const { cv, role } = parsed.data;

  // 1+2) LLM (extrai perfil + escreve explicacoes + lista lacunas) E searchJobs
  // rodam EM PARALELO. searchJobs so precisa do role, NAO do output do LLM.
  // Antes era serial (~18s); agora ~15s — economia de 3s percebidos.
  // Promise.allSettled pra que falha de jobs nao mate o LLM e vice-versa
  // (jobs degrada graciosamente; LLM precisa ser tratado caso a caso).
  emit({ type: "step", step: "llm_jobs_parallel" });

  const prompt = await promptDiag(role.trim(), cv.trim());
  const [llmSettled, jobsSettled] = await Promise.allSettled([
    // Skip cache: diagnostico user-specific. Mesmo CV+role no mesmo dia deve
    // gerar snapshot novo com explicacao fresca (e o que o user espera ao
    // pedir "re-rodar"). Cache pouparia tokens mas mascara analise estale.
    completeJSONWithUsage(prompt, { route: "analyze", userId, cache: false }),
    searchJobs({ role: role.trim(), location: "Brasil", limit: 50 }),
  ]);

  // jobsSettled: degrada gracioso. Falha nao quebra o diagnostico — score de
  // aderencia ainda computa com array vazio (jogando o valor pra baixo).
  let jobsPayload = { jobs: [], sources: [] };
  if (jobsSettled.status === "fulfilled" && jobsSettled.value) {
    jobsPayload = jobsSettled.value;
  } else if (jobsSettled.status === "rejected") {
    console.error("analyze: searchJobs falhou", jobsSettled.reason?.message);
  }

  // llmSettled: critico — precisamos do perfil pra gerar resultado. Trata
  // erro com mesma logica do path serial original.
  let diag;
  let llmUsage = null; // capturado pra trackTokenUsage depois do persist
  if (llmSettled.status === "rejected") {
    console.error("analyze: LLM falhou", llmSettled.reason?.message);
    // LLM rejeitou antes de responder => sem tokens cobrados, nada a track.
    return jsonError(502, {
      error: "A IA não conseguiu analisar agora. Tente novamente em alguns segundos — se persistir, o currículo pode estar muito longo ou em formato estranho.",
      code: "LLM_FAILED",
    });
  }
  // llmSettled.status === "fulfilled"
  const { result: raw, usage } = llmSettled.value;
  llmUsage = usage;
  const valid = DiagShape.safeParse(raw);
  if (!valid.success) {
    console.error("analyze: LLM shape inválido");
    // Tokens ja foram gastos pelo provider — track agora. Falha silenciosa.
    if (userId && llmUsage) {
      await trackTokenUsage(userId, "analyze", llmUsage);
    }
    return jsonError(502, {
      error: "A IA devolveu uma resposta em formato inesperado. Tente novamente em alguns segundos.",
      code: "LLM_INVALID",
    });
  }
  diag = valid.data;

  // LLM passou: tokens ja foram cobrados pelo provider. Track AGORA pra
  // garantir contagem mesmo se persist abaixo falhar. Falha silenciosa. Em
  // seguida verifica budget pos-uso e dispara audit log se o user passou do
  // cap mesmo apos a chamada (sinal de bypass do pre-check ou cap apertado).
  if (userId && llmUsage) {
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
            used: budgetAfter.used,
            cap: budgetAfter.cap,
            phase: "post-llm",
          },
        });
      }
    } catch (e) {
      console.error("analyze: post-budget check falhou", e?.message);
    }
  }

  // 3) Monta o "profile sintetico" pra alimentar o calculo deterministico.
  //    Mistura o que veio da LLM (skills extraidas do CV) + insumos crus
  //    (rawCv, targetRole). Quem ja tinha profile no DB e logado vai sobrescrever
  //    no step 5 — esse objeto e so pra computar score do snapshot atual.
  emit({ type: "step", step: "computing" });

  const syntheticProfile = {
    nome: diag.perfil.nome || null,
    cargoAtual: diag.perfil.cargo_atual || null,
    senioridade: diag.perfil.senioridade || null,
    targetRole: role,
    skills: diag.perfil.skills || [],
    rawCv: cv,
  };

  // 4) Calculo deterministico dos 4 sub-scores + overall ponderado.
  const computed = computeAllSubScores(syntheticProfile, role, jobsPayload.jobs);

  // 5) Merge: numeros do codigo + explicacoes da LLM. Shape mantido compativel
  //    com ScoreSnapshot.subScores antigo ({ valor, explicacao }) — UI/Report
  //    le os dois campos sem saber quem gerou.
  const sub_scores = {
    aderencia_vagas: {
      valor: computed.sub_scores.aderencia_vagas.valor,
      explicacao: pickExplicacao(diag.sub_scores_explicacoes?.aderencia_vagas, "aderencia_vagas"),
      _meta: computed.sub_scores.aderencia_vagas._meta,
    },
    relevancia_habilidades: {
      valor: computed.sub_scores.relevancia_habilidades.valor,
      explicacao: pickExplicacao(
        diag.sub_scores_explicacoes?.relevancia_habilidades,
        "relevancia_habilidades"
      ),
      _meta: computed.sub_scores.relevancia_habilidades._meta,
    },
    otimizacao_perfil: {
      valor: computed.sub_scores.otimizacao_perfil.valor,
      explicacao: pickExplicacao(
        diag.sub_scores_explicacoes?.otimizacao_perfil,
        "otimizacao_perfil"
      ),
      _meta: computed.sub_scores.otimizacao_perfil._meta,
    },
    experiencia_mercado: {
      valor: computed.sub_scores.experiencia_mercado.valor,
      explicacao: pickExplicacao(
        diag.sub_scores_explicacoes?.experiencia_mercado,
        "experiencia_mercado"
      ),
      _meta: computed.sub_scores.experiencia_mercado._meta,
    },
  };
  const overall = computed.overall;

  // Modo efemero (anonimo): nao persiste, retorna direto.
  if (!userId) {
    return okPayload({
      snapshotId: null,
      perfil: diag.perfil,
      sub_scores,
      gaps: diag.gaps,
      overall,
      efemero: true,
    });
  }

  emit({ type: "step", step: "persisting" });

  // Persistência: profile vigente sobrescrito; snapshot imutável.
  // Tudo escopado por userId vindo da sessão (sem IDOR).
  try {
    // LGPD: rawCv tem TTL de 90 dias. Cron diario apaga depois disso.
    // rawCvRedactedAt resetado pra que o "ciclo" recomece a cada upsert.
    const rawCvExpiresAt = new Date(Date.now() + RAW_CV_TTL_MS);
    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        nome: diag.perfil.nome || null,
        cargoAtual: diag.perfil.cargo_atual || null,
        senioridade: diag.perfil.senioridade || null,
        targetRole: role,
        skills: diag.perfil.skills || [],
        rawCv: cv,
        rawCvExpiresAt,
        rawCvRedactedAt: null,
        perfilJson: diag.perfil,
      },
      update: {
        nome: diag.perfil.nome || null,
        cargoAtual: diag.perfil.cargo_atual || null,
        senioridade: diag.perfil.senioridade || null,
        targetRole: role,
        skills: diag.perfil.skills || [],
        rawCv: cv,
        rawCvExpiresAt,
        rawCvRedactedAt: null,
        perfilJson: diag.perfil,
      },
    });

    const snapshot = await prisma.scoreSnapshot.create({
      data: {
        userId,
        role,
        overall,
        subScores: sub_scores,
        perfilJson: diag.perfil,
        gaps: {
          create: (diag.gaps || []).map((g) => ({
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

    // Notificacao in-app de novo diagnostico. Calcula delta vs snapshot
    // anterior pro corpo da mensagem. Falha silenciosa (helper) — diagnostico
    // ja foi persistido, badge so atualiza no proximo fetch caso falhe.
    let prevSnapshotsCount = 0;
    try {
      prevSnapshotsCount = await prisma.scoreSnapshot.count({
        where: { userId, id: { not: snapshot.id } },
      });
      const prev =
        prevSnapshotsCount > 0
          ? await prisma.scoreSnapshot.findFirst({
              where: { userId, id: { not: snapshot.id } },
              orderBy: { createdAt: "desc" },
              select: { overall: true },
            })
          : null;
      const delta = prev ? snapshot.overall - prev.overall : null;
      await notify({
        userId,
        ...NotificationTemplates.scoreUpdated({
          overall: snapshot.overall,
          delta,
        }),
      });
    } catch (e) {
      console.error("analyze: notify falhou", e?.message);
    }

    // Welcome flow: se esse e o PRIMEIRO snapshot do usuario, marca
    // firstDiagnosisAt no profile e dispara a notificacao WELCOME (uma vez,
    // idempotente). Falhas sao silenciosas — o diagnostico ja esta salvo,
    // welcome e UX nao bloqueante. prevSnapshotsCount === 0 quer dizer que
    // o snapshot que acabamos de criar e o primeiro do user.
    if (prevSnapshotsCount === 0) {
      try {
        await prisma.profile.update({
          where: { userId },
          data: { firstDiagnosisAt: new Date() },
        });
      } catch (e) {
        console.error("analyze: set firstDiagnosisAt falhou", e?.message);
      }
      try {
        const existing = await prisma.notification.count({
          where: { userId, kind: "WELCOME" },
        });
        if (existing === 0) {
          await notify({
            userId,
            ...NotificationTemplates.welcome(),
          });
        }
      } catch (e) {
        console.error("analyze: welcome notify falhou", e?.message);
      }
    }

    // Achievements: grants idempotentes (unique constraint userId+kind).
    // Falhas silenciosas — diagnostico ja foi salvo, conquista e UX bonus.
    // FIRST_DIAGNOSIS so dispara se for o primeiro snapshot real (count zero
    // antes desse). SCORE_70/80/90 conferem o overall — concedem tiers
    // cumulativos (atinge 90 ganha tambem 70 e 80 nas proximas conquistas).
    try {
      if (prevSnapshotsCount === 0) {
        await grantAchievement(userId, "FIRST_DIAGNOSIS", { snapshotId: snapshot.id });
      }
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
      console.error("analyze: achievements falhou", e?.message);
    }

    // Uso ja foi contabilizado atomicamente em enforceUsage no inicio do POST
    // (fix TOCTOU — antes era check + trackUsage com race window). NAO chamar
    // trackUsage aqui senao duplica o count. Token tracking (tokensIn/Out +
    // costUsd) ja foi feito apos completeJSONWithUsage, antes desse persist
    // block, pra garantir contagem mesmo se persist falhar.

    // Rastro LGPD: registra fonte + consentimento (payloadHash prova consent
    // sem reter o bruto se o usuario revogar/apagar).
    const payloadHash = createHash("sha256").update(cv).digest("hex");
    const cvLabel = `Curriculo colado (${(cv.length / 1024).toFixed(1)} KB)`;
    await prisma.$transaction([
      prisma.dataSource.create({
        data: {
          userId,
          kind: "CV_PASTE",
          label: cvLabel,
          sizeBytes: Buffer.byteLength(cv, "utf8"),
        },
      }),
      prisma.consent.create({
        data: { userId, source: "CV_PASTE", payloadHash },
      }),
    ]);

    // Audit upload (paste counts as upload). Meta sanitizado: so metadados.
    await audit({
      userId,
      action: "CV_UPLOADED",
      target: `Profile:${userId}`,
      req,
      meta: { kind: "CV_PASTE", sizeBytes: Buffer.byteLength(cv, "utf8"), snapshotId: snapshot.id },
    });

    return okPayload({
      snapshotId: snapshot.id,
      perfil: diag.perfil,
      sub_scores,
      gaps: diag.gaps,
      overall,
    });
  } catch (e) {
    console.error("analyze: persistencia falhou", e?.message);
    return jsonError(500, {
      error: "Tudo certo com a análise, mas não consegui salvar agora. Atualize a página e tente de novo.",
      code: "PERSIST_FAILED",
    });
  }
}

async function handler(req) {
  // Branch streaming: ?stream=1 retorna SSE com eventos progressivos de step.
  // Sem o param mantem JSON one-shot (back-compat — tests existentes nao quebram).
  // Auth/rate-limit/validacao/billing/persist SAO IDENTICOS — so o transporte
  // muda. Decisao deliberada: o resultado final tem o MESMO shape em ambos os
  // paths (eventos `step` so adicionam visibility durante processamento).
  const url = new URL(req.url);
  const wantsStream = url.searchParams.get("stream") === "1";

  if (wantsStream) {
    // SSE: enviamos eventos {type:"step", step} conforme avanca o pipeline,
    // {type:"result", payload} ao fim. Em erro emitimos {type:"error", error,
    // code, status} e fechamos — cliente trata sem HTTP error porque o status
    // ja foi 200 quando comecou a stream. Isso e por design (SSE spec).
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      async start(controller) {
        function send(event) {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
        try {
          const envelope = await core(req, send);
          if (envelope.kind === "ok") {
            send({ type: "result", payload: envelope.payload });
            send({ type: "done" });
          } else if (envelope.kind === "json") {
            // Erro estruturado (validacao, billing, LLM_FAILED, etc) — emite
            // como event {type:"error"} com os mesmos fields da JSON response
            // pra cliente poder mostrar a mesma mensagem amigavel.
            send({
              type: "error",
              status: envelope.status,
              ...envelope.body,
            });
          } else if (envelope.kind === "raw") {
            // Edge case: rate-limit/tooMany retornou Response direta. No
            // contexto SSE precisamos serializar — extrai status + body.
            const status = envelope.response.status;
            let payload = {};
            try {
              payload = await envelope.response.clone().json();
            } catch {}
            send({ type: "error", status, ...payload });
          }
        } catch (e) {
          // Erro inesperado — protege client de receber stream "morto".
          console.error("analyze: stream falhou", e?.message);
          send({
            type: "error",
            status: 500,
            error: "Encontramos um problema no servidor. Tente de novo.",
            code: "SERVER_ERROR",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
        // Anti-buffering por proxies (nginx). Garante chunks chegarem ao vivo.
        "x-accel-buffering": "no",
      },
    });
  }

  // Path JSON tradicional (back-compat). Roda core() sem emit progress.
  const envelope = await core(req);
  if (envelope.kind === "raw") return envelope.response;
  if (envelope.kind === "json") {
    return NextResponse.json(envelope.body, { status: envelope.status });
  }
  return NextResponse.json(envelope.payload);
}

export const POST = withApiGuard(handler);
