// GET /api/cron/outcome-survey
// Cron semanal (segunda 14:00 UTC). Acha users que cruzaram milestone de
// 30/60/90 dias desde firstDiagnosisAt E nao tem Outcome registrado pra esse
// milestone. Envia email perguntando "como esta sua busca?" com link pra
// /dashboard (que abrira o OutcomeSurveyModal).
//
// COTA RESEND: Free tier = 100 emails/dia (3k/mes). Limitamos a 50 surveys
// por execucao pra deixar margem pra digest semanal (que tambem usa Resend)
// e outros transactionals. Cron roda 1x/semana — em 4 semanas, max 200
// surveys/mes (~6.6% da cota free). Prioriza users mais antigos primeiro
// (orderBy firstDiagnosisAt asc) — eles tem mais milestones pendentes.
//
// SEGURANCA: header x-cron-secret (mesmo padrao de digest/redact-cv).
// timingSafeEqual constant-time. Falha silenciosa em emails individuais —
// 1 user com erro nao derruba o batch. Audit OUTCOME_SURVEY_SENT por user.
//
// PRIVACIDADE: subject/email NAO incluem PII alem do firstName (publico no
// proprio email). Link aponta pra /dashboard?survey=30d|60d|90d, server
// abre modal com surveyKind preset. Outcome.create captura scoreAtTime —
// sem PII vai pro Outcome.evidence (campo opcional, user que digita).

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cota Resend: 100/dia free. Reservamos ~50 pro cron de survey (executa
// 1x/semana — 200/mes), deixando 50/dia pra digest + transactionals.
const MAX_SURVEYS_PER_RUN = 50;

// Janelas dos milestones. Defesa em profundidade: aceitamos ate +14 dias de
// folga apos cada milestone pra evitar miss quando cron pula execucao (Vercel
// scheduling, manutencao). User que cruzou 35 dias ainda pega como 30d.
const MILESTONES = [
  { kind: "THIRTY_DAYS", minDays: 30, maxDays: 60 },
  { kind: "SIXTY_DAYS", minDays: 60, maxDays: 90 },
  { kind: "NINETY_DAYS", minDays: 90, maxDays: 180 },
];

function safeCompare(a, b) {
  if (!a || !b) return false;
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) {
    timingSafeEqual(A, Buffer.alloc(A.length));
    return false;
  }
  return timingSafeEqual(A, B);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSurveyHtml({ firstName, surveyKind, baseUrl }) {
  const milestoneLabel =
    surveyKind === "THIRTY_DAYS"
      ? "30 dias"
      : surveyKind === "SIXTY_DAYS"
        ? "60 dias"
        : "90 dias";
  const surveyParam =
    surveyKind === "THIRTY_DAYS"
      ? "30d"
      : surveyKind === "SIXTY_DAYS"
        ? "60d"
        : "90d";
  const greet = firstName ? `Oi, ${escapeHtml(firstName)}` : "Oi";
  const url = `${baseUrl}/dashboard?survey=${surveyParam}&utm_source=outcome-survey&utm_medium=email&utm_campaign=${surveyParam}`;

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Como tem sido sua busca?</title></head>
<body style="margin:0;background:#FFF8F0;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F0F0E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td>
          <div style="font:700 14px/1 'Helvetica Neue',sans-serif;letter-spacing:.04em;margin-bottom:6px;">CareerTwin AI</div>
          <div style="font:11px/1 'Courier New',monospace;letter-spacing:.16em;text-transform:uppercase;color:#6B6B66;margin-bottom:24px;">PESQUISA · ${milestoneLabel.toUpperCase()}</div>
          <h1 style="font:800 26px/1.2 'Helvetica Neue',serif;margin:0 0 8px;letter-spacing:-.01em;">${greet}, como tem sido sua busca?</h1>
          <p style="font:14px/1.5 'Helvetica Neue',sans-serif;color:#4C5048;margin:0 0 20px;">
            Faz cerca de <b>${milestoneLabel}</b> desde seu primeiro diagnóstico no CareerTwin.
            Saber como tá ajuda a calibrar o produto pra todo mundo — e a construir uma mediana real de contratados.
          </p>
          <p style="font:14px/1.5 'Helvetica Neue',sans-serif;color:#4C5048;margin:0 0 24px;">
            Toma 30 segundos. Você pode pular se preferir.
          </p>
          <div style="margin:24px 0;">
            <a href="${url}" style="display:inline-block;background:#0F0F0E;color:#fff;font:600 14px sans-serif;padding:12px 24px;border-radius:6px;text-decoration:none;">
              Responder em 30s →
            </a>
          </div>
          <p style="font:11px/1.5 'Helvetica Neue',sans-serif;color:#888;margin-top:24px;">
            Seus dados ficam agregados e anônimos na mediana. Nenhuma informação pessoal vai pra outros usuários.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendSurveyEmail({ to, html, subject }) {
  const hasResend =
    process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM;
  if (!hasResend) {
    throw new Error("Resend nao configurado (AUTH_RESEND_KEY/EMAIL_FROM).");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
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
      { error: "Acesso negado a este cron job.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Se nao tem Resend, retorna ok sem enviar — em DEV/Mailpit, surveys nao
  // fazem sentido (sem real reach de email). Comportamento: log + 200.
  if (!process.env.AUTH_RESEND_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: 0,
      reason: "Resend nao configurado — survey cron sem efeito em dev.",
    });
  }

  const now = new Date();
  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";

  let sent = 0;
  let skipped = 0;
  const errors = [];
  let remainingQuota = MAX_SURVEYS_PER_RUN;

  // Processa cada milestone em ordem (30d primeiro — users mais antigos
  // tem mais milestones pendentes, prioriza eles).
  for (const milestone of MILESTONES) {
    if (remainingQuota <= 0) break;

    const minDate = new Date(
      now.getTime() - milestone.maxDays * 24 * 60 * 60 * 1000
    );
    const maxDate = new Date(
      now.getTime() - milestone.minDays * 24 * 60 * 60 * 1000
    );

    // Users cujo firstDiagnosisAt cai na janela do milestone (entre
    // minDate=agora-maxDays e maxDate=agora-minDays).
    let candidates;
    try {
      candidates = await prisma.user.findMany({
        where: {
          email: { not: null },
          profile: {
            firstDiagnosisAt: {
              gte: minDate,
              lte: maxDate,
              not: null,
            },
          },
          // Nao tem Outcome pra esse surveyKind (nao perguntar de novo).
          // Inclui DECLINED_TO_ANSWER (user dismissou) — nao re-perguntamos.
          outcomes: {
            none: { surveyKind: milestone.kind },
          },
        },
        select: {
          id: true,
          email: true,
          profile: { select: { nome: true, firstDiagnosisAt: true } },
        },
        orderBy: { createdAt: "asc" }, // mais antigos primeiro
        take: remainingQuota,
      });
    } catch (e) {
      console.error(`outcome-survey: query ${milestone.kind} falhou`, e?.message);
      continue;
    }

    for (const u of candidates) {
      if (remainingQuota <= 0) break;
      const firstName = (u.profile?.nome || "").split(" ")[0] || "";
      try {
        const html = buildSurveyHtml({
          firstName,
          surveyKind: milestone.kind,
          baseUrl,
        });
        const milestoneLabel =
          milestone.kind === "THIRTY_DAYS"
            ? "30 dias"
            : milestone.kind === "SIXTY_DAYS"
              ? "60 dias"
              : "90 dias";
        await sendSurveyEmail({
          to: u.email,
          subject: `Como tem sido sua busca? (${milestoneLabel})`,
          html,
        });
        await audit({
          userId: u.id,
          action: "OUTCOME_SURVEY_SENT",
          target: `User:${u.id}`,
          meta: { surveyKind: milestone.kind },
        });
        sent++;
        remainingQuota--;
      } catch (e) {
        errors.push({
          userId: u.id,
          milestone: milestone.kind,
          err: e?.message?.slice(0, 200) || "erro",
        });
      }
    }
    if (candidates.length === 0) skipped++;
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    failed: errors.length,
    quotaUsed: MAX_SURVEYS_PER_RUN - remainingQuota,
    quotaMax: MAX_SURVEYS_PER_RUN,
    errors: errors.slice(0, 10),
  });
}
