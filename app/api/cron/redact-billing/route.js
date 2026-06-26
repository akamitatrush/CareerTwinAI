// GET/POST /api/cron/redact-billing
// Cron mensal (dia 1 04:00 UTC). Redacta BillingEvent.payload de eventos
// com mais de 12 meses (mantem stripeEventId+type+processedAt pra audit,
// apaga payload que contem PII de Stripe — email, endereco etc).
//
// LGPD storage limitation (Art. 16): PII em payload de webhook nao precisa
// ficar retida indefinidamente apos a finalidade (processar cobranca) ja
// ter sido cumprida. 12 meses cobre disputas tipicas + auditoria fiscal.
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
