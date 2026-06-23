import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Política de Privacidade — CareerTwin AI",
  description:
    "Como o CareerTwin AI coleta, usa e protege seus dados. Conforme LGPD (Lei 13.709/2018).",
};

const wrapStyle = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "40px 24px 64px",
  background: "var(--bg, #F6F5F2)",
  color: "var(--text, #1F1D33)",
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif)",
  lineHeight: 1.65,
};

const backLinkStyle = {
  display: "inline-block",
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--text-muted, #514E5C)",
  textDecoration: "none",
  marginBottom: 28,
};

const h1Style = {
  fontFamily: "var(--font-display, 'Spectral', Georgia, serif)",
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: "-.015em",
  lineHeight: 1.2,
  margin: "0 0 12px",
};

const metaStyle = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: 11.5,
  letterSpacing: ".04em",
  color: "var(--text-soft, #797585)",
  margin: "0 0 32px",
};

const h2Style = {
  fontFamily: "var(--font-display, 'Spectral', Georgia, serif)",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-.01em",
  margin: "28px 0 10px",
};

const pStyle = { margin: "0 0 14px", fontSize: 15 };
const ulStyle = { margin: "0 0 14px", paddingLeft: 22, fontSize: 15 };
const liStyle = { marginBottom: 6 };

const footerNoteStyle = {
  marginTop: 40,
  paddingTop: 20,
  borderTop: "1px solid var(--border, #E7E4EC)",
  fontStyle: "italic",
  fontSize: 13,
  color: "var(--text-soft, #797585)",
};

