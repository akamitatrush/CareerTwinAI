import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/history/score
// Pontos (id, overall, createdAt, role) ordenados ascendente, pra alimentar o
// line chart "Jan -> Mai" do plano de evolucao. Limite duro de 100 pontos.
//
// Seguranca: filtra por userId da sessao (sem IDOR). Cliente nunca passa userId.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Voce precisa estar logado.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const points = await prisma.scoreSnapshot.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, overall: true, createdAt: true, role: true },
      take: 100,
    });
    return NextResponse.json({ points });
  } catch (err) {
    console.error("[api/history/score] erro:", err?.message || err);
    return NextResponse.json(
      { error: "Erro interno.", code: "INTERNAL" },
      { status: 500 }
    );
  }
}
