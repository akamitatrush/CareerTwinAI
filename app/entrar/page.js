import Link from "next/link";
import { signIn, EMAIL_PROVIDER_ID } from "@/lib/auth";
import { isRealProduction } from "@/lib/env";

export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------
 * /entrar — Aragorn v5 (NOIR EDITORIAL). Server Component puro.
 * Reveal do magic-link usa <details> nativo (sem hooks).
 * Server actions intactas (emailAction / linkedinAction / devAction).
 * `hasGoogle` usado mesmo se provider ainda nao registrado em lib/auth.js
 * — Boromir v5 adiciona em paralelo.
 * --------------------------------------------------------------- */

// Email login pode vir via Resend (prod) ou Nodemailer SMTP (dev).
const hasEmail = !!(
  process.env.EMAIL_FROM &&
  (process.env.AUTH_RESEND_KEY || process.env.EMAIL_SERVER)
);
const hasLinkedIn = !!(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const hasDevCreds =
  !isRealProduction() && process.env.AUTH_DEV_CREDENTIALS === "true";

async function emailAction(formData) {
  "use server";
  const raw = String(formData.get("email") || "").trim().toLowerCase();
  if (!raw || raw.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    // Mensagem genérica intencional — não revela se o e-mail existe.
    return;
  }
  if (!EMAIL_PROVIDER_ID) return;
  await signIn(EMAIL_PROVIDER_ID, { email: raw, redirectTo: "/meu-gemeo" });
}

async function linkedinAction() {
  "use server";
  await signIn("linkedin", { redirectTo: "/meu-gemeo" });
}

async function googleAction() {
  "use server";
  // Boromir v5 adiciona o provider em paralelo. Se ainda nao registrado,
  // signIn lanca erro -> NextAuth redireciona pra /auth/error (ja tratado).
  await signIn("google", { redirectTo: "/meu-gemeo" });
}

async function devAction(formData) {
  "use server";
  const raw = String(formData.get("email") || "").trim().toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return;
  await signIn("dev", { email: raw, redirectTo: "/meu-gemeo" });
}

/* ---------- SVG icons inline ---------- */
// Stroke icons usam stroke=1.5 + linecap/linejoin round (canônico do projeto).
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.45c-.28 1.45-1.13 2.68-2.4 3.51v2.92h3.87c2.27-2.09 3.57-5.17 3.57-8.67z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-2.92c-1.07.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.24 21.3 7.32 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.37c-.25-.72-.38-1.49-.38-2.37s.14-1.65.38-2.37V6.54H1.27C.46 8.16 0 9.99 0 12s.46 3.84 1.27 5.46l4-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.32 0 3.24 2.7 1.27 6.54l4 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.45 20.45h-3.55v-5.56c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 11-.01-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M4 21V4h12l-2 4 2 4H4" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

/* --------------------------------------------------------------- */
export default function EntrarPage({ searchParams }) {
  const enviado = searchParams?.enviado === "1";
  const noProviders = !hasEmail && !hasLinkedIn && !hasGoogle && !hasDevCreds;

  return (
    <main className="entrar-v2-main">
      {/* Brand mark — Cloudwalk-style minimal wordmark com dot pulsante */}
      <header className="entrar-v2-brand" aria-label="CareerTwin">
        <span className="entrar-v2-brand-dot" aria-hidden="true" />
        <span className="entrar-v2-brand-mark">
          CareerTwin<span className="entrar-v2-brand-slash">/</span>
          <span className="entrar-v2-brand-page">entrar</span>
        </span>
      </header>

      <section className="entrar-v2-card" aria-labelledby="entrar-v2-title">
        <p className="entrar-v2-eyebrow">
          <span className="entrar-v2-eyebrow-bullet" aria-hidden="true">01</span>
          ENTRAR / CRIAR CONTA
        </p>

        <h1 id="entrar-v2-title" className="entrar-v2-title">
          {/* Espaco apos <br /> e proposital — em mobile o <br> vira display:none
              (regra abaixo), e sem o espaco o texto colava "gemeode carreira". */}
          Seu gêmeo<br /> de carreira.
        </h1>

        <p className="entrar-v2-tagline">
          Diagnóstico auditável, sem caixa-preta, em{" "}
          <span className="entrar-v2-tagline-accent">30 segundos</span>.
        </p>

        <hr className="entrar-v2-rule" aria-hidden="true" />

        {enviado && (
          <div className="entrar-v2-note" role="status" aria-live="polite">
            <span className="entrar-v2-note-check" aria-hidden="true">✓</span>
            <div>
              <b>Link enviado.</b> Se houver uma conta com esse e-mail, ele já está
              na caixa de entrada (confere o spam por garantia).
            </div>
          </div>
        )}

        <div className="entrar-v2-ctas">
          {hasGoogle && (
            <form action={googleAction}>
              <button className="entrar-v2-btn entrar-v2-btn-google" type="submit">
                <GoogleIcon />
                <span>Continuar com Google</span>
                <span className="entrar-v2-btn-arrow" aria-hidden="true"><Arrow /></span>
              </button>
            </form>
          )}

          {hasLinkedIn && (
            <form action={linkedinAction}>
              <button className="entrar-v2-btn entrar-v2-btn-linkedin" type="submit">
                <LinkedInIcon />
                <span>Continuar com LinkedIn</span>
                <span className="entrar-v2-btn-arrow" aria-hidden="true"><Arrow /></span>
              </button>
            </form>
          )}

          {(hasGoogle || hasLinkedIn) && hasEmail && (
            <div className="entrar-v2-divider" aria-hidden="true">
              <span className="entrar-v2-divider-line" />
              <span className="entrar-v2-divider-text">ou</span>
              <span className="entrar-v2-divider-line" />
            </div>
          )}

          {hasEmail && !enviado && (
            <details className="entrar-v2-magic">
              <summary className="entrar-v2-btn entrar-v2-btn-ghost">
                <MailIcon />
                <span>Enviar link mágico por email</span>
                <span className="entrar-v2-btn-arrow" aria-hidden="true"><Arrow /></span>
              </summary>
              <form action={emailAction} className="entrar-v2-magic-form">
                <label htmlFor="entrar-v2-email" className="entrar-v2-magic-label">E-mail</label>
                <div className="entrar-v2-magic-row">
                  <input id="entrar-v2-email" name="email" type="email" required maxLength={200}
                    placeholder="voce@exemplo.com" autoComplete="email" className="entrar-v2-input" />
                  <button type="submit" className="entrar-v2-btn entrar-v2-btn-primary">
                    Enviar
                    <span className="entrar-v2-btn-arrow" aria-hidden="true"><Arrow /></span>
                  </button>
                </div>
                <p className="entrar-v2-magic-hint">Sem senha. Clica no link do email e tá dentro.</p>
              </form>
            </details>
          )}

          {hasDevCreds && (
            // <details open> para nao quebrar e2e que clica direto no
            // botao "Entrar (dev)" sem expandir.
            <details className="entrar-v2-dev" open>
              <summary className="entrar-v2-dev-summary">
                <span className="entrar-v2-dev-badge">DEV</span>
                Login dev (apenas local)
              </summary>
              <form action={devAction} className="entrar-v2-dev-form">
                <input name="email" type="email" required placeholder="dev@local"
                  autoComplete="off" className="entrar-v2-input" />
                <button type="submit" className="entrar-v2-btn entrar-v2-btn-ghost entrar-v2-dev-submit">
                  Entrar (dev)
                </button>
              </form>
            </details>
          )}

          {noProviders && (
            <div className="entrar-v2-empty" role="status">
              <p className="entrar-v2-empty-title">Login em modo demo</p>
              <p className="entrar-v2-empty-body">
                Nenhum provider de autenticação está ativo. Você pode rodar o diagnóstico
                em <Link href="/">/</Link> sem salvar nada. Pra ativar conta e histórico,
                o admin precisa configurar Google, LinkedIn ou email.
              </p>
            </div>
          )}
        </div>

        <hr className="entrar-v2-rule" aria-hidden="true" />

        <ul className="entrar-v2-trust" aria-label="Princípios">
          <li><ShieldIcon /><span>LGPD-first</span></li>
          <li><AuditIcon /><span>Diagnóstico auditável</span></li>
          <li><FlagIcon /><span>Brasil-first</span></li>
        </ul>

        <hr className="entrar-v2-rule" aria-hidden="true" />

        <p className="entrar-v2-experiment">
          Só quer testar?{" "}
          <Link href="/" className="entrar-v2-experiment-link">
            Use o modo experimentar <span aria-hidden="true">→</span>
          </Link>
        </p>

        <p className="entrar-v2-legal">
          Ao continuar, você concorda com nossos{" "}
          <Link href="/termos">Termos de Uso</Link> e{" "}
          <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </section>

      {/* CSS escopado — prefixo .entrar-v2-*. Não toca globals.css. */}
      <style>{`
        .entrar-v2-main{ min-height:100dvh; width:100%; position:relative; display:flex; flex-direction:column; align-items:center; padding:56px clamp(16px,5vw,56px) 64px; background: radial-gradient(ellipse 80% 50% at 50% -10%, var(--accent-cyan-glow,transparent) 0%, transparent 60%), var(--bg); color:var(--text); }
        .entrar-v2-main::before{ content:""; position:absolute; inset:0; pointer-events:none; opacity:.03; mix-blend-mode:overlay; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"); }

        .entrar-v2-brand{ position:relative; z-index:1; display:inline-flex; align-items:center; gap:10px; margin-bottom:clamp(40px,8vh,96px); font-family:var(--mono,"JetBrains Mono",monospace); font-size:13px; letter-spacing:.04em; color:var(--text); }
        .entrar-v2-brand-dot{ width:8px; height:8px; border-radius:999px; background:var(--accent-cyan,var(--accent)); box-shadow:0 0 12px var(--accent-cyan-glow,transparent); animation:entrarV2Pulse 2.4s ease-in-out infinite; }
        @keyframes entrarV2Pulse{ 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(.85)} }
        .entrar-v2-brand-mark{ font-weight:600; }
        .entrar-v2-brand-slash{ color:var(--text-faint); margin:0 4px; font-weight:400; }
        .entrar-v2-brand-page{ color:var(--text-muted); font-weight:400; }

        .entrar-v2-card{ position:relative; z-index:1; width:100%; max-width:560px; animation:entrarV2In .6s var(--ease-standard,cubic-bezier(.4,0,.2,1)) both; }
        @keyframes entrarV2In{ from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

        .entrar-v2-eyebrow{ display:inline-flex; align-items:center; gap:14px; margin:0 0 24px; font-family:var(--mono,"JetBrains Mono",monospace); font-size:clamp(11px,1.1vw,13px); font-weight:500; letter-spacing:.18em; text-transform:uppercase; color:var(--text-muted); }
        .entrar-v2-eyebrow-bullet{ display:inline-grid; place-items:center; width:28px; height:28px; border:1px solid var(--border-strong); border-radius:var(--radius-sm,6px); background:var(--surface); font-size:10.5px; color:var(--text-soft); }

        .entrar-v2-title{ margin:0 0 20px; font-family:var(--font-display,"Plus Jakarta Sans",sans-serif); font-size:clamp(40px,6vw,72px); font-weight:700; line-height:.98; letter-spacing:-.035em; color:var(--text-strong,var(--text)); }
        @media (max-width:640px){
          .entrar-v2-title{ font-size:clamp(32px,8vw,56px); line-height:1.02; }
          .entrar-v2-title br{ display:none; }
        }

        .entrar-v2-tagline{ margin:0 0 32px; max-width:42ch; font-family:var(--font-body,"Plus Jakarta Sans",sans-serif); font-size:clamp(16px,1.5vw,20px); line-height:1.45; color:var(--text-soft); }
        .entrar-v2-tagline-accent{ position:relative; white-space:nowrap; color:var(--text-strong,var(--text)); font-weight:600; }
        .entrar-v2-tagline-accent::after{ content:""; position:absolute; left:0; right:0; bottom:-2px; height:2px; background:var(--accent-cyan,var(--accent)); opacity:.7; }

        .entrar-v2-rule{ width:100%; height:1px; border:0; margin:32px 0; background:var(--border); }
        .entrar-v2-ctas{ display:grid; gap:12px; }
        .entrar-v2-ctas form{ margin:0; }

        .entrar-v2-btn{ appearance:none; width:100%; min-height:56px; padding:16px 20px; border:1px solid transparent; border-radius:var(--radius-md,10px); display:inline-flex; align-items:center; gap:12px; text-align:left; font-family:var(--font-body,"Plus Jakarta Sans",sans-serif); font-weight:600; font-size:clamp(15px,1.3vw,16px); letter-spacing:-.005em; cursor:pointer; position:relative; transition: transform 180ms var(--ease-standard,cubic-bezier(.4,0,.2,1)), background 180ms var(--ease-standard,cubic-bezier(.4,0,.2,1)), border-color 180ms var(--ease-standard,cubic-bezier(.4,0,.2,1)), box-shadow 180ms var(--ease-standard,cubic-bezier(.4,0,.2,1)); }
        .entrar-v2-btn > span:not(.entrar-v2-btn-arrow){ flex:1; }
        .entrar-v2-btn-arrow{ display:inline-grid; place-items:center; width:24px; height:24px; opacity:.5; transition: transform 220ms var(--ease-standard,cubic-bezier(.4,0,.2,1)), opacity 180ms; }
        .entrar-v2-btn:hover .entrar-v2-btn-arrow{ transform:translateX(4px); opacity:1; }
        .entrar-v2-btn:active{ transform:scale(.985); }
        .entrar-v2-btn:focus-visible{ outline:none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent-cyan,var(--accent)); }

        .entrar-v2-btn-google{ background:#FFFFFF; color:#1F1F1F; border-color:rgba(0,0,0,.12); box-shadow:0 1px 2px rgba(0,0,0,.08); }
        .entrar-v2-btn-google:hover{ background:#F8F9FA; border-color:rgba(0,0,0,.18); transform:translateY(-1px); box-shadow:0 6px 18px -4px rgba(0,0,0,.18); }
        .entrar-v2-btn-linkedin{ background:#0A66C2; color:#FFFFFF; border-color:#0A66C2; box-shadow:0 1px 2px rgba(10,102,194,.25); }
        .entrar-v2-btn-linkedin:hover{ background:#004182; border-color:#004182; transform:translateY(-1px); box-shadow:0 6px 18px -4px rgba(10,102,194,.4); }
        .entrar-v2-btn-ghost{ background:var(--surface); color:var(--text); border-color:var(--border-strong); }
        .entrar-v2-btn-ghost:hover{ background:var(--surface-2); border-color:var(--accent-cyan-deep,var(--accent-deep)); color:var(--text-strong,var(--text)); }
        .entrar-v2-btn-primary{ flex:0 0 auto; width:auto; min-height:48px; padding:12px 18px; background:var(--accent-cyan,var(--primary)); color:var(--accent-on-cyan,#000); border-color:var(--accent-cyan-deep,var(--primary-deep)); font-weight:700; box-shadow:0 4px 14px -2px var(--accent-cyan-glow,transparent); }
        .entrar-v2-btn-primary:hover{ background:var(--accent-cyan-deep,var(--primary-deep)); transform:translateY(-1px); box-shadow:0 8px 22px -4px var(--accent-cyan-glow,transparent); }

        .entrar-v2-divider{ display:flex; align-items:center; gap:14px; margin:8px 0; }
        .entrar-v2-divider-line{ flex:1; height:1px; background:var(--border); }
        .entrar-v2-divider-text{ font-family:var(--mono,"JetBrains Mono",monospace); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--text-faint); }

        .entrar-v2-magic summary{ list-style:none; }
        .entrar-v2-magic summary::-webkit-details-marker{ display:none; }
        .entrar-v2-magic[open] > summary .entrar-v2-btn-arrow{ transform:rotate(90deg); opacity:1; }
        .entrar-v2-magic-form{ margin-top:12px; padding:20px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md,10px); animation:entrarV2SlideIn 240ms var(--ease-standard,cubic-bezier(.4,0,.2,1)) both; }
        @keyframes entrarV2SlideIn{ from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .entrar-v2-magic-label{ display:block; margin-bottom:8px; font-family:var(--mono,"JetBrains Mono",monospace); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--text-muted); }
        .entrar-v2-magic-row{ display:flex; gap:8px; flex-wrap:wrap; }
        .entrar-v2-magic-row .entrar-v2-input{ flex:1 1 200px; min-width:0; }
        .entrar-v2-magic-hint{ margin:12px 0 0; font-size:12.5px; color:var(--text-muted); line-height:1.5; }

        .entrar-v2-input{ width:100%; min-height:48px; padding:12px 14px; background:var(--bg); color:var(--text); border:1px solid var(--border-strong); border-radius:var(--radius-md,10px); font-family:var(--font-body,"Plus Jakarta Sans",sans-serif); font-size:15px; transition: border-color 180ms, box-shadow 180ms; }
        .entrar-v2-input::placeholder{ color:var(--text-faint); }
        .entrar-v2-input:focus{ outline:none; border-color:var(--accent-cyan-deep,var(--accent-deep)); box-shadow:0 0 0 3px var(--accent-cyan-glow,transparent); }

        .entrar-v2-dev{ margin-top:8px; padding:10px 12px; background:transparent; border:1px dashed var(--border); border-radius:var(--radius-md,10px); opacity:.5; transition: opacity 220ms var(--ease-standard,cubic-bezier(.4,0,.2,1)), border-color 220ms; }
        .entrar-v2-dev:hover, .entrar-v2-dev:focus-within{ opacity:1; border-color:var(--border-strong); }
        .entrar-v2-dev-summary{ display:inline-flex; align-items:center; gap:10px; cursor:pointer; list-style:none; font-family:var(--mono,"JetBrains Mono",monospace); font-size:12px; letter-spacing:.06em; color:var(--text-muted); }
        .entrar-v2-dev-summary::-webkit-details-marker{ display:none; }
        .entrar-v2-dev-badge{ padding:2px 6px; border-radius:var(--radius-sm,6px); background:var(--alert,var(--negative-soft)); color:var(--bg); font-size:9.5px; font-weight:700; letter-spacing:.12em; }
        .entrar-v2-dev-form{ display:grid; gap:8px; margin-top:10px; }
        .entrar-v2-dev-submit{ min-height:44px; padding:10px 16px; }

        .entrar-v2-note{ display:flex; gap:12px; align-items:flex-start; margin-bottom:24px; padding:16px 18px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--accent-cyan,var(--accent)); border-radius:var(--radius-md,10px); font-size:14px; line-height:1.55; color:var(--text-soft); }
        .entrar-v2-note b{ color:var(--text-strong,var(--text)); }
        .entrar-v2-note-check{ flex:none; display:inline-grid; place-items:center; width:24px; height:24px; border-radius:999px; background:var(--accent-cyan,var(--accent)); color:var(--accent-on-cyan,#000); font-weight:700; font-size:13px; }

        .entrar-v2-empty{ padding:20px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md,10px); }
        .entrar-v2-empty-title{ margin:0 0 6px; font-weight:600; color:var(--text-strong,var(--text)); }
        .entrar-v2-empty-body{ margin:0; font-size:14px; color:var(--text-soft); line-height:1.55; }
        .entrar-v2-empty-body a{ color:var(--text-strong,var(--text)); text-decoration:underline; text-underline-offset:3px; text-decoration-color:var(--accent-cyan,var(--accent)); }

        .entrar-v2-trust{ list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; align-items:center; gap:8px 18px; font-family:var(--mono,"JetBrains Mono",monospace); font-size:12px; letter-spacing:.04em; color:var(--text-muted); }
        .entrar-v2-trust li{ display:inline-flex; align-items:center; gap:6px; }
        .entrar-v2-trust li svg{ flex:none; color:var(--accent-cyan-deep,var(--accent-deep)); }
        .entrar-v2-trust li + li::before{ content:"·"; margin-left:-12px; margin-right:18px; color:var(--text-faint); }
        @media (max-width:480px){ .entrar-v2-trust li + li::before{ display:none; } }

        .entrar-v2-experiment{ margin:0 0 20px; font-size:14px; color:var(--text-soft); }
        .entrar-v2-experiment-link{ color:var(--text-strong,var(--text)); font-weight:600; text-decoration:none; padding-bottom:1px; border-bottom:1px solid var(--accent-cyan,var(--accent)); transition: color 180ms, border-color 180ms; }
        .entrar-v2-experiment-link:hover{ color:var(--accent-cyan-deep,var(--accent-deep)); border-bottom-color:var(--accent-cyan-deep,var(--accent-deep)); }

        .entrar-v2-legal{ margin:0; max-width:48ch; font-size:12px; color:var(--text-faint); line-height:1.6; }
        .entrar-v2-legal a{ color:var(--text-muted); text-decoration:underline; text-underline-offset:2px; text-decoration-color:var(--border-strong); }
        .entrar-v2-legal a:hover{ color:var(--text-soft); text-decoration-color:var(--text-muted); }

        @media (max-width:640px){
          .entrar-v2-main{ padding-top:32px; }
          .entrar-v2-brand{ margin-bottom:32px; }
          .entrar-v2-rule{ margin:24px 0; }
          .entrar-v2-magic-row{ flex-direction:column; }
          .entrar-v2-btn-primary{ width:100%; }
        }
        @media (prefers-reduced-motion:reduce){
          .entrar-v2-brand-dot, .entrar-v2-card, .entrar-v2-magic-form{ animation:none; }
        }

        /* Theme toggle scoped — em /entrar fica menor + opacity baixa pra
           nao competir com brand mark do header. :has() suporta caem all 2026. */
        body:has(.entrar-v2-main) .theme-toggle{ top:24px; right:24px; width:32px; height:32px; opacity:.5; transition: opacity 220ms var(--ease-standard,cubic-bezier(.4,0,.2,1)); }
        body:has(.entrar-v2-main) .theme-toggle:hover, body:has(.entrar-v2-main) .theme-toggle:focus-visible{ opacity:1; }
      `}</style>
    </main>
  );
}
