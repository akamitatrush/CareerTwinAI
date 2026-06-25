import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacidade · LGPD by design — CareerTwin AI",
  description:
    "LGPD não é checklist legal, é decisão arquitetural. 21 ações auditadas, IP nunca raw, retenção declarada, export e delete em 1 click. Veja como cada decisão protege você.",
};

// ============================================================
//  Página /privacidade — refresh visual + estratégico
//  - SSR pura, sem JS de client
//  - Usa classes existentes: .ct-page-header, .ct-page-section,
//    .ct-section-eyebrow, .ct-accent-text, .ct-section-divider,
//    .ct-pulse-cyan, .ct-accent-glow
//  - Outras tabelas/cards via inline style pra evitar criar CSS novo
// ============================================================

export default function PrivacidadePage() {
  return (
    <main
      id="main-content"
      className="app-container"
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 20px 64px",
      }}
    >
      {/* === Page Header padrao === */}
      <header className="ct-page-header">
        <div className="ct-page-header-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
            <rect x="9" y="11" width="6" height="6" rx="1" />
            <path d="M11 11V9.5a1 1 0 1 1 2 0V11" />
          </svg>
        </div>
        <div className="ct-page-header-content">
          <p className="ct-page-header-eyebrow">LGPD · BY DESIGN</p>
          <h1 className="ct-page-header-title">Seus dados, suas regras</h1>
          <p className="ct-page-header-sub">
            LGPD não é checklist legal. É decisão arquitetural. Veja como cada
            decisão de código protege você — antes de qualquer compliance
            review.
          </p>
          <div className="ct-page-header-meta">
            <span>21 ações auditadas</span>
            <span>IP nunca raw</span>
            <span>Export 1-click</span>
            <span>Delete cascade</span>
          </div>
        </div>
      </header>

      <PrincipleSection />

      <hr className="ct-section-divider" />

      <AuditedActionsSection />

      <hr className="ct-section-divider" />

      <RetentionTimelineSection />

      <hr className="ct-section-divider" />

      <IpAndCookiesSection />

      <hr className="ct-section-divider" />

      <RightsOneClickSection />

      <hr className="ct-section-divider" />

      <ComparisonTableSection />

      <hr className="ct-section-divider" />

      <ProcessorsSection />

      <hr className="ct-section-divider" />

      <DpoContactSection />

      <LegalFooter />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Princípio — você é o cliente, não o produto                     */
/* ------------------------------------------------------------------ */
function PrincipleSection() {
  return (
    <section className="ct-page-section" aria-labelledby="prin-h">
      <p className="ct-section-eyebrow">Princípio editorial</p>
      <h2
        id="prin-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 14px",
          color: "var(--text-strong)",
        }}
      >
        Você é o cliente. Não é o produto.
      </h2>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text-muted)",
          margin: "0 0 12px",
          maxWidth: "65ch",
        }}
      >
        Quando uma plataforma B2C de carreira é grátis ou subsidiada por
        edtech/recrutador, o cliente é{" "}
        <span className="ct-accent-text">quem paga</span>{" "}
        — instituição de ensino, ATS, agência de RH. O seu dado vira matéria
        prima pra venda casada. É o modelo herdado.
      </p>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text-muted)",
          margin: 0,
          maxWidth: "65ch",
        }}
      >
        No CareerTwin, você paga assinatura{" "}
        <span className="ct-accent-text">direta</span>. Não tem incentivo
        nenhum pra te vender curso, pra encaminhar seu CV pra recrutador, pra
        nutrir base de e-mail de parceiro. Decide o que entra (cada fonte é
        opt-in explícito), decide o que sai (export e delete em 1 click), e
        nada disso fica escondido em SAC burocrático.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 21 ações auditadas (cards)                                      */
