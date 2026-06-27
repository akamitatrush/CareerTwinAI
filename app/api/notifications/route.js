// GET /api/notifications — devolve as 20 notificacoes mais recentes do user
// logado + contador de unread (pra badge no sininho). Sempre escopado por
// session.user.id (sem IDOR).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

async function getHandler(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Notifications e read-frequente (sininho faz polling). 60/min permite ~1/s
  // e ainda barra abuso. Anon nao chega aqui.
  const limit = await guardLLM(req, {
    name: "notifications.list",
    userId: session.user.id,
    perMinuteAnon: 0,
    perMinuteUser: 60,
  });
  if (!limit.ok) return tooMany(limit);

  try {
    // Paralelizamos timeline + counter porque os dois usam indices distintos
    // ((userId,createdAt) e (userId,readAt)). Sem JOIN, queries baratas.
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          link: true,
          meta: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      }),
    ]);
    return NextResponse.json({ items, unreadCount });
  } catch (err) {
    console.error("notifications GET:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export const GET = withApiGuard(getHandler);
