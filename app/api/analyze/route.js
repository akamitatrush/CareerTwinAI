import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptDiag } from "@/lib/prompts";
import { computeOverall } from "@/lib/score";
import { AnalyzeBody, DiagShape } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  // Camada 2 de defesa: middleware já bloqueia anônimo, mas a rota re-checa.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let parsed;
  try {
    parsed = AnalyzeBody.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { cv, role } = parsed.data;

  let diag;
  try {
    const raw = await completeJSON(promptDiag(role.trim(), cv.trim()));
    const valid = DiagShape.safeParse(raw);
    if (!valid.success) {
      console.error("analyze: LLM shape inválido");
      return NextResponse.json(
        { error: "A IA devolveu uma resposta fora do esperado. Tente de novo." },
        { status: 502 }
      );
    }
    diag = valid.data;
  } catch (e) {
    // Não vazar detalhes ao cliente.
    console.error("analyze: LLM falhou", e?.message);
    return NextResponse.json({ error: "Falha na análise." }, { status: 502 });
  }

  // Score determinístico — calculado aqui, não na IA.
  const overall = computeOverall(diag.sub_scores);

  // Persistência: profile vigente sobrescrito; snapshot imutável.
  // Tudo escopado por userId vindo da sessão (sem IDOR).
  try {
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
        perfilJson: diag.perfil,
      },
      update: {
        nome: diag.perfil.nome || null,
        cargoAtual: diag.perfil.cargo_atual || null,
        senioridade: diag.perfil.senioridade || null,
        targetRole: role,
        skills: diag.perfil.skills || [],
        rawCv: cv,
        perfilJson: diag.perfil,
      },
    });

    const snapshot = await prisma.scoreSnapshot.create({
      data: {
        userId,
        role,
        overall,
        subScores: diag.sub_scores,
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

    return NextResponse.json({
      snapshotId: snapshot.id,
      perfil: diag.perfil,
      sub_scores: diag.sub_scores,
      gaps: diag.gaps,
      overall,
    });
  } catch (e) {
    console.error("analyze: persistencia falhou", e?.message);
    return NextResponse.json(
      { error: "Falha ao salvar o diagnóstico." },
      { status: 500 }
    );
  }
}
