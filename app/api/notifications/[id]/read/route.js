// POST /api/notifications/[id]/read — marca uma notificacao como lida.
// 2-step IDOR check: busca primeiro pelo id e confirma userId. Se nao
// existe ou pertence a outro user => 404 (sem revelar existencia).
// Idempotente: chamar de novo numa ja lida nao altera readAt.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const id = params?.id;
  if (!id || typeof id !== "string" || id.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const n = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true, readAt: true },
    });
    if (!n || n.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!n.readAt) {
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notifications [id]/read:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
