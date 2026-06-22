// Pagina customizada de "verifique seu email" pos-envio do magic link.
// Auth.js redireciona pra essa rota apos signIn("nodemailer"|"resend").
//
// Seguranca:
//  - Nao confirmamos nem negamos se o email existe na base. A mensagem e
//    sempre a mesma — Auth.js ja dispara silenciosamente pra qualquer email,
//    e esta pagina nao expoe nada alem do que o usuario digitou.
//  - searchParams.email (se vier) e renderizado direto via JSX — React
//    escapa por padrao. NUNCA usar dangerouslySetInnerHTML aqui.
//  - Validamos formato do email antes de exibir; se vier malformado ou
//    grande demais, mostramos a mensagem generica.

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeEmail(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 200) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export default function VerifyRequestPage({ searchParams }) {
  // Auth.js v5 nao costuma passar email por padrao (anti-enum). Mas se
  // nossa propria pagina /entrar quiser passar via redirect futuramente,
  // tratamos com seguranca.
  const email = safeEmail(searchParams?.email);

  return (
    <main className="wrap" style={{ maxWidth: 560, paddingTop: 64, paddingBottom: 80 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: "var(--accent-wash)",
          border: "1px solid var(--accent-deep)",
          borderRadius: 2,
          marginBottom: 20,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          Email enviado
        </span>
      </div>

      <h1 className="hero" style={{ fontSize: 38, marginBottom: 16 }}>
        Verifique sua <em>caixa de entrada</em>.
      </h1>

      <p className="hero-lede" style={{ marginBottom: 28 }}>
        {email ? (
          <>
            Mandamos um link mágico pra <b style={{ color: "var(--ink)" }}>{email}</b> —
            clica nele pra entrar. Sem senha pra lembrar.
          </>
        ) : (
          <>
            Mandamos um link mágico pro email que você digitou — clica nele pra
            entrar. Sem senha pra lembrar.
          </>
        )}
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderLeft: "3px solid var(--accent)",
          borderRadius: "0 4px 4px 0",
          padding: "16px 18px",
          marginBottom: 28,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2, color: "var(--ink-soft)" }} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              Não chegou em 1 minuto?
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              Verifica spam ou a aba de promoções. Links expiram em 24h por segurança.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
        <a href="/entrar" className="btn btn-ghost" style={{ textDecoration: "none" }}>
          Tentar com outro email
        </a>
      </div>

      <p
        style={{
          opacity: 0.7,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13.5,
          color: "var(--ink-faint)",
          margin: 0,
          paddingTop: 20,
          borderTop: "1px solid var(--rule)",
          lineHeight: 1.55,
        }}
      >
        Mudou de ideia? <a href="/" style={{ color: "var(--ink-soft)", fontWeight: 600 }}>Voltar pro modo experimentar (sem login)</a> —
        a IA roda de verdade mas nada é salvo.
      </p>
    </main>
  );
}
