// POST /api/notifications/read-all — marca TODAS as notificacoes unread do
// user logado como lidas. updateMany escopado por userId (sem IDOR) — nao ha
// como afetar dados de outro usuario.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, count: result.count });
  } catch (err) {
    console.error("notifications read-all:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
