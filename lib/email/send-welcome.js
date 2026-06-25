// Envia email de boas-vindas pro user no primeiro acesso pos-magic-link.
//
// Contrato (fail-safe):
//  - Idempotente: User.welcomeEmailSentAt evita reenvio. Se ja foi enviado,
//    retorna { ok: true, skipped: "already-sent" } sem chamar Resend.
//  - Silencioso em falha: NUNCA throw. O signup/login do user nao pode
//    quebrar por causa de email. Loga e devolve { ok: false, ... }.
//  - No-op em ambiente sem provider: se AUTH_RESEND_KEY ou EMAIL_FROM nao
//    estao setados (dev local sem Resend), apenas warn + return.
//
// Mesmo padrao da auth.js: Resend tem prioridade quando ambos estao
// configurados. SMTP fallback nao e suportado aqui (welcome e best-effort
// e SMTP em dev nao tem dominio verificado pra produzir email decente).
//
// Caller tipico: app/api/auth/welcome-sent/route.js (chamado pelo cliente
// pos-magic-link). Fire-and-forget — o caller nao espera resposta antes
// de redirecionar o user.

import { prisma } from "@/lib/db";
import { buildWelcomeEmail } from "./welcome-template";

// Fallback pra URL do dashboard se AUTH_URL nao tiver setada (dev local).
function dashboardUrl() {
  const base = process.env.AUTH_URL || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/dashboard`;
}

// Envia via Resend HTTP API (mesmo padrao de lib/email.js). Throw em falha
// — chamador trata.
async function sendViaResend({ to, subject, html, text }) {
  const payload = {
    from: process.env.EMAIL_FROM,
    to: [to],
    subject,
    html,
    text,
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Envia o welcome email pro userId se ainda nao foi enviado. Fail-safe.
 *
 * @param {string} userId - cuid do User
 * @returns {Promise<{ok: boolean, skipped?: string, error?: string}>}
 */
export async function sendWelcomeEmail(userId) {
  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "userId-invalido" };
  }

  try {
    // 1. Busca user + profile pra montar nome + checar idempotencia.
    //    select minimo (sem rawCv, perfilJson etc). LGPD: nao trazemos
    //    PII alem do necessario.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        welcomeEmailSentAt: true,
        profile: { select: { nome: true } },
      },
    });

    if (!user) {
      console.warn("[welcome-email] user nao encontrado:", userId);
      return { ok: false, error: "user-nao-encontrado" };
    }

    // 2. Idempotencia: ja foi enviado, no-op silencioso.
    if (user.welcomeEmailSentAt) {
      return { ok: true, skipped: "already-sent" };
    }

    // 3. Sem email pra enviar (user pode ter conta OAuth sem email).
    if (!user.email) {
      console.warn("[welcome-email] user sem email:", userId);
      return { ok: false, error: "user-sem-email" };
    }

    // 4. Sem provider configurado, no-op. Log warn pra dev/ops verem.
    if (!process.env.AUTH_RESEND_KEY || !process.env.EMAIL_FROM) {
      console.warn(
        "[welcome-email] Resend nao configurado (AUTH_RESEND_KEY/EMAIL_FROM ausentes) — no-op"
      );
      return { ok: false, skipped: "no-provider" };
    }

    // 5. Build template. Preferencia: profile.nome (mais formal) > user.name.
    const nome = user.profile?.nome || user.name || "";
    const { subject, html, text } = buildWelcomeEmail({
      nome,
      dashboardUrl: dashboardUrl(),
    });

    // 6. Envia. Throw aqui cai no catch externo (silencioso).
    await sendViaResend({ to: user.email, subject, html, text });

    // 7. Marca timestamp. Race-free: se 2 requests chegarem juntos, o segundo
    //    falha silenciosamente no UPDATE (idempotencia ja garantida pelo
    //    select acima). Em pior caso enviamos 2x — aceitavel.
    await prisma.user.update({
      where: { id: userId },
      data: { welcomeEmailSentAt: new Date() },
    });

    return { ok: true };
  } catch (e) {
    // NUNCA throw. Loga e segue. O signup nao pode quebrar por email.
    console.error("[welcome-email] falhou:", e?.message || e);
    return { ok: false, error: "send-failed" };
  }
}

// Exportado pra testes (mock interno do sendViaResend impossivel sem isso).
export const __test__ = { sendViaResend, dashboardUrl };