export default function PrivacidadePage() {
  return (
    <main style={wrapStyle}>
      <Link href="/" style={backLinkStyle}>
        ← Voltar
      </Link>

      <h1 style={h1Style}>Política de Privacidade</h1>
      <p style={metaStyle}>
        <b>Última revisão:</b> 2026-06-22 · <b>Versão:</b> 1.0 (estágio inicial)
      </p>

      <h2 style={h2Style}>1. Quem somos</h2>
      <p style={pStyle}>
        CareerTwin AI é um produto em fase MVP de copiloto de empregabilidade.
        Esta política descreve quais dados coletamos, como usamos e os seus
        direitos sob a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2 style={h2Style}>2. Dados que coletamos</h2>
      <ul style={ulStyle}>
        <li style={liStyle}>
          <b>Identificação:</b> nome, e-mail (quando você cria conta)
        </li>
        <li style={liStyle}>
          <b>Currículo:</b> texto que você cola, PDFs que envia, texto do
          LinkedIn que cola
        </li>
        <li style={liStyle}>
          <b>Portfolio:</b> usuário do GitHub que você informa, URLs públicas
          que você fornece
        </li>
        <li style={liStyle}>
          <b>Uso do produto:</b> diagnósticos realizados, candidaturas
          registradas, microações marcadas como concluídas
        </li>
        <li style={liStyle}>
          <b>Dados técnicos:</b> IP, navegador, eventos anônimos de uso
          (PostHog, com respeito a DNT)
        </li>
      </ul>

      <h2 style={h2Style}>3. Finalidade do uso</h2>
      <ul style={ulStyle}>
        <li style={liStyle}>
          Gerar diagnóstico de carreira personalizado (LLM analisa seu CV)
        </li>
        <li style={liStyle}>
          Recomendar vagas reais que dão match com seu perfil
        </li>
        <li style={liStyle}>
          Acompanhar evolução do seu score ao longo do tempo
        </li>
        <li style={liStyle}>Enviar digest semanal de vagas, se você optar</li>
        <li style={liStyle}>Melhorar o produto (análise agregada, sem PII)</li>
      </ul>

      <h2 style={h2Style}>4. Base legal (LGPD Art. 7º)</h2>
      <p style={pStyle}>
        Coletamos e processamos seus dados com base em{" "}
        <b>consentimento explícito</b> (você ativa cada fonte: CV, LinkedIn,
        GitHub). Você pode revogar a qualquer momento em{" "}
        <Link href="/meus-dados">/meus-dados</Link>.
      </p>

      <h2 style={h2Style}>5. Compartilhamento</h2>
      <p style={pStyle}>
        Seus dados <b>nunca</b> são vendidos. Compartilhamos apenas com
        processadores essenciais:
      </p>
      <ul style={ulStyle}>
        <li style={liStyle}>
          <b>Anthropic Claude</b> (análise de CV via API) — dados são enviados
          para inferência, não são usados pra treinar modelos
        </li>
        <li style={liStyle}>
          <b>Resend</b> (envio de e-mail transacional) — apenas e-mail e nome
        </li>
        <li style={liStyle}>
          <b>Sentry</b> (rastreamento de erros) — sem PII, request body é
          filtrado
        </li>
        <li style={liStyle}>
          <b>PostHog</b> (analytics anônimas) — sem PII, respeita Do Not Track
        </li>
        <li style={liStyle}>
          <b>Provedores de vagas</b> (Adzuna, Jooble, Greenhouse) — apenas o
          cargo-alvo, sem identificação
        </li>
      </ul>

      <h2 style={h2Style}>6. Retenção</h2>
      <p style={pStyle}>
        Dados ficam armazenados enquanto sua conta está ativa. Ao apagar a
        conta em <Link href="/meus-dados">/meus-dados</Link>, todos os dados
        são removidos em cascata (snapshots, candidaturas, consentimentos,
        perfil) e não ficam em backup acessível.
      </p>

      <h2 style={h2Style}>7. Seus direitos (LGPD Art. 18)</h2>
      <ul style={ulStyle}>
        <li style={liStyle}>Confirmação da existência do tratamento</li>
        <li style={liStyle}>
          Acesso aos dados → <Link href="/meus-dados">/meus-dados</Link>{" "}
          permite ver e baixar tudo em JSON
        </li>
        <li style={liStyle}>
          Correção de dados incompletos ou inexatos → edite em{" "}
          <Link href="/conta">/conta</Link>
        </li>
        <li style={liStyle}>
          Eliminação (apagar tudo) → botão em{" "}
          <Link href="/meus-dados">/meus-dados</Link>
        </li>
        <li style={liStyle}>
          Portabilidade → baixar JSON em{" "}
          <Link href="/meus-dados">/meus-dados</Link>
        </li>
        <li style={liStyle}>
          Revogação do consentimento → desativar fonte em{" "}
          <Link href="/meus-dados">/meus-dados</Link>
        </li>
      </ul>

      <h2 style={h2Style}>8. Cookies</h2>
      <p style={pStyle}>
        Usamos cookies estritamente necessários para autenticação (Auth.js v5)
        e armazenamento da preferência de tema. Não usamos cookies de
        rastreamento de terceiros. PostHog usa localStorage com respeito a Do
        Not Track.
      </p>

      <h2 style={h2Style}>9. Contato</h2>
      <p style={pStyle}>
        Para questões de privacidade ou exercer seus direitos, contate:{" "}
        <b>sergio@lognullsec.com</b>.
      </p>
      <p style={pStyle}>
        Para dúvidas sobre LGPD em geral, você pode contatar a Autoridade
        Nacional de Proteção de Dados (ANPD) em{" "}
        <a
          href="https://www.gov.br/anpd"
          target="_blank"
          rel="noopener noreferrer"
        >
          gov.br/anpd
        </a>
        .
      </p>

      <h2 style={h2Style}>10. Mudanças nesta política</h2>
      <p style={pStyle}>
        Esta é a versão 1.0 (MVP). Atualizações serão notificadas via e-mail
        e/ou aviso no app antes de entrarem em vigor.
      </p>

      <p style={footerNoteStyle}>
        <em>
          Esta política está em estado MVP. Recomendamos revisão por advogado
          especializado em LGPD antes de uso comercial em escala.
        </em>
      </p>
    </main>
  );
}
