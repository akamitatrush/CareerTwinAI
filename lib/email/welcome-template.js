// Template do email de boas-vindas pro CareerTwin AI. HTML + plain text.
//
// Visual minimalista on-brand (Indigo + accent Cyan). 100% inline-styles
// (zero <style> tag, zero CSS externo) porque Gmail/Outlook strippam ou
// ignoram a maioria de tags <style>. Max 600px de largura. Compativel com
// dark mode dos clientes (cores explicitas).
//
// Texto + URL devem vir SEMPRE validados pelo caller (sendWelcomeEmail).
// Mesmo assim, escapamos nome aqui (defesa em camadas — nome vem do
// onboarding/LinkedIn e pode conter chars perigosos).

// Aceita SOMENTE http/https. Espelha lib/email.js. Retorna fallback "/"
// se a URL for invalida ou nao for HTTP(S) — o CTA cai pro homepage.
function safeHttpUrl(s, fallback = "/") {
  try {
    const u = new URL(String(s || ""));
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    return u.toString();
  } catch {
    return fallback;
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

// Pega so o primeiro nome (mais quente, evita o sobrenome do LinkedIn).
function firstName(nome) {
  if (!nome) return "";
  return String(nome).trim().split(/\s+/)[0] || "";
}

// Monta o email de boas-vindas. Argumentos:
//  - nome: string opcional (qualquer formato; pegamos primeiro nome)
//  - dashboardUrl: URL absoluta do dashboard pro CTA (ex: AUTH_URL + "/dashboard")
//
// Retorna { subject, html, text } pronto pra enviar via Resend/SMTP.
export function buildWelcomeEmail({ nome, dashboardUrl }) {
  const first = firstName(nome);
  const safeFirst = escapeHtml(first);
  const greet = safeFirst ? `Olá, ${safeFirst}!` : "Olá!";
  const greetText = first ? `Olá, ${first}!` : "Olá!";
  // CTA URL: se vier invalida, cai pra homepage relativa (nao quebra o email).
  const safeUrl = safeHttpUrl(dashboardUrl, "/");
  const baseUrl = (() => {
    try {
      return new URL(safeUrl).origin;
    } catch {
      return "";
    }
  })();
  const lgpdUrl = baseUrl ? `${baseUrl}/transparencia` : "/transparencia";
  const supportEmail = process.env.EMAIL_FROM || "sergio@careertwin.ai";

  const subject = "Bem-vindo ao CareerTwin AI";

  // HTML — table-based pra max compat com clientes (Outlook em Windows).
  // Indigo: #4F46E5 (primary), Cyan accent: #06B6D4, Bg suave: #FAFAFA.
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAFA;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <tr>
          <td style="padding:32px 40px 24px;background:linear-gradient(135deg,#4F46E5 0%,#06B6D4 100%);">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
                    <circle cx="16" cy="16" r="15" fill="none" stroke="#FFFFFF" stroke-width="2"/>
                    <path d="M10 16 L14 20 L22 12" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;line-height:1;">CareerTwin AI</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.85);letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Seu copiloto de carreira</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 8px;">
            <h1 style="margin:0 0 18px;font-size:24px;font-weight:700;color:#0F172A;letter-spacing:-0.015em;line-height:1.25;">${greet}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">
              Bem-vindo ao <strong style="color:#4F46E5;">CareerTwin AI</strong> — seu copiloto de carreira pessoal. A gente combina seu CV real com vagas reais pra te dar um diagnóstico honesto e acionável.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">
              Em ~5 minutos no dashboard, você sai com:
            </p>
            <ul style="margin:0 0 18px 20px;padding:0;font-size:15px;line-height:1.7;color:#334155;">
              <li style="margin-bottom:6px;"><strong style="color:#0F172A;">Career Health Score</strong> (0–100, fórmula auditável)</li>
              <li style="margin-bottom:6px;"><strong style="color:#0F172A;">Lista de gaps</strong> específicos com microação acionável</li>
              <li style="margin-bottom:6px;"><strong style="color:#0F172A;">Vagas reais</strong> em match com seu perfil</li>
            </ul>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#334155;">
              Pra começar: cole seu CV + cargo-alvo. A IA cuida do resto.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#4F46E5;border-radius:8px;">
                  <a href="${escapeHtml(safeUrl)}" style="display:inline-block;padding:14px 28px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">Acessar meu dashboard &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #E5E7EB;">
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
              Qualquer dúvida, responde esse email direto. Eu leio todas.
            </p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#334155;">
              <strong style="color:#0F172A;">Sergio Hasher</strong><br/>
              <span style="font-size:13px;color:#64748B;">CareerTwin AI</span>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 40px 28px;background:#F8FAFC;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:11px;line-height:1.6;color:#64748B;text-align:center;">
              Você recebeu este email porque criou conta no CareerTwin AI.
              <br/>
              <a href="${escapeHtml(lgpdUrl)}" style="color:#4F46E5;text-decoration:none;">Política de privacidade (LGPD)</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4F46E5;text-decoration:none;">${escapeHtml(supportEmail)}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Plain text — espelha conteudo do HTML. Importante pra clientes que
  // bloqueiam HTML por padrao + acessibilidade (leitores de tela).
  const text = [
    greetText,
    "",
    "Bem-vindo ao CareerTwin AI — seu copiloto de carreira pessoal.",
    "A gente combina seu CV real com vagas reais pra te dar um diagnostico honesto e acionavel.",
    "",
    "Em ~5 minutos no dashboard, voce sai com:",
    "- Career Health Score (0-100, formula auditavel)",
    "- Lista de gaps especificos com microacao acionavel",
    "- Vagas reais em match com seu perfil",
    "",
    "Pra comecar: cole seu CV + cargo-alvo. A IA cuida do resto.",
    "",
    `Acessar meu dashboard: ${safeUrl}`,
    "",
    "Qualquer duvida, responde esse email direto. Eu leio todas.",
    "",
    "Sergio Hasher",
    "CareerTwin AI",
    "",
    "---",
    `LGPD: ${lgpdUrl}`,
    `Suporte: ${supportEmail}`,
  ].join("\n");

  return { subject, html, text };
}

// Exportado SO pra testes unit. Nao use em codigo de producao.
export const __test__ = { safeHttpUrl, escapeHtml, firstName };
