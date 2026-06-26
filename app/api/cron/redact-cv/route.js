// GET/POST /api/cron/redact-cv
// Cron diario as 03:00 BRT. Apaga raws de PII expirados em Profile:
//   - rawCv quando rawCvExpiresAt < now
//   - linkedinRaw quando linkedinRawExpiresAt < now
// Cada raw tem TTL/redacted timestamp PROPRIOS — antes (red-team 2026-06-25
// P0) o linkedinRaw era apagado "de carona" via rawCvExpiresAt, o que deixava
// users que so haviam colado LinkedIn (sem CV) fora do redact => LGPD Art. 16
// violation. perfilJson/linkedinJson (estruturados) ficam — sao o "gemeo".
//
// LGPD storage limitation (Art. 16): dados pessoais nao podem ser mantidos
// alem do necessario pra finalidade. O CV/LinkedIn raw alimenta a analise
// inicial; depois o que conta sao as conclusoes estruturadas.
//
// SEGURANCA: usa verifyCronAuth (lib/cron-auth.js) — aceita Authorization
// Bearer (default da Vercel Cron) E x-cron-secret (manual/legado). Comparacao
// constant-time. Limite de 500 perfis por run pra evitar lock prolongado —
// proxima execucao pega o resto.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
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

  const now = new Date();

  // Pega ate 500 perfis com pelo menos um raw expirado ainda nao redactado.
  // OR no nivel mais externo cobre os dois caminhos independentes:
  //   - rawCv com rawCvExpiresAt expirado E rawCvRedactedAt null
  //   - linkedinRaw com linkedinRawExpiresAt expirado E linkedinRawRedactedAt null
  // Profile com ambos expirados aparece uma vez e e processado em um update.
  let expired = [];
  try {
    expired = await prisma.profile.findMany({
      where: {
        OR: [
          {
            AND: [
              { rawCv: { not: null } },
              { rawCvExpiresAt: { lt: now, not: null } },
              { rawCvRedactedAt: null },
            ],
          },
          {
            AND: [
              { linkedinRaw: { not: null } },
              { linkedinRawExpiresAt: { lt: now, not: null } },
              { linkedinRawRedactedAt: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        userId: true,
        rawCv: true,
        linkedinRaw: true,
        rawCvExpiresAt: true,
        rawCvRedactedAt: true,
        linkedinRawExpiresAt: true,
        linkedinRawRedactedAt: true,
      },
      take: 500,
    });
  } catch (e) {
    // PII: nao logamos rawCv/linkedinRaw — so a mensagem da query.
    console.error("redact-cv: query falhou", e?.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let rawCvRedacted = 0;
  let linkedinRawRedacted = 0;

  for (const p of expired) {
    // Calcula o que aplica nesse profile (cada raw e independente).
    const shouldRedactRawCv =
      p.rawCv != null &&
      p.rawCvExpiresAt != null &&
      p.rawCvExpiresAt < now &&
      p.rawCvRedactedAt == null;
    const shouldRedactLinkedin =
      p.linkedinRaw != null &&
      p.linkedinRawExpiresAt != null &&
      p.linkedinRawExpiresAt < now &&
      p.linkedinRawRedactedAt == null;

    if (!shouldRedactRawCv && !shouldRedactLinkedin) {
      // Defensivo — query ja filtra, mas redundancia barata se shape mudar.
      continue;
    }

    const updateData = {};
    if (shouldRedactRawCv) {
      updateData.rawCv = null;
      updateData.rawCvRedactedAt = now;
    }
    if (shouldRedactLinkedin) {
      updateData.linkedinRaw = null;
      updateData.linkedinRawRedactedAt = now;
    }

    try {
      // IDOR: where: { id: p.id } e o proprio Profile.id que pegamos via query
      // filtrada. Nao ha input externo aqui — cron tem authority sobre todos
      // os Profiles por design (LGPD compliance batch).
      await prisma.profile.update({
        where: { id: p.id },
        data: updateData,
      });

      // Audit por tipo de raw (separados — analytics LGPD precisa distinguir).
      // meta NAO contem rawCv/linkedinRaw — apenas metadata.
      if (shouldRedactRawCv) {
        await audit({
          userId: p.userId,
          action: "CV_DELETED",
          target: `Profile:${p.id}`,
          meta: { reason: "ttl_expired", autoRedacted: true },
        });
        rawCvRedacted++;
      }
      if (shouldRedactLinkedin) {
        await audit({
          userId: p.userId,
          action: "LINKEDIN_RAW_REDACTED",
          target: `Profile:${p.id}`,
          meta: { reason: "ttl_expired", autoRedacted: true },
        });
        linkedinRawRedacted++;
      }
    } catch (e) {
      // Nao logamos os raws (PII). Apenas profile id (publico p/ admin).
      console.error(`redact-cv: profile=${p.id} falhou`, e?.message);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: expired.length,
    rawCvRedacted,
    linkedinRawRedacted,
    // Compat com observabilidade existente que olha .redacted.
    redacted: rawCvRedacted + linkedinRawRedacted,
  });
}
