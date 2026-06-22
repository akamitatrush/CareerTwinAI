import { signIn, EMAIL_PROVIDER_ID } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Email login pode vir via Resend (prod) ou Nodemailer SMTP (dev). Qualquer um
// dos dois habilita a opcao "magic link" pro usuario.
const hasEmail = !!(
  process.env.EMAIL_FROM &&
  (process.env.AUTH_RESEND_KEY || process.env.EMAIL_SERVER)
);
const hasLinkedIn = !!(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
const hasDevCreds =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_CREDENTIALS === "true";

async function emailAction(formData) {
  "use server";
  const raw = String(formData.get("email") || "").trim().toLowerCase();
  if (!raw || raw.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    // Mensagem genérica intencional — não revela se o e-mail existe.
    return;
  }
  // Usa o id real do provider registrado (resend em prod, nodemailer em dev).
  // Sem provider configurado, EMAIL_PROVIDER_ID e null — chamar signIn aqui
  // jogaria erro, entao retornamos silencioso (mesmo padrao do email invalido).
  if (!EMAIL_PROVIDER_ID) return;
  await signIn(EMAIL_PROVIDER_ID, { email: raw, redirectTo: "/meu-gemeo" });
}

async function linkedinAction() {
  "use server";
  await signIn("linkedin", { redirectTo: "/meu-gemeo" });
}

async function devAction(formData) {
  "use server";
  const raw = String(formData.get("email") || "").trim().toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return;
  await signIn("dev", { email: raw, redirectTo: "/meu-gemeo" });
}

export default function EntrarPage({ searchParams }) {
  const enviado = searchParams?.enviado === "1";
  const noProviders = !hasEmail && !hasLinkedIn && !hasDevCreds;

  return (
    <main className="wrap entrar-wrap">
      <div className="entrar-grid">
        <section className="entrar-col-form">
          <h1 className="hero" style={{ fontSize: 38, marginBottom: 14 }}>Entrar</h1>
          <p className="hero-lede" style={{ marginBottom: 24 }}>
            Seu gêmeo de carreira fica salvo só pra você. Entre por e-mail
            (link mágico){hasLinkedIn ? " ou com sua conta do LinkedIn" : ""}.
          </p>

          {enviado && (
            <div className="note-line" style={{ marginBottom: 16 }}>
              Se houver uma conta com esse e-mail, enviamos um link de acesso. Confira sua caixa de entrada (e o spam).
            </div>
          )}

          {hasLinkedIn && (
            <>
              <form action={linkedinAction} style={{ marginBottom: 6 }}>
                <button className="btn btn-linkedin" type="submit">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                  Entrar com LinkedIn
                  <span className="arw" aria-hidden="true">→</span>
                </button>
              </form>
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: ".04em",
                  color: "var(--ink-faint)",
                  margin: "0 0 18px",
                  lineHeight: 1.5,
                }}
              >
                Mais rápido — usa seu LinkedIn pra importar perfil automaticamente.
              </p>

              {hasEmail && (
                <div className="entrar-sep" aria-hidden="true">
                  <span className="entrar-sep-line" />
                  <span className="entrar-sep-text">ou</span>
                  <span className="entrar-sep-line" />
                </div>
              )}
            </>
          )}

          {hasEmail && (
            <form action={emailAction} className="entrar-form" style={{ marginBottom: 16 }}>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={200}
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                />
              </div>
              <button className="btn btn-primary" type="submit">
                Enviar link de acesso
                <span className="arw" aria-hidden="true">→</span>
              </button>
            </form>
          )}

          {hasDevCreds && (
            <form action={devAction} className="entrar-dev">
              <p style={{ fontSize: 12, opacity: 0.8, margin: "0 0 6px" }}>
                <b>Modo dev</b> (NÃO disponível em produção): entra direto pelo e-mail.
              </p>
              <input
                name="email"
                type="email"
                required
                placeholder="dev@local"
                autoComplete="off"
              />
              <button className="btn btn-ghost" type="submit">Entrar (dev)</button>
            </form>
          )}

          {noProviders && (
            <div
              style={{
                padding: 16,
                border: "1px solid var(--rule)",
                borderRadius: 6,
                background: "var(--surface)",
              }}
            >
              <p style={{ marginTop: 0, fontWeight: 600 }}>Login em modo demo.</p>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
                Esta versão está em modo experimentar — você pode rodar o
                diagnóstico em <a href="/">/</a> sem salvar nada. Pra ativar conta e
                histórico, o admin precisa configurar um provider de email.
              </p>
            </div>
          )}

          <p className="entrar-footer">
            Só quer testar primeiro? Use o <a href="/">modo experimentar</a> — a IA
            roda de verdade mas nada é salvo.
          </p>
        </section>

        <aside className="entrar-col-card" aria-label="Por que criar conta">
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--alert)",
              margin: "0 0 12px",
            }}
          >
            Por que criar conta?
          </p>
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-.015em",
              lineHeight: 1.2,
              margin: "0 0 22px",
              color: "var(--ink)",
            }}
          >
            Tudo isso fica salvo — e <em style={{ color: "var(--alert)", fontWeight: 600 }}>seu</em>.
          </h2>

          <ul className="entrar-benefits">
            <li>
              <span className="benefit-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  <path d="M3 11h18" />
                </svg>
              </span>
              <div>
                <b>Seu gêmeo persistido</b>
                <p>
                  Diagnóstico salvo, refaz quando quiser, vê evolução do score no tempo.
                </p>
              </div>
            </li>
            <li>
              <span className="benefit-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22 6 12 13 2 6" />
                </svg>
              </span>
              <div>
                <b>Digest semanal de vagas</b>
                <p>
                  Toda segunda, vagas novas que dão match com seu perfil (Adzuna BR ·
                  Jooble · Greenhouse). Pode desligar.
                </p>
              </div>
            </li>
            <li>
              <span className="benefit-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="9" y1="4" x2="9" y2="20" />
                  <line x1="15" y1="4" x2="15" y2="20" />
                </svg>
              </span>
              <div>
                <b>Funil de candidaturas</b>
                <p>
                  Kanban: salva → aplicada → triagem → entrevista → oferta. Métricas
                  de conversão automáticas.
                </p>
              </div>
            </li>
            <li>
              <span className="benefit-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
              <div>
                <b>LGPD por construção</b>
                <p>
                  Baixar tudo em JSON ou apagar tudo em 1 clique. Sem letra miúda.
                </p>
              </div>
            </li>
          </ul>

          <p className="entrar-benefits-foot">
            Demora ~10s pra criar conta. Sem cartão, sem cobrança.
          </p>
        </aside>
      </div>

      <style>{`
        .entrar-wrap{max-width:1080px; padding-top:48px; padding-bottom:64px;}
        .entrar-grid{display:grid; grid-template-columns:1fr 1fr; gap:48px; align-items:start;}
        @media(max-width:800px){
          .entrar-grid{grid-template-columns:1fr; gap:32px;}
          .entrar-col-card{order:2;}
        }
        .entrar-col-form{max-width:480px;}
        .entrar-form{display:grid; gap:12px;}
        .entrar-form .field label{margin-bottom:7px;}
        .entrar-form input{
          width:100%;
          font-family:var(--sans);
          font-size:14.5px;
          color:var(--ink);
          background:#fff;
          border:1px solid var(--rule);
          border-radius:4px;
          padding:13px 14px;
        }
        .entrar-form input:focus{outline:none; border-color:var(--ink); box-shadow:0 0 0 3px var(--accent-wash);}
        .entrar-form .btn-primary{justify-self:start;}

        .btn-linkedin{
          width:100%;
          justify-content:center;
          background:var(--accent);
          color:var(--ink);
          border:1px solid var(--accent-deep);
          font-size:15px;
          padding:14px 22px;
          font-weight:700;
        }
        .btn-linkedin:hover{background:var(--accent-deep); color:var(--bg); border-color:var(--accent-deep);}
        .btn-linkedin:hover svg{color:var(--accent);}
        .btn-linkedin svg{color:var(--ink); transition:color .15s;}
        .btn-linkedin .arw{margin-left:auto; color:var(--ink);}
        .btn-linkedin:hover .arw{color:var(--accent);}

        .entrar-sep{
          display:flex; align-items:center; gap:12px;
          margin:18px 0 22px;
        }
        .entrar-sep-line{
          flex:1; height:1px; background:var(--rule);
        }
        .entrar-sep-text{
          font-family:var(--mono);
          font-size:10.5px;
          letter-spacing:.18em;
          text-transform:uppercase;
          color:var(--ink-faint);
        }

        .entrar-dev{
          display:grid; gap:8px;
          margin-top:24px; padding:14px;
          border:1px dashed #888;
          border-radius:8px;
        }
        .entrar-dev input{
          padding:10px;
          border-radius:8px;
          border:1px solid var(--rule);
          font-family:var(--sans);
        }

        .entrar-footer{
          margin:32px 0 0;
          padding-top:18px;
          border-top:1px solid var(--rule);
          font-family:var(--serif);
          font-style:italic;
          font-size:13.5px;
          color:var(--ink-faint);
          line-height:1.55;
          opacity:.7;
        }
        .entrar-footer a{color:var(--ink-soft); font-weight:600;}

        .entrar-col-card{
          background:var(--surface);
          border:1px solid var(--rule);
          border-radius:6px;
          padding:28px 28px 24px;
          position:sticky;
          top:32px;
        }
        @media(max-width:800px){.entrar-col-card{position:static;}}

        .entrar-benefits{
          list-style:none; padding:0; margin:0;
          display:flex; flex-direction:column; gap:18px;
        }
        .entrar-benefits li{
          display:flex; gap:14px; align-items:flex-start;
        }
        .benefit-ico{
          flex:none;
          width:34px; height:34px;
          display:grid; place-items:center;
          background:#fff;
          border:1px solid var(--rule);
          border-radius:4px;
          color:var(--ink);
        }
        .entrar-benefits li b{
          display:block;
          font-family:var(--serif);
          font-weight:700;
          font-size:15.5px;
          letter-spacing:-.01em;
          color:var(--ink);
          margin-bottom:3px;
        }
        .entrar-benefits li p{
          margin:0;
          font-size:13.5px;
          color:var(--ink-soft);
          line-height:1.5;
        }
        .entrar-benefits-foot{
          margin:22px 0 0;
          padding-top:16px;
          border-top:1px solid var(--rule);
          font-family:var(--mono);
          font-size:11px;
          letter-spacing:.06em;
          color:var(--ink-faint);
          line-height:1.55;
        }
      `}</style>
    </main>
  );
}
