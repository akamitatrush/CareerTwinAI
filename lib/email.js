// Email transacional. Usa Resend se AUTH_RESEND_KEY estiver setada; senao,
// SMTP via nodemailer (Mailpit em dev). Mesmo padrao de fallback do lib/auth.js.

import nodemailer from "nodemailer";

// Aceita SOMENTE http/https. Bloqueia javascript:, data:, file: etc. Retorna ""
// se a URL nao for valida ou nao for HTTP(S) — chamador trata como "sem URL".
function safeHttpUrl(s) {
  try {
    const u = new URL(String(s || ""));
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function digestHtml({ nome, role, vagas }) {
  const greet = nome ? `Oi, ${escapeHtml(nome.split(" ")[0])}` : "Oi";
  const rows = vagas
    .map(
      (v) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #E8DFD2;vertical-align:top;">
            <div style="font:600 15px/1.3 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0F0F0E;margin-bottom:4px;">
              ${escapeHtml(v.titulo)}
            </div>
            <div style="font:13px/1.4 'Helvetica Neue',Arial,sans-serif;color:#4C5048;margin-bottom:4px;">
              ${escapeHtml(v.empresa)}${v.local ? ` · ${escapeHtml(v.local)}` : ""}
            </div>
            <div style="font:11px/1 'Courier New',monospace;letter-spacing:.1em;text-transform:uppercase;color:#888;">
              ${escapeHtml(v.source || "—")} · match ${v.match}
            </div>
            ${(() => {
              const safeUrl = safeHttpUrl(v.url);
              return safeUrl
                ? `<div style="margin-top:8px;"><a href="${escapeHtml(safeUrl)}" style="color:#0F0F0E;font:600 12px sans-serif;border-bottom:2px solid #B9D90C;text-decoration:none;padding-bottom:1px;">ver vaga →</a></div>`
                : "";
            })()}
          </td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Vagas pra você esta semana</title></head>
<body style="margin:0;background:#FFF8F0;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F0F0E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td>
          <div style="font:700 14px/1 'Helvetica Neue',sans-serif;letter-spacing:.04em;margin-bottom:6px;color:#0F0F0E;">CareerTwin AI</div>
          <div style="font:11px/1 'Courier New',monospace;letter-spacing:.16em;text-transform:uppercase;color:#6B6B66;margin-bottom:24px;">DIGEST SEMANAL · ${new Date().toLocaleDateString("pt-BR")}</div>
          <h1 style="font:800 26px/1.2 'Helvetica Neue',serif;margin:0 0 8px;letter-spacing:-.01em;">${greet}, ${vagas.length} ${vagas.length === 1 ? "vaga nova" : "vagas novas"} pra você.</h1>
          <p style="font:14px/1.5 'Helvetica Neue',sans-serif;color:#4C5048;margin:0 0 24px;">
            Filtramos por <b>${escapeHtml(role)}</b>, ordenamos por match com seu perfil.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rows}
          </table>
          <p style="font:13px/1.5 'Helvetica Neue',sans-serif;color:#4C5048;margin-top:32px;">
            <a href="${process.env.AUTH_URL || "http://localhost:3000"}/candidaturas?utm_source=digest&utm_medium=email&utm_campaign=weekly" style="color:#0F0F0E;">Abrir candidaturas</a> ·
            <a href="${process.env.AUTH_URL || "http://localhost:3000"}/meus-dados?utm_source=digest&utm_medium=email&utm_campaign=weekly" style="color:#0F0F0E;">Desativar digest</a>
          </p>
          <p style="font:11px/1.5 'Helvetica Neue',sans-serif;color:#888;margin-top:24px;">
            Você recebe este email porque ativou o monitoramento de oportunidades. Pode desligar a qualquer momento em "Meus dados".
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendViaResend({ to, subject, html, text }) {
  const payload = {
    from: process.env.EMAIL_FROM,
    to: [to],
    subject,
    html,
  };
  if (text) payload.text = text;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function sendViaSmtp({ to, subject, html, text }) {
  const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
  const mail = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };
  if (text) mail.text = text;
  return transport.sendMail(mail);
}

// Briefing diario — email curto e personalizado. Diferente do digest semanal
// (lista de vagas), este e narrativo: 1-2 paragrafos do LLM com score, lacuna
// e 1 vaga em destaque. Renderiza summary como TEXTO PLANO (escapado), nao
// HTML — defesa em profundidade contra prompt injection que tente injetar
// markup no output do LLM. Subject ja vem clampado da rota (max 100 chars).
function briefingHtml({ subject, summary, firstName }) {
  const greet = firstName ? `Oi, ${escapeHtml(firstName)}` : "Oi";
  // summary preserva quebras de linha (LLM as vezes formata em 2 paragrafos).
  // Escapamos antes de aplicar <br> pra evitar XSS via output do modelo.
  const safeSummary = escapeHtml(summary).replace(/\n/g, "<br>");
  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#FFF8F0;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F0F0E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td>
          <div style="font:700 14px/1 'Helvetica Neue',sans-serif;letter-spacing:.04em;margin-bottom:6px;">CareerTwin AI</div>
          <div style="font:11px/1 'Courier New',monospace;letter-spacing:.16em;text-transform:uppercase;color:#6B6B66;margin-bottom:24px;">BRIEFING DIÁRIO · ${new Date().toLocaleDateString("pt-BR")}</div>
          <h1 style="font:800 26px/1.2 'Helvetica Neue',serif;margin:0 0 8px;letter-spacing:-.01em;">${greet}</h1>
          <p style="font:15px/1.6 'Helvetica Neue',sans-serif;color:#1a1a1a;margin:0 0 24px;">${safeSummary}</p>
          <div style="margin:24px 0;">
            <a href="${baseUrl}/dashboard?utm_source=daily-briefing&utm_medium=email&utm_campaign=briefing" style="display:inline-block;background:#0F0F0E;color:#fff;font:600 14px sans-serif;padding:12px 24px;border-radius:6px;text-decoration:none;">
              Abrir gêmeo →
            </a>
          </div>
          <hr style="margin:32px 0;border:0;border-top:1px solid #E8DFD2;" />
          <p style="font:11px/1.5 'Helvetica Neue',sans-serif;color:#888;">
            Você está recebendo isso porque ativou os briefings diários. <a href="${baseUrl}/conta" style="color:#888;">Ajustar preferências</a> ou <a href="${baseUrl}/meus-dados" style="color:#888;">desativar</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Exportado SOMENTE pra testes unit (tests/unit/email-digest.test.js).
// Nao usar em codigo de producao — chame sendDigestEmail() em vez disso.
export const __test__ = { digestHtml, escapeHtml, safeHttpUrl, briefingHtml };

// Envia briefing diario. Mesmo fallback do digest: Resend > SMTP > erro.
// O caller deve garantir que to/subject/summary estao validados e nao tem PII raw.
export async function sendBriefingEmail({ to, subject, summary, firstName, text }) {
  const html = briefingHtml({ subject, summary, firstName });
  // Subject ja vem clampado (max 100) — defesa em camadas: limita ao Resend (Subject-line max practical ~78).
  const safeSubject = String(subject || "Seu briefing de hoje").slice(0, 200);
  if (process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {
    return sendViaResend({ to, subject: safeSubject, html, text });
  }
  if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
    return sendViaSmtp({ to, subject: safeSubject, html, text });
  }
  throw new Error("Nenhum provider de email configurado.");
}

export async function sendDigestEmail({ to, nome, role, vagas }) {
  const html = digestHtml({ nome, role, vagas });
  const subject = `${vagas.length} ${vagas.length === 1 ? "vaga nova" : "vagas novas"} de ${role}`;
  if (process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {
    return sendViaResend({ to, subject, html });
  }
  if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
    return sendViaSmtp({ to, subject, html });
  }
  throw new Error("Nenhum provider de email configurado.");
}
