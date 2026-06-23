// GET /api/cron/usage-cleanup
// Cron mensal: remove UsageMeter > 3 meses pra controlar size da tabela.
// Nao afeta enforcement (periodKey atual nao e tocado).
//
// SEGURANCA: x-cron-secret header (mesmo padrao do digest). safeCompare
// constant-time pra evitar timing attack.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCompare(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function POST(req) {
  return handle(req);
}
export async function GET(req) {
  return handle(req);
}

async function handle(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Cron nao configurado.", code: "CRON_NOT_CONFIGURED" },
      { status: 500 }
    );
  }
  const got = req.headers.get("x-cron-secret") || "";
  if (!safeCompare(got, expected)) {
    return NextResponse.json(
      { error: "Acesso negado.", code: "FORBIDDEN" },
      { status: 403 }
    );
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
