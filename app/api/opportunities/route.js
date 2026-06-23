import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptOpp, promptOppReal, promptPlano } from "@/lib/prompts";
import { OppBody, OppShape, PorquesShape, PlanoShape } from "@/lib/validators";
import { searchJobs } from "@/lib/jobs";
import { extractSkills, matchScore } from "@/lib/skills-taxonomy";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_LABEL = {
  adzuna: "Adzuna",
  jooble: "Jooble",
  greenhouse: "Greenhouse",
  fixtures: "Ilustrativo",
};

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = guardLLM(req, { name: "opp", userId, perMinuteAnon: 3, perMinuteUser: 10 });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Não consegui entender o que foi enviado. Tente de novo.", code: "BAD_JSON" },
      { status: 400 }
    );
  }
  const parsed = OppBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de busca de vagas inválidos. Recarregue a página e tente de novo.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const {
    snapshotId,
    role: roleIn,
    perfil: perfilIn,
    gaps: gapsIn,
    seniority: senIn,
    model: modIn,
    minMatch: minMatchIn,
  } = parsed.data;

  // Filtros vem do body (UI nova) ou da querystring (legado/GET-like). Body manda.
  const url = new URL(req.url);
  const seniority = String(senIn ?? url.searchParams.get("seniority") ?? "").trim();
  const model = String(modIn ?? url.searchParams.get("model") ?? "").trim();
  const minMatchRaw = minMatchIn ?? url.searchParams.get("minMatch");
  const minMatch = Math.max(0, Math.min(100, Number(minMatchRaw) || 0));

  let snapshot = null;
  if (snapshotId && userId) {
    snapshot = await prisma.scoreSnapshot.findFirst({
      where: { id: snapshotId, userId },
      include: { gaps: true },
    });
    if (!snapshot) {
      return NextResponse.json(
        { error: "Não encontrei esse diagnóstico no seu histórico.", code: "SNAPSHOT_NOT_FOUND" },
        { status: 404 }
      );
    }
  }

  const role = snapshot?.role || roleIn;
  const perfil = snapshot?.perfilJson || perfilIn;
  const gaps = snapshot ? snapshot.gaps.map((g) => g.habilidade) : gapsIn || [];
  if (!role || !perfil) {
    return NextResponse.json(
      {
        error: "Faltou seu cargo-alvo ou o perfil. Faça um diagnóstico em /meu-gemeo antes de buscar vagas.",
        code: "PROFILE_REQUIRED",
      },
      { status: 400 }
    );
  }

  const profileSkills = Array.isArray(perfil.skills) ? perfil.skills : [];

  // Busca vagas reais (ou fixtures se sem chave); match e falta calculados em codigo.
  // limit=24 (era 5) pra alimentar a UI nova com lista expandida.
  let payloadJobs = { jobs: [], sources: [] };
  try {
    payloadJobs = await searchJobs({ role, location: "Brasil", limit: 24 });
  } catch (e) {
    console.error("jobs busca falhou:", e?.message);
  }
  const enriched = payloadJobs.jobs.map((j) => {
    const jobSkills = extractSkills(`${j.titulo} ${j.descricao}`);
    const { match, comuns, falta } = matchScore({ profileSkills, jobSkills });
    return { ...j, comuns, falta: falta.slice(0, 3), match };
  });
  // Filtra vagas com match=0 — "0% match" exibido no mesmo pill verde-limão
  // dos matches altos confunde o usuario e parece bug. Se sobrar zero apos
  // o filtro, o fluxo "nenhuma vaga voltou" do componente Report cuida.
  let withMatch = enriched.filter((j) => j.match > 0);

  // Defesa contra "tela vazia": se NENHUMA vaga passou no filtro de match>0
  // mas ha vagas enriquecidas, mostramos todas mesmo assim. Cobre o caso de
  // fixtures com descricao pobre em skills (regressao historica) ou de perfis
  // muito desalinhados — sempre melhor mostrar algo do que zero resultado.
  if (withMatch.length === 0 && enriched.length > 0) {
    withMatch = enriched;
  }

  // ---- Filtros opcionais (UI nova) ----------------------------------------
  // Senioridade: bate no titulo (case + acentos normalizados). Aceita
  // "Junior"/"Pleno"/"Senior" + variacoes comuns em vagas BR. "" = qualquer.
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  if (seniority) {
    const sNorm = norm(seniority);
    const aliases = {
      junior: ["junior", "jr", "trainee"],
      pleno: ["pleno", "mid", "mid-level", "mid level"],
      senior: ["senior", "sr", "lead", "principal", "staff"],
    };
    const target = aliases[sNorm] || [sNorm];
    withMatch = withMatch.filter((j) => {
      const t = norm(j.titulo);
      return target.some((a) => t.includes(a));
    });
  }
  // Modelo: bate no titulo + descricao. "" = qualquer.
  if (model) {
    const mNorm = norm(model);
    const aliases = {
      remoto: ["remoto", "remote", "home office", "home-office"],
      hibrido: ["hibrido", "hybrid"],
      presencial: ["presencial", "on-site", "on site", "onsite"],
    };
    const target = aliases[mNorm] || [mNorm];
    withMatch = withMatch.filter((j) => {
      const t = norm(`${j.titulo} ${j.descricao || ""} ${j.local || ""}`);
      return target.some((a) => t.includes(a));
    });
  }
  // Match minimo: default 0 (sem filtro). UI envia 0-100.
  if (minMatch > 0) {
    withMatch = withMatch.filter((j) => j.match >= minMatch);
  }
  // -------------------------------------------------------------------------

  withMatch.sort((a, b) => b.match - a.match);
  // Lista completa pra UI (ate 24). LLM so processa as 5 primeiras pra
  // controlar custo — ver bloco de enriquecimento abaixo.
  const top = withMatch.slice(0, 24);
  const topForLLM = top.slice(0, 5);

  // Se todas as vagas exibidas sao fixtures, marcamos a resposta como ilustrativa.
  const allIllustrative = top.length > 0 && top.every((j) => j.source === "fixtures");

  // LLM justifica cada vaga (sem mexer em numero) — so para vagas REAIS.
  // Para fixtures (ja somos os autores), caimos no fluxo antigo (promptOpp).
  //
  // CUSTO: o LLM so processa as top 5 (topForLLM). As demais 19 (se houver)
  // saem com porque determinitistico baseado nas skills comuns. Isso evita
  // estourar prompt budget — antes processavamos 3, agora 5 (custo ~+66%).
  let vagasOut;
  if (top.length > 0 && !allIllustrative) {
    // Helper: porque determinitistico — usado pras vagas fora do top 5 e como
    // fallback quando o LLM falha.
    const porqueFallback = (j) =>
      `Voce cobre ${(j.comuns || []).length} requisitos chave (${
        (j.comuns || []).slice(0, 3).join(", ") || "—"
      }). [Base de Vagas]`;

    const formatJob = (j, porque) => ({
      titulo: j.titulo,
      empresa: j.empresa,
      local: j.local || "",
      match: j.match,
      porque,
      comuns: j.comuns || [],
      falta: j.falta || [],
      source: j.source,
      sourceLabel: SOURCE_LABEL[j.source] || j.source,
      url: j.url || null,
      salario: j.salario || null,
    });

    try {
      // LLM so ve as top 5 — economiza tokens.
      const raw = await completeJSON(promptOppReal(role, perfil, topForLLM, gaps), {
        route: "opp.real",
        userId,
      });
      const valid = PorquesShape.safeParse(raw);
      if (!valid.success) throw new Error("LLM shape porques invalido");
      const byId = new Map(valid.data.porques.map((p) => [p.id, p.porque]));
      vagasOut = top.map((j, idx) => {
        const porque =
          idx < topForLLM.length
            ? byId.get(j.id) ||
              `Skills compartilhadas: ${(j.comuns || []).slice(0, 3).join(", ")}. [Base de Vagas]`
            : porqueFallback(j);
        return formatJob(j, porque);
      });
    } catch (e) {
      console.error("opp: porques falharam, usando fallback determinico:", e?.message);
      vagasOut = top.map((j) => formatJob(j, porqueFallback(j)));
    }
  } else {
    // Fallback: nenhuma vaga real disponivel → usa o LLM antigo (ilustrativas)
    try {
      const raw = await completeJSON(promptOpp(role, perfil, gaps), { route: "opp.illustrative", userId });
      const valid = OppShape.safeParse(raw);
      if (!valid.success) throw new Error("LLM shape opp invalido");
      vagasOut = valid.data.vagas.map((v) => ({
        ...v,
        source: "fixtures",
        sourceLabel: "Ilustrativo",
        url: null,
        salario: null,
      }));
    } catch (e) {
      console.error("opp: LLM ilustrativo falhou:", e?.message);
      vagasOut = top.map((j) => ({
        titulo: j.titulo,
        empresa: j.empresa,
        local: j.local || "",
        match: j.match,
        porque: "Vaga ilustrativa baseada no seu cargo-alvo. [Base de Vagas]",
        falta: j.falta || [],
        source: "fixtures",
        sourceLabel: "Ilustrativo",
        url: null,
        salario: null,
      }));
    }
  }

  // Plano (independente das vagas) — sempre via LLM, validado por shape.
  let plano = [];
  try {
    const raw = await completeJSON(promptPlano(role, perfil, gaps), { route: "opp.plano", userId });
    const valid = PlanoShape.safeParse(raw);
    if (!valid.success) throw new Error("LLM shape plano invalido");
    plano = valid.data.plano;
  } catch (e) {
    console.error("opp: plano falhou:", e?.message);
    plano = [];
  }

  // Persiste plano se ha snapshot.
  if (snapshot && plano.length > 0) {
    try {
      await prisma.$transaction([
        prisma.planItem.deleteMany({ where: { snapshotId: snapshot.id } }),
        ...plano.flatMap((semana) =>
          (semana.acoes || []).map((acao) =>
            prisma.planItem.create({
              data: {
                snapshotId: snapshot.id,
                semana: semana.semana,
                foco: semana.foco || null,
                titulo: acao.titulo,
                impacto: acao.impacto || null,
                esforco: acao.esforco || null,
              },
            })
          )
        ),
      ]);
    } catch (e) {
      console.error("opp: persistencia plano falhou", e?.message);
    }
  }

  return NextResponse.json({
    vagas: vagasOut,
    plano,
    sources: payloadJobs.sources,
    illustrative: allIllustrative,
  });
}