/* ------------------------------------------------------------------ */
function AuditedActionsSection() {
  const groups = [
    {
      title: "Autenticação",
      items: [
        { key: "LOGIN", desc: "Toda entrada na sessão" },
        { key: "LOGOUT", desc: "Encerramento explícito" },
        { key: "PASSWORD_RESET", desc: "Pedido de troca de senha" },
        { key: "ACCOUNT_CREATED", desc: "Cadastro inicial" },
        { key: "ACCOUNT_DELETED", desc: "Direito ao esquecimento exercido" },
      ],
    },
    {
      title: "LGPD · Dados pessoais",
      items: [
        { key: "DATA_EXPORTED", desc: "Você baixou seu JSON" },
        { key: "CONSENT_GRANTED", desc: "Opt-in por fonte (CV, LinkedIn, GitHub)" },
        { key: "CONSENT_REVOKED", desc: "Revogação de consentimento" },
        { key: "PROFILE_UPDATED", desc: "Edição de campos do perfil" },
        { key: "CV_UPLOADED", desc: "PDF/texto de currículo enviado" },
        { key: "CV_DELETED", desc: "CV apagado a pedido" },
      ],
    },
    {
      title: "Billing",
      items: [
        { key: "BILLING_SUBSCRIPTION_CREATED", desc: "Assinatura ativada" },
        { key: "BILLING_SUBSCRIPTION_CANCELED", desc: "Cancelamento processado" },
        { key: "BILLING_PAYMENT_FAILED", desc: "Pagamento recusado" },
      ],
    },
    {
      title: "Segurança · OWASP A09",
      items: [
        { key: "SECURITY_RATE_LIMIT_HIT", desc: "Tentativa de abuso bloqueada" },
        { key: "SECURITY_BUDGET_EXCEEDED", desc: "Orçamento de LLM excedido" },
        { key: "SECURITY_INVALID_WEBHOOK", desc: "Webhook não autenticado" },
      ],
    },
    {
      title: "Resultados de carreira",
      items: [
        { key: "OUTCOME_REPORTED", desc: "Você reportou contratação/recusa" },
        { key: "OUTCOME_SURVEY_SENT", desc: "Pesquisa de outcome disparada" },
        { key: "OUTCOME_SURVEY_DECLINED", desc: "Você optou por não responder" },
        { key: "DAILY_BRIEFING_SENT", desc: "Resumo diário enviado por e-mail" },
      ],
    },
  ];

  return (
    <section className="ct-page-section" aria-labelledby="audit-h">
      <p className="ct-section-eyebrow">Trilha de auditoria · OWASP A09</p>
      <h2
        id="audit-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        21 ações tipadas — todo acesso ao seu dado fica em log
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 18px",
          maxWidth: "60ch",
        }}
      >
        Cada evento sensível grava{" "}
        <code style={{ fontSize: 12.5 }}>userId, actorIp (hash), action, target, meta</code>.
        Resolve o gap A09 do OWASP Top 10 e dá base pra resposta a incidente.
        Você pode pedir o seu trecho por e-mail.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {groups.map((g) => (
          <article
            key={g.title}
            style={{
              padding: "14px 16px 12px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--accent-cyan-deep)",
              borderRadius: "var(--radius-lg, 12px)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 10px",
                color: "var(--text-strong)",
              }}
            >
              {g.title}{" "}
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--accent-cyan-deep)",
                  marginLeft: 4,
                }}
              >
                ({g.items.length})
              </span>
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 7,
              }}
            >
              {g.items.map((it) => (
                <li
                  key={it.key}
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: "var(--text-muted)",
                  }}
                >
                  <code
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 11.5,
                      color: "var(--text-strong)",
                      background: "var(--surface-2)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      display: "inline-block",
                      marginRight: 4,
                    }}
                  >
                    {it.key}
                  </code>
                  <span>{it.desc}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Retenção real — timeline declarada                              */
