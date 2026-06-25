// GET /api/cron/usage-cleanup
// Cron mensal: remove UsageMeter > 3 meses pra controlar size da tabela.
// Nao afeta enforcement (periodKey atual nao e tocado).
//
// SEGURANCA: verifyCronAuth aceita Authorization Bearer (Vercel Cron default)
// E x-cron-secret (manual/legado). Comparacao constant-time.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  return handle(req);
}
export async function GET(req) {
  return handle(req);
}

async function handle(req) {
  const authz = verifyCronAuth(req);
  if (!authz.ok) {
    const status = authz.code === "CRON_NOT_CONFIGURED" ? 500 : 403;
    const error =
      authz.code === "CRON_NOT_CONFIGURED"
        ? "Cron nao configurado."
        : "Acesso negado.";
    return NextResponse.json({ error, code: authz.code }, { status });
  }

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);

  try {
    const removed = await prisma.usageMeter.deleteMany({
      where: { updatedAt: { lt: threeMonthsAgo } },
    });
    return NextResponse.json({ ok: true, removed: removed.count });
  } catch (e) {
    console.error("usage-cleanup falhou:", e?.message);
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
