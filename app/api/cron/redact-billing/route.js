// GET/POST /api/cron/redact-billing
// Cron mensal (dia 1 04:00 UTC). Redacta BillingEvent.payload de eventos
// com mais de 12 meses (mantem stripeEventId+type+processedAt pra audit,
// apaga payload que contem PII de Stripe — email, endereco etc).
//
// LGPD storage limitation (Art. 16): PII em payload de webhook nao precisa
// ficar retida indefinidamente apos a finalidade (processar cobranca) ja
// ter sido cumprida. 12 meses cobre disputas tipicas + auditoria fiscal.
//
// SEGURANCA: header x-cron-secret (mesmo padrao dos outros crons).
// safeCompare constant-time anti timing attack.

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

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  let updated;
  try {
    updated = await prisma.billingEvent.updateMany({
      where: {
        processedAt: { lt: twelveMonthsAgo },
        // So eventos que ainda tem payload — idempotente em reruns.
        NOT: { payload: { equals: null } },
      },
      data: {
        payload: null,
      },
    });
  } catch (e) {
    console.error("redact-billing: updateMany falhou", e?.message);
    return NextResponse.json(
      { error: "query_failed", code: "REDACT_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, redacted: updated.count });
}