/* ------------------------------------------------------------------ */
function RetentionTimelineSection() {
  const rows = [
    {
      what: "rawCv (texto do currículo cru)",
      ttl: "90 dias",
      detail:
        "Cron de redação automática zera o texto bruto, mantém só campos estruturados.",
    },
    {
      what: "linkedinRaw (texto do LinkedIn colado)",
      ttl: "90 dias",
      detail: "Mesmo cron — redação automática após estruturação.",
    },
    {
      what: "Sessão Auth.js",
      ttl: "30 dias inativa",
      detail: "Cookie httpOnly + SameSite. Logout explícito invalida na hora.",
    },
    {
      what: "AuditLog",
      ttl: "12 meses",
      detail:
        "Trilha de eventos sensíveis. LGPD permite reter rastro mínimo legítimo.",
    },
    {
      what: "BillingEvent.payload",
      ttl: "12 meses",
      detail:
        "Webhook bruto do gateway. Após isso, só hash do payload pra reconciliação.",
    },
    {
      what: "Conta + dados estruturados",
      ttl: "até você pedir",
      detail:
        "Sem expiração automática. Você paga, você decide quando termina.",
    },
  ];

  return (
    <section className="ct-page-section" aria-labelledby="ret-h">
      <p className="ct-section-eyebrow">Retenção declarada</p>
      <h2
        id="ret-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        Quanto tempo cada coisa fica — sem letrinha miúda
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 16px",
          maxWidth: "60ch",
        }}
      >
        Cada TTL aqui tem cron rodando em produção. Não é{" "}
        <em>"prometemos apagar"</em>, é{" "}
        <em>"código apaga automaticamente"</em>.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.what}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) auto minmax(0, 2fr)",
              gap: 16,
              padding: "14px 18px",
              borderTop:
                i === 0 ? "none" : "1px dashed var(--border)",
              alignItems: "start",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "var(--text-strong)",
                lineHeight: 1.45,
              }}
            >
              {r.what}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--accent-cyan-deep)",
                background: "var(--accent-cyan-glow)",
                padding: "4px 10px",
                borderRadius: "var(--radius-pill, 999px)",
                whiteSpace: "nowrap",
                alignSelf: "start",
              }}
            >
              {r.ttl}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              {r.detail}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. IP hash + Cookie consent                                        */
