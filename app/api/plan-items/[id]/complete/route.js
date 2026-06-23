import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2-step IDOR check: PlanItem -> Snapshot -> userId. 404 quando alheio (sem
// enumeration). Mesmo padrao do endpoint de Gap.
async function ensureOwnership(itemId, userId) {
  const item = await prisma.planItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      completedAt: true,
      status: true,
      titulo: true,
      snapshot: { select: { userId: true } },
    },
  });
  if (!item) return { found: false };
  if (item.snapshot.userId !== userId) return { found: false };
  return { found: true, item };
}

export async function POST(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const itemId = params?.id;
  if (!itemId || typeof itemId !== "string" || itemId.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { found, item } = await ensureOwnership(itemId, session.user.id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Idempotente: se ja concluido (completedAt OU status=feita), devolve estado
  // atual + alreadyDone. Cobre o caso de status feita sem completedAt setado.
  if (item.completedAt || item.status === "feita") {
    return NextResponse.json({
      ok: true,
      id: item.id,
      completedAt: item.completedAt,
      status: item.status,
      titulo: item.titulo,
      alreadyDone: true,
    });
  }

  try {
    const updated = await prisma.planItem.update({
      where: { id: itemId },
      data: { completedAt: new Date(), status: "feita" },
      select: {
        id: true,
        completedAt: true,
        status: true,
        titulo: true,
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
  const itemId = params?.id;
  if (!itemId || typeof itemId !== "string" || itemId.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { found } = await ensureOwnership(itemId, session.user.id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const updated = await prisma.planItem.update({
      where: { id: itemId },
      data: { completedAt: null, status: "pendente" },
      select: { id: true, completedAt: true, status: true },
    });
    return NextResponse.json({ ok: true, ...updated });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
