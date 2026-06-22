import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/score/latest-with-history
// Retorna o snapshot mais recente do usuario (com gaps + plano) e dois deltas:
// - deltaFromPrev: diferenca pro snapshot anterior (mostra evolucao na ultima rodada)
// - deltaFromFirst: diferenca pro primeiro snapshot (eh o "+18 em 5 meses" do dashboard)
//
// Seguranca: escopo de dono enforcado no WHERE (userId vem de auth(), nunca do cliente).
// Erros sao genericos pro cliente; detalhe so no log do servidor.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Voce precisa estar logado.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        gaps: true,
        planItems: { orderBy: { semana: "asc" } },
      },
    });

    if (snapshots.length === 0) {
      return NextResponse.json({
        latest: null,
        deltaFromPrev: 0,
        deltaFromFirst: 0,
        firstAt: null,
        totalSnapshots: 0,
      });
    }

    const latest = snapshots[0];
    const prev = snapshots[1] || null;
    const first = snapshots[snapshots.length - 1];

    return NextResponse.json({
      latest: {
        id: latest.id,
        role: latest.role,
        overall: latest.overall,
        subScores: latest.subScores,
        perfilJson: latest.perfilJson,
        createdAt: latest.createdAt,
        gaps: latest.gaps,
        planItems: latest.planItems,
      },
      deltaFromPrev: prev ? latest.overall - prev.overall : 0,
      deltaFromFirst: latest.overall - first.overall,
      firstAt: first.createdAt,
      totalSnapshots: snapshots.length,
    });
  } catch (err) {
    console.error("[api/score/latest-with-history] erro:", err?.message || err);
    return NextResponse.json(
      { error: "Erro interno.", code: "INTERNAL" },
      { status: 500 }
    );
  }
}