/* ------------------------------------------------------------------ */
function IpAndCookiesSection() {
  return (
    <section className="ct-page-section" aria-labelledby="ip-h">
      <p className="ct-section-eyebrow">Dados técnicos</p>
      <h2
        id="ip-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 14px",
          color: "var(--text-strong)",
        }}
      >
        IP nunca raw. Tracker nenhum sem opt-in.
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        <article
          style={{
            padding: "16px 18px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--accent-cyan-deep)",
            borderRadius: "var(--radius-lg, 12px)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 700,
              margin: "0 0 8px",
              color: "var(--text-strong)",
            }}
          >
            IP hash (sha256 + salt)
          </h3>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--text-muted)",
              margin: "0 0 10px",
            }}
          >
            O endereço IP{" "}
            <span className="ct-accent-text">nunca</span>{" "}
            é armazenado em texto puro. Toda gravação passa por hash sha256
            com salt rotacionável. Rate-limit e detecção de abuso funcionam,
            geolocalização reversa não.
          </p>
          <code
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 12,
              color: "var(--text-strong)",
              background: "var(--surface-2)",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              display: "block",
              wordBreak: "break-all",
            }}
          >
            actorIp = sha256(IP + SALT) → "8f3a…b21c"
          </code>
        </article>

        <article
          style={{
            padding: "16px 18px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--accent-cyan-deep)",
            borderRadius: "var(--radius-lg, 12px)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 700,
              margin: "0 0 8px",
              color: "var(--text-strong)",
            }}
          >
            Cookie consent explícito
          </h3>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--text-muted)",
              margin: "0 0 10px",
            }}
          >
            Banner real, sem dark pattern. <em>Recusar</em> tem o mesmo peso
            visual de <em>Aceitar</em>. Estritamente necessários (Auth.js,
            tema) rodam sempre. PostHog/Sentry só carregam após opt-in.
          </p>
          <ul
            style={{
              fontSize: 12.5,
              color: "var(--text-soft)",
              paddingLeft: 18,
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            <li>Auth.js v5 cookie httpOnly · necessário</li>
            <li>Tema escuro/claro (localStorage) · necessário</li>
            <li>PostHog (analytics) · opt-in, respeita DNT</li>
            <li>Sentry (erros) · opt-in, request body filtrado</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Direitos LGPD em 1 click                                        */
/* ------------------------------------------------------------------ */
function RightsOneClickSection() {
  return (
    <section className="ct-page-section" aria-labelledby="rights-h">
      <p className="ct-section-eyebrow">Direitos LGPD · 1 click</p>
      <h2
        id="rights-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        Acesso, portabilidade, exclusão — sem SAC, sem formulário
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 16px",
          maxWidth: "60ch",
        }}
      >
        Direitos do art. 18 da LGPD executados em UI. Você não liga, não
        manda e-mail, não preenche planilha. Botão dispara, código executa.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        <RightCard
          title="Exportar tudo"
          desc="Download JSON com perfil + diagnósticos + candidaturas + consentimentos + audit log seu."
          endpoint="GET /api/me/export"
          cta="Baixar meu JSON"
          href="/meus-dados"
          variant="primary"
        />
        <RightCard
          title="Apagar tudo"
          desc="Cascade delete: snapshots, candidaturas, outcomes, consentimentos, perfil. AuditLog vira anônimo."
          endpoint="POST /meus-dados (server action)"
          cta="Ir pra Meus dados"
          href="/meus-dados"
          variant="danger"
        />
        <RightCard
          title="Corrigir / Editar"
          desc="Toda alteração em campo do perfil é versionada. Edita, vê histórico, audit log registra."
          endpoint="PATCH /api/me/preferences"
          cta="Conta"
          href="/conta"
          variant="ghost"
        />
        <RightCard
          title="Revogar fonte"
          desc="Desliga CV, LinkedIn, GitHub individualmente. Dado já estruturado fica até você pedir delete."
          endpoint="POST /api/me/preferences"
          cta="Meus dados"
          href="/meus-dados"
          variant="ghost"
        />
      </div>
    </section>
  );
}

