import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptOpp } from "@/lib/prompts";
import { OppBody, OppShape } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // snapshotId so vale com sessao — sem userId nao da para escopar.
  let snapshot = null;
  if (snapshotId && userId) {
    snapshot = await prisma.scoreSnapshot.findFirst({
      where: { id: snapshotId, userId }, // dono dentro do WHERE
      include: { gaps: true },
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const role = snapshot?.role || roleIn;
  const perfil = snapshot?.perfilJson || perfilIn;
  const gaps = snapshot
    ? snapshot.gaps.map((g) => g.habilidade)
    : gapsIn || [];

  if (!role || !perfil) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let opp;
  try {
    const raw = await completeJSON(promptOpp(role, perfil, gaps));
    const valid = OppShape.safeParse(raw);
    if (!valid.success) {
      console.error("opp: LLM shape inválido");
      return NextResponse.json(
        { error: "A IA devolveu uma resposta fora do esperado." },
        { status: 502 }
      );
    }
    opp = valid.data;
  } catch (e) {
    console.error("opp: LLM falhou", e?.message);
    return NextResponse.json({ error: "Falha ao gerar oportunidades." }, { status: 502 });
  }

  // Persiste plano se houver snapshot (auth-scoped); senao retorna efêmero.
  if (snapshot) {
    try {
      await prisma.$transaction([
        prisma.planItem.deleteMany({ where: { snapshotId: snapshot.id } }),
        ...opp.plano.flatMap((semana) =>
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
      // Nao falha o request; o plano segue no payload.
    }
  }

  return NextResponse.json(opp);
}
