import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Termos de Uso — CareerTwin AI",
  description:
    "Termos de uso do CareerTwin AI: o que oferecemos, uso aceitável e limitação de responsabilidade.",
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

export default function TermosPage() {
  return (
    <main style={wrapStyle}>
      <Link href="/" style={backLinkStyle}>
        ← Voltar
      </Link>

      <h1 style={h1Style}>Termos de Uso</h1>
      <p style={metaStyle}>
        <b>Última revisão:</b> 2026-06-22 · <b>Versão:</b> 1.0 (estágio inicial)
      </p>

      <h2 style={h2Style}>1. Aceite</h2>
      <p style={pStyle}>
        Ao criar conta ou usar o CareerTwin AI, você concorda com estes termos
        e com a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2 style={h2Style}>2. O que oferecemos</h2>
      <p style={pStyle}>
        CareerTwin AI é uma ferramenta em fase MVP que utiliza inteligência
        artificial para diagnosticar perfil de carreira, sugerir lacunas e
        recomendar vagas reais. Não somos uma agência de recolocação. Não
        garantimos contratação.
      </p>

      <h2 style={h2Style}>3. Uso aceitável</h2>
      <p style={pStyle}>
        Você concorda em <b>não</b>:
      </p>
      <ul style={ulStyle}>
        <li style={liStyle}>
          Usar o produto para automatizar candidaturas em massa sem revisão
          humana
        </li>
        <li style={liStyle}>Inserir CVs de terceiros sem autorização</li>
        <li style={liStyle}>
          Tentar contornar limites de rate limit, autenticação ou outras
          medidas de segurança
        </li>
        <li style={liStyle}>
          Usar a IA para criar conteúdo falso (experiências, conquistas) — o
          produto explicitamente alerta contra isso, mas a responsabilidade
          final é sua
        </li>
      </ul>

      <h2 style={h2Style}>4. Autenticidade</h2>
      <p style={pStyle}>
        O CareerTwin é projetado para gerar diagnósticos a partir de
        informações reais que você fornece. A IA é instruída a NÃO inventar
        conquistas ou métricas, mas LLMs ocasionalmente erram.{" "}
        <b>
          Você é responsável por revisar qualquer conteúdo gerado antes de
          usá-lo profissionalmente (CV adaptado, respostas de entrevista, etc).
        </b>
      </p>

      <h2 style={h2Style}>5. Limitação de responsabilidade</h2>
      <p style={pStyle}>
        O CareerTwin é fornecido "como está". Não nos responsabilizamos por:
      </p>
      <ul style={ulStyle}>
        <li style={liStyle}>
          Decisões de carreira tomadas com base nos diagnósticos
        </li>
        <li style={liStyle}>
          Vagas indisponíveis ou desatualizadas listadas por integrações de
          terceiros
        </li>
        <li style={liStyle}>
          Falhas temporárias do serviço, da LLM provider, ou de provedores de
          vagas
        </li>
      </ul>

      <h2 style={h2Style}>6. Modificações</h2>
      <p style={pStyle}>
        Podemos modificar estes termos a qualquer momento. Mudanças
        significativas serão notificadas com antecedência. Continuar usando o
        produto após mudança configura aceite.
      </p>

      <h2 style={h2Style}>7. Encerramento</h2>
      <p style={pStyle}>
        Você pode encerrar sua conta a qualquer momento em{" "}
        <Link href="/meus-dados">/meus-dados</Link>. Podemos suspender contas
        que violem estes termos, com aviso prévio quando possível.
      </p>

      <h2 style={h2Style}>8. Lei aplicável</h2>
      <p style={pStyle}>
        Estes termos são regidos pelas leis brasileiras. Foro: comarca de São
        Paulo, SP.
      </p>

      <h2 style={h2Style}>9. Contato</h2>
      <p style={pStyle}>
        Questões sobre estes termos: <b>sergio@lognullsec.com</b>.
      </p>

      <p style={footerNoteStyle}>
        <em>
          Esta versão dos termos está em estágio MVP. Para uso comercial em
          escala, recomendamos revisão por advogado.
        </em>
      </p>
    </main>
  );
}
