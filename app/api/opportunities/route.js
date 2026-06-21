import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptOpp, promptOppReal, promptPlano } from "@/lib/prompts";
import { OppBody, OppShape, PorquesShape, PlanoShape } from "@/lib/validators";
import { searchJobs } from "@/lib/jobs";
import { extractSkills, matchScore } from "@/lib/skills-taxonomy";

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

  let parsed;
  try {
    parsed = OppBody.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { snapshotId, role: roleIn, perfil: perfilIn, gaps: gapsIn } = parsed.data;

  let snapshot = null;
  if (snapshotId && userId) {
    snapshot = await prisma.scoreSnapshot.findFirst({
      where: { id: snapshotId, userId },
      include: { gaps: true },
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const role = snapshot?.role || roleIn;
  const perfil = snapshot?.perfilJson || perfilIn;
  const gaps = snapshot ? snapshot.gaps.map((g) => g.habilidade) : gapsIn || [];
  if (!role || !perfil) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const profileSkills = Array.isArray(perfil.skills) ? perfil.skills : [];

  // Busca vagas reais (ou fixtures se sem chave); match e falta calculados em codigo.
  let payloadJobs = { jobs: [], sources: [] };
  try {
    payloadJobs = await searchJobs({ role, location: "Brasil", limit: 5 });
  } catch (e) {
    console.error("jobs busca falhou:", e?.message);
  }
  const enriched = payloadJobs.jobs.map((j) => {
    const jobSkills = extractSkills(`${j.titulo} ${j.descricao}`);
    const { match, comuns, falta } = matchScore({ profileSkills, jobSkills });
    return { ...j, comuns, falta: falta.slice(0, 3), match };
  });
  enriched.sort((a, b) => b.match - a.match);
  const top = enriched.slice(0, 3);

  // Se todas as vagas exibidas sao fixtures, marcamos a resposta como ilustrativa.
  const allIllustrative = top.length > 0 && top.every((j) => j.source === "fixtures");

  // LLM justifica cada vaga (sem mexer em numero) — so para vagas REAIS.
  // Para fixtures (ja somos os autores), caimos no fluxo antigo (promptOpp).
  let vagasOut;
  if (top.length > 0 && !allIllustrative) {
    try {
      const raw = await completeJSON(promptOppReal(role, perfil, top, gaps));
      const valid = PorquesShape.safeParse(raw);
      if (!valid.success) throw new Error("LLM shape porques invalido");
      const byId = new Map(valid.data.porques.map((p) => [p.id, p.porque]));
      vagasOut = top.map((j) => ({
        titulo: j.titulo,
        empresa: j.empresa,
        local: j.local || "",
        match: j.match,
        porque: byId.get(j.id) || `Skills compartilhadas: ${(j.comuns || []).slice(0, 3).join(", ")}. [Base de Vagas]`,
        falta: j.falta || [],
        source: j.source,
        sourceLabel: SOURCE_LABEL[j.source] || j.source,
        url: j.url || null,
        salario: j.salario || null,
      }));
    } catch (e) {
      console.error("opp: porques falharam, usando fallback determinico:", e?.message);
      vagasOut = top.map((j) => ({
        titulo: j.titulo,
        empresa: j.empresa,
        local: j.local || "",
        match: j.match,
        porque: `Voce cobre ${(j.comuns || []).length} requisitos chave (${(j.comuns || []).slice(0, 3).join(", ") || "—"}). [Base de Vagas]`,
        falta: j.falta || [],
        source: j.source,
        sourceLabel: SOURCE_LABEL[j.source] || j.source,
        url: j.url || null,
        salario: j.salario || null,
      }));
    }
  } else {
    // Fallback: nenhuma vaga real disponivel → usa o LLM antigo (ilustrativas)
    try {
      const raw = await completeJSON(promptOpp(role, perfil, gaps));
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
    const raw = await completeJSON(promptPlano(role, perfil, gaps));
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