function RightCard({ title, desc, endpoint, cta, href, variant }) {
  const accentByVariant = {
    primary: "var(--accent-cyan-deep)",
    danger: "var(--danger, #c83b3b)",
    ghost: "var(--border)",
  };
  const accent = accentByVariant[variant] || accentByVariant.ghost;

  return (
    <article
      style={{
        padding: "16px 18px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: "var(--radius-lg, 12px)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 700,
          margin: 0,
          color: "var(--text-strong)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        {desc}
      </p>
      <code
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11.5,
          color: "var(--text-soft)",
          background: "var(--surface-2)",
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid var(--border)",
          alignSelf: "start",
        }}
      >
        {endpoint}
      </code>
      <Link
        href={href}
        className="ct-accent-glow"
        style={{
          alignSelf: "start",
          padding: "8px 14px",
          background:
            variant === "primary" ? "var(--accent-cyan-deep)" : "var(--surface-2)",
          color:
            variant === "primary" ? "#fff" : "var(--text-strong)",
          border:
            variant === "primary"
              ? "1px solid var(--accent-cyan-deep)"
              : "1px solid var(--border)",
          borderRadius: "var(--radius-pill, 999px)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
          marginTop: 2,
        }}
      >
        {cta} →
      </Link>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Tabela comparativa — mercado                                    */
/* ------------------------------------------------------------------ */
function ComparisonTableSection() {
  // Critérios e verificações observáveis externamente (políticas públicas,
  // ToS, comportamento default). Sem afirmar fato interno de concorrente:
  // tudo aqui é "público" ou "não publicado abertamente" do ponto de vista do user.
  const rows = [
    {
      feature: "Hospedagem em região BR",
      values: ["parcial", "fora", "fora", "vercel · região BR"],
    },
    {
      feature: "LGPD by-design (não só ToS)",
      values: ["parcial", "GDPR-first", "não declarado", "decisão arquitetural"],
    },
    {
      feature: "Export completo 1-click",
      values: ["não", "não", "não", "sim"],
    },
    {
      feature: "Delete cascade real",
      values: ["não", "parcial", "não", "sim"],
    },
    {
      feature: "Audit log público de eventos",
      values: ["não", "não", "não", "21 ações tipadas"],
    },
    {
      feature: "IP nunca em texto puro",
      values: ["não público", "não público", "não público", "sha256 + salt"],
    },
    {
      feature: "Fórmula do score aberta",
      values: ["não", "não", "não", "docs/ALGORITHMS.md"],
    },
  ];

  const cols = ["Player edtech-IA", "Rede profissional global", "Copiloto generalista", "CareerTwin"];

  return (
    <section className="ct-page-section" aria-labelledby="comp-h">
      <p className="ct-section-eyebrow">Comparativo de mercado</p>
      <h2
        id="comp-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        Como cada padrão de mercado se posiciona em LGPD
      </h2>
      <p
        style={{
          fontSize: 13.5,
          color: "var(--text-muted)",
          margin: "0 0 14px",
          maxWidth: "65ch",
        }}
      >
        Categorias representam classes de produto, não empresas específicas.
        Avaliações partem de políticas públicas e comportamento default
        observável pelo usuário final. Se uma coluna não te representa, mande
        feedback —{" "}
        <a href="mailto:privacidade@careertwin.ai" className="ct-accent-text">
          privacidade@careertwin.ai
        </a>
        .
      </p>

      <div
        style={{
          overflowX: "auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 640,
            borderCollapse: "collapse",
            fontSize: 13.5,
          }}
        >
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--text-soft)",
                  fontWeight: 700,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                Recurso
              </th>
              {cols.map((c, i) => {
                const isUs = i === cols.length - 1;
                return (
                  <th
                    key={c}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 11,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: isUs
                        ? "var(--accent-cyan-deep)"
                        : "var(--text-soft)",
                      fontWeight: 700,
                      borderBottom: "1px solid var(--border)",
                      background: isUs ? "var(--accent-cyan-glow)" : undefined,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.feature}
                style={{
                  borderTop:
                    idx === 0 ? "none" : "1px dashed var(--border)",
                }}
              >
                <td
                  style={{
                    padding: "12px 14px",
                    color: "var(--text-strong)",
                    fontWeight: 600,
                    minWidth: 200,
                  }}
                >
                  {r.feature}
                </td>
                {r.values.map((v, i) => {
                  const isUs = i === r.values.length - 1;
                  const positive = isUs;
                  return (
                    <td
                      key={i}
                      style={{
                        padding: "12px 14px",
                        color: positive
                          ? "var(--accent-cyan-deep)"
                          : "var(--text-muted)",
                        fontWeight: positive ? 700 : 500,
                        background: isUs ? "var(--accent-cyan-glow)" : undefined,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Processadores (sub-contratados)                                 */
/* ------------------------------------------------------------------ */
function ProcessorsSection() {
  const procs = [
    {
      name: "Anthropic Claude",
      role: "LLM · análise de CV e redação de explicações",
      notes:
        "Dados enviados pra inferência. Não usados pra treinar modelos (política Anthropic).",
    },
    {
      name: "Voyage AI",
      role: "Embeddings de RAG",
      notes:
        "Vetoriza chunks de conhecimento. Não recebe seu dado pessoal — só texto de conhecimento curado pelo CareerTwin.",
    },
    {
      name: "Resend",
      role: "E-mail transacional",
      notes: "Recebe apenas seu e-mail e nome. Sem conteúdo de currículo.",
    },
    {
      name: "Sentry (opt-in)",
      role: "Rastreamento de erros",
      notes:
        "Request body filtrado, sem PII. Carrega só após você consentir cookies.",
    },
    {
      name: "PostHog (opt-in)",
      role: "Analytics anônimas",
      notes:
        "Sem PII, respeita Do Not Track. Carrega só após consentimento explícito.",
    },
    {
      name: "Adzuna, Jooble, Greenhouse",
      role: "Provedores de vagas",
      notes:
        "Recebem só o cargo-alvo. Sem identificação do usuário.",
    },
  ];

  return (
    <section className="ct-page-section" aria-labelledby="proc-h">
      <p className="ct-section-eyebrow">Sub-processadores</p>
      <h2
        id="proc-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 12px",
          color: "var(--text-strong)",
        }}
      >
        Quem mais toca o seu dado — e o quê exatamente
      </h2>
      <p
        style={{
          fontSize: 13.5,
          color: "var(--text-muted)",
          margin: "0 0 16px",
          maxWidth: "60ch",
        }}
      >
        LGPD art. 39: você tem direito de saber a cadeia de tratamento. Aqui
        está, sem letra miúda.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        {procs.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 2fr)",
              gap: 16,
              padding: "12px 18px",
              borderTop: i === 0 ? "none" : "1px dashed var(--border)",
              alignItems: "start",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13.5,
                color: "var(--text-strong)",
              }}
            >
              {p.name}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--accent-cyan-deep)",
                fontFamily: "var(--font-mono, monospace)",
                lineHeight: 1.5,
              }}
            >
              {p.role}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              {p.notes}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Contato DPO                                                     */
/* ------------------------------------------------------------------ */
function DpoContactSection() {
  return (
    <section className="ct-page-section" aria-labelledby="dpo-h">
      <p className="ct-section-eyebrow">Encarregado · DPO</p>
      <div
        style={{
          padding: "20px 22px",
          background:
            "linear-gradient(135deg, var(--accent-cyan-glow) 0%, var(--surface) 75%)",
          border: "1px solid var(--accent-cyan)",
          borderRadius: "var(--radius-lg, 12px)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2
          id="dpo-h"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-.3px",
            margin: 0,
            color: "var(--text-strong)",
          }}
        >
          Fala direto com a pessoa responsável
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text)",
            margin: 0,
            maxWidth: "60ch",
          }}
        >
          Dúvida, denúncia, exercício de direito específico, suspeita de
          vazamento. Resposta em <strong>≤ 15 dias úteis</strong> (LGPD art.
          19, § 1º).
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <a
            href="mailto:privacidade@careertwin.ai"
            className="ct-accent-glow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: "var(--accent-cyan-deep)",
              color: "#fff",
              border: "1px solid var(--accent-cyan-deep)",
              borderRadius: "var(--radius-pill, 999px)",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            privacidade@careertwin.ai
          </a>
          <a
            href="https://www.gov.br/anpd"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12.5,
              color: "var(--text-soft)",
              textDecoration: "underline",
            }}
          >
            Reclamação à ANPD (gov.br/anpd)
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Rodapé legal                                                       */
/* ------------------------------------------------------------------ */
function LegalFooter() {
  return (
    <footer
      style={{
        marginTop: 40,
        paddingTop: 20,
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 12,
        color: "var(--text-soft)",
        letterSpacing: ".04em",
      }}
    >
      <div>
        <strong>v2.0</strong> · revisado em 2026-06-23 · base: LGPD (Lei
        13.709/2018)
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <Link href="/transparencia" style={{ color: "var(--text-soft)" }}>
          /transparencia
        </Link>
        <Link href="/termos" style={{ color: "var(--text-soft)" }}>
          /termos
        </Link>
        <Link href="/meus-dados" style={{ color: "var(--text-soft)" }}>
          /meus-dados
        </Link>
      </div>
    </footer>
  );
}
