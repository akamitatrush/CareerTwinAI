import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2-step IDOR check: busca o Gap junto com userId do Snapshot dono.
// Se Gap nao existe OU snapshot.userId != session => 404 (nunca 403, pra
// evitar enumeration de ids alheios).
async function ensureOwnership(gapId, userId) {
  const gap = await prisma.gap.findUnique({
    where: { id: gapId },
    select: {
      id: true,
      completedAt: true,
      habilidade: true,
      impactoPontos: true,
      snapshot: { select: { userId: true } },
    },
  });
  if (!gap) return { found: false };
  if (gap.snapshot.userId !== userId) return { found: false };
  return { found: true, gap };
}

export async function POST(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const gapId = params?.id;
  if (!gapId || typeof gapId !== "string" || gapId.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { found, gap } = await ensureOwnership(gapId, session.user.id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Idempotente: se ja concluido, devolve estado atual + flag alreadyDone.
  if (gap.completedAt) {
    return NextResponse.json({
      ok: true,
      id: gap.id,
      completedAt: gap.completedAt,
      habilidade: gap.habilidade,
      impactoPontos: gap.impactoPontos,
      alreadyDone: true,
    });
  }

  try {
    const updated = await prisma.gap.update({
      where: { id: gapId },
      data: { completedAt: new Date() },
      select: {
        id: true,
        completedAt: true,
        habilidade: true,
        impactoPontos: true,
      },
    });
    return NextResponse.json({ ok: true, ...updated });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const gapId = params?.id;
  if (!gapId || typeof gapId !== "string" || gapId.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { found } = await ensureOwnership(gapId, session.user.id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const updated = await prisma.gap.update({
      where: { id: gapId },
      data: { completedAt: null },
      select: { id: true, completedAt: true },
    });
    return NextResponse.json({ ok: true, ...updated });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
