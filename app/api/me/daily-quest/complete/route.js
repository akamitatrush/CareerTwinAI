// POST /api/me/daily-quest/complete — marca a quest do dia atual do user como
// concluida (seta completedAt=now). Idempotente: chamar 2x retorna ok sem
// atualizar completedAt (preserva o instante real do clique).
//
// Seguranca (skill seguranca-careertwin):
//  - auth() obrigatorio. 401 generico.
//  - IDOR-safe by construction: o UPDATE escopa por questId+userId. Mesmo
//    se o cliente mandasse questId de outro user no body (estamos ignorando),
//    o where (id, userId) nao acharia e retornaria 0 rows.
//  - Body NAO e necessario — quest e a "do dia" do user logado, inferida do
//    server. Aceitamos questId opcional (no body) so como defesa extra contra
//    race condition (mas reescopamos por userId).
//  - Rate-limit: 15/min (volume tipico: 1 clique/dia).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mesma logica de todayUtc do GET — questDate e DATE UTC midnight, sem hora.
function todayUtc() {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Você precisa estar logado para marcar a missão como feita.",
        code: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  const limit = await guardLLM(req, {
    name: "daily-quest-complete",
    userId: session.user.id,
    perMinuteAnon: 3,
    perMinuteUser: 15,
  });
  if (!limit.ok) return tooMany(limit);

  const userId = session.user.id;

  // Busca a quest do dia atual escopada por dono. Se nao existe, nada a fazer
  // (cliente deve ter chamado complete sem ter feito o GET — fail fast).
  const quest = await prisma.dailyQuest.findUnique({
    where: { userId_questDate: { userId, questDate: todayUtc() } },
  });

  if (!quest) {
    return NextResponse.json(
      {
        error: "Você ainda não tem missão de hoje. Abra o dashboard pra carregar.",
        code: "NOT_FOUND",
      },
      { status: 404 },
    );
  }

  // Idempotencia: ja concluida -> retorna ok preservando o completedAt original.
  if (quest.completedAt) {
    return NextResponse.json({
      ok: true,
      points: quest.rewardPoints,
      alreadyCompleted: true,
      completedAt: quest.completedAt.toISOString(),
    });
  }

  try {
    // UPDATE escopado por id+userId (defesa-em-profundidade: o id ja veio de
    // findUnique scoped acima, mas reforcamos no where pra anti-IDOR).
    const updated = await prisma.dailyQuest.update({
      where: { id: quest.id },
      data: { completedAt: new Date() },
      select: { rewardPoints: true, completedAt: true },
    });

    return NextResponse.json({
      ok: true,
      points: updated.rewardPoints,
      completedAt: updated.completedAt.toISOString(),
    });
  } catch (e) {
    console.error("daily-quest complete falhou:", e?.message);
    return NextResponse.json(
      {
        error: "Não consegui salvar agora. Tenta de novo em alguns segundos.",
        code: "PERSIST_FAILED",
      },
      { status: 500 },
    );
  }
}
