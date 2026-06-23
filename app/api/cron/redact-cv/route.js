// GET /api/cron/redact-cv
// Cron diario as 03:00 BRT. Apaga Profile.rawCv e Profile.linkedinRaw de
// usuarios cujo rawCvExpiresAt < now (default 90 dias apos upsert). O
// perfilJson estruturado (skills, cargo) fica — esse e o "gemeo" propriamente
// dito, ja sem PII raw.
//
// LGPD storage limitation (Art. 16): dados pessoais nao podem ser mantidos
// alem do necessario pra finalidade. O CV/LinkedIn raw alimenta a analise
// inicial; depois o que conta sao as conclusoes estruturadas.
//
// SEGURANCA: header x-cron-secret (mesmo padrao do digest/usage-cleanup).
// safeCompare constant-time anti timing attack. Limite de 500 perfis por
// run pra evitar lock prolongado — proxima execucao pega o resto.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

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

  const now = new Date();
  // Pega ate 500 por run. Profiles que tem rawCv (nao null) E ja expirou E
  // nao foi redactado ainda (rawCvRedactedAt null). linkedinRaw tambem e
  // limpado junto — mesmo TTL conceitual.
  let expired = [];
  try {
    expired = await prisma.profile.findMany({
      where: {
        OR: [
          { rawCv: { not: null } },
          { linkedinRaw: { not: null } },
        ],
        rawCvExpiresAt: { lt: now, not: null },
        rawCvRedactedAt: null,
      },
      select: { id: true, userId: true },
      take: 500,
    });
  } catch (e) {
    console.error("redact-cv: query falhou", e?.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let redacted = 0;
  for (const p of expired) {
    try {
      await prisma.profile.update({
        where: { id: p.id },
        data: {
          rawCv: null,
          linkedinRaw: null,
          rawCvRedactedAt: now,
        },
      });
      // Audit CV_DELETED — auto-redacao. userId preservado mesmo se profile
      // mudou de dono (improvavel — Profile.userId e unique).
      await audit({
        userId: p.userId,
        action: "CV_DELETED",
        target: `Profile:${p.id}`,
        meta: { reason: "ttl_expired", autoRedacted: true },
      });
      redacted++;
    } catch (e) {
      console.error(`redact-cv: profile=${p.id} falhou`, e?.message);
    }
  }

  return NextResponse.json({ ok: true, redacted, checked: expired.length });
}
