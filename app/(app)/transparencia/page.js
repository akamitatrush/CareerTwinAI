import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WEIGHTS, SS_META } from "@/lib/score";
import AlgorithmDisclaimer from "@/components/AlgorithmDisclaimer";

// Auth + Prisma sao dinamicos; layout (app) ja forca isso, mas reforcamos
// aqui pra deixar explicito: a pagina LE dado do usuario.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transparência — CareerTwin AI",
  description:
    "Como o Career Health Score é calculado: fórmula auditável, RAG com fonte rastreável e exemplos numéricos reproduzíveis. Sem caixa-preta.",
};

// Ordem fixa dos sub-scores (combina com WEIGHTS) — usada na tabela da formula.
const SS_KEYS = [
  "aderencia_vagas",
  "relevancia_habilidades",
  "otimizacao_perfil",
  "experiencia_mercado",
];

export default async function TransparenciaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // Pega ultimo snapshot do user (se houver) pra mostrar valores reais.
  // Em ausencia de snapshot, a tabela renderiza "—" e a tela vira pura
  // explicacao da formula — util pra usuario antes do primeiro diagnostico.
  // Defensivo contra DB fora do ar: nao queremos derrubar a pagina de
  // explicacao por causa do banco.
  let latest = null;
  try {
    latest = await prisma.scoreSnapshot.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { overall: true, subScores: true },
    });
  } catch {
    latest = null;
  }

  const subScores = latest?.subScores || null;
  const overall = latest?.overall ?? null;

  return (
    <main id="main-content" className="app-container">
      {/* === Page Header padrao (.ct-page-header) === */}
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
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </div>
        <div className="ct-page-header-content">
          <p className="ct-page-header-eyebrow">AUDITÁVEL · CIENTÍFICO</p>
          <h1 className="ct-page-header-title">
            Como funciona o Career Health Score
          </h1>
          <p className="ct-page-header-sub">
            Toda nota tem fórmula explícita. Sem caixa-preta, sem alucinação de
            IA. Você pode auditar cada cálculo — no papel, se quiser.
          </p>
          <div className="ct-page-header-meta">
            <span>4 sub-scores ponderados</span>
            <span>RAG com fonte rastreável</span>
            <span>Recall@3 93.9%</span>
          </div>
        </div>
      </header>

      {/* LGPD Art. 20 — disclaimer compacto, redundante mas obrigatorio:
          o usuario que chega em /transparencia ja esta vendo a formula,
          mas a microcopy do direito a revisao precisa estar aqui tambem. */}
      <AlgorithmDisclaimer variant="compact" />

      {/* === 1. Tese editorial === */}
      <ThesisSection />

      <hr className="ct-section-divider" />

      {/* === 2. Os 4 sub-scores === */}
      <SubScoresGrid />

      <hr className="ct-section-divider" />

      {/* === 3. Exemplo numérico reprodutível === */}
      <WorkedExample />

      <hr className="ct-section-divider" />

      {/* === 4. Tabela com os SEUS valores reais === */}
      <YourScoreSection subScores={subScores} overall={overall} />

      <hr className="ct-section-divider" />

      {/* === 5. RAG: IA com fonte rastreável === */}
      <RagSection />

      <hr className="ct-section-divider" />

      {/* === 6. Mediana de mercado === */}
      <MedianSection />

      <hr className="ct-section-divider" />

      {/* === 7. Docs técnicos === */}
      <DocsSection />

      {/* === 8. Por que isso importa (CTA / highlight) === */}
      <WhyItMattersBanner />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Tese editorial                                                  */
/* ------------------------------------------------------------------ */
function ThesisSection() {
  return (
    <section className="ct-page-section" aria-labelledby="tese-h">
      <p className="ct-section-eyebrow">Tese editorial</p>
      <h2
        id="tese-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 14px",
          color: "var(--text-strong)",
        }}
      >
        Número é matemática. Texto é IA com fonte.
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
        Toda nota que você vê no CareerTwin sai de uma{" "}
        <span className="ct-accent-text">fórmula determinística</span>{" "}
        sobre dados estruturados — currículo normalizado, vagas reais coletadas,
        taxonomia de skills. Rodada hoje ou daqui a um mês, com os mesmos dados
        de entrada, o resultado é idêntico. LLM nenhuma decide o seu score.
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
        O modelo de linguagem só entra depois — pra{" "}
        <span className="ct-accent-text">redigir a explicação</span>{" "}
        do que o cálculo já definiu, sempre amarrado às fontes. É o oposto de
        copiloto de carreira tipo "ChatGPT wrapper" (caixa-preta opaca, número
        inventado a cada chat) e de plataforma com IA proprietária fechada.
        Aqui, qualquer auditor — você inclusive — reproduz o cálculo.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 4 sub-scores em grid                                            */
/* ------------------------------------------------------------------ */
function SubScoresGrid() {
  const cards = [
    {
      key: "aderencia_vagas",
      title: SS_META.aderencia_vagas.label,
      weight: SS_META.aderencia_vagas.w,
      formula:
        "0,40 · skills_cover  +  0,40 · seniority_match  +  0,20 · year_range_match",
      desc:
        "Quanto seu perfil bate com as exigências reais das vagas do cargo-alvo. Considera intersecção de skills, faixa de senioridade declarada vs exigida, e janela de anos de experiência.",
    },
    {
      key: "relevancia_habilidades",
      title: SS_META.relevancia_habilidades.label,
      weight: SS_META.relevancia_habilidades.w,
      formula:
        "|skills_perfil ∩ top18_requisitos_mercado|  /  |top18_requisitos_mercado|",
      desc:
        "Suas skills declaradas comparadas com as 18 mais pedidas no mercado pro seu cargo-alvo (calculado em cima das vagas coletadas, não opinião do autor).",
    },
    {
      key: "otimizacao_perfil",
      title: SS_META.otimizacao_perfil.label,
      weight: SS_META.otimizacao_perfil.w,
      formula:
        "0,55 · completude_campos  +  0,45 · qualidade_bullets_CV",
      desc:
        "Mede campos essenciais preenchidos (cargo, anos, skills, formação) + qualidade dos bullets do CV (verbo de ação + métrica + contexto, padrão CAR/STAR).",
    },
    {
      key: "experiencia_mercado",
      title: SS_META.experiencia_mercado.label,
      weight: SS_META.experiencia_mercado.w,
      formula:
        "f(anos_experiencia, senioridade_declarada)  →  curva normalizada 0–100",
      desc:
        "Casa anos de experiência com a senioridade declarada (júnior 0–2, pleno 3–5, sênior 5+). Penaliza inconsistência declarada vs cargo-alvo.",
    },
  ];

  return (
    <section className="ct-page-section" aria-labelledby="sub-h">
      <p className="ct-section-eyebrow">Os 4 sub-scores</p>
      <h2
        id="sub-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        Cada nota é uma média ponderada de 4 dimensões
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 18px",
          maxWidth: "60ch",
        }}
      >
        Os pesos refletem o quanto cada dimensão influencia a chance de
        contratação no mercado BR. Cada sub-score vai de 0 a 100.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {cards.map((c) => (
          <article
            key={c.key}
            style={{
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--accent-cyan-deep)",
              borderRadius: "var(--radius-lg, 12px)",
              padding: "16px 16px 14px",
              background: "var(--surface)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--text-strong)",
                  letterSpacing: "-.2px",
                }}
              >
                {c.title}
              </h3>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--accent-cyan-deep)",
                  fontWeight: 700,
                  padding: "3px 9px",
                  background: "var(--accent-cyan-glow)",
                  borderRadius: "var(--radius-pill, 999px)",
                  whiteSpace: "nowrap",
                }}
              >
                peso {c.weight}
              </span>
            </div>
            <code
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12.5,
                color: "var(--text-strong)",
                background: "var(--surface-2)",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                display: "block",
                lineHeight: 1.5,
                overflowX: "auto",
              }}
            >
              {c.formula}
            </code>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              {c.desc}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Exemplo numérico reprodutível                                   */
/* ------------------------------------------------------------------ */
function WorkedExample() {
  return (
    <section className="ct-page-section" aria-labelledby="ex-h">
      <p className="ct-section-eyebrow">Exemplo reproduzível</p>
      <h2
        id="ex-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        Cálculo passo a passo: você reproduz no papel
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 16px",
          maxWidth: "60ch",
        }}
      >
        Perfil de exemplo:{" "}
        <strong style={{ color: "var(--text-strong)" }}>
          5 anos backend, 3 skills (Python, AWS, Docker), cargo-alvo "Backend
          Sr"
        </strong>
        . O cargo-alvo no mercado pede{" "}
        <strong style={{ color: "var(--text-strong)" }}>
          Python, AWS, Kubernetes
        </strong>{" "}
        e 5+ anos.
      </p>

      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "18px 20px",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 13,
          lineHeight: 1.75,
          color: "var(--text)",
          overflowX: "auto",
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: "var(--accent-cyan-deep)", fontWeight: 700 }}>
            # 1) Aderência (peso 40%)
          </span>
          <br />
          skills_cover     = 2/3        = 0,667   (Python ✓, AWS ✓, K8s ✗)
          <br />
          seniority_match  = 1,0        (declarei Sr, vaga pede Sr)
          <br />
          year_range_match = 1,0        (5 anos cabem em 5+)
          <br />
          <strong>
            aderencia = 0,40·0,667 + 0,40·1,0 + 0,20·1,0 = 0,867 → 87
          </strong>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={{ color: "var(--accent-cyan-deep)", fontWeight: 700 }}>
            # 2) Relevância (peso 30%)
          </span>
          <br />
          skills_perfil ∩ top18_mercado = &#123;Python, AWS, Docker&#125; ∩
          &#123;Python, AWS, K8s, Terraform, …&#125; = 2
          <br />
          <strong>relevancia = 2/18 = 0,11 → 11 (gap real de mercado)</strong>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={{ color: "var(--accent-cyan-deep)", fontWeight: 700 }}>
            # 3) Otimização do perfil (peso 20%)
          </span>
          <br />
          completude_campos      = 0,90 (cargo, anos, skills, formação ok)
          <br />
          qualidade_bullets_CV   = 0,75 (CAR/STAR parcial em 3 de 4 bullets)
          <br />
          <strong>otimizacao = 0,55·0,90 + 0,45·0,75 = 0,832 → 83</strong>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={{ color: "var(--accent-cyan-deep)", fontWeight: 700 }}>
            # 4) Experiência de mercado (peso 10%)
          </span>
          <br />
          5 anos · senioridade Sr declarada → curva normalizada ={" "}
          <strong>78</strong>
        </div>

        <hr
          style={{
            border: 0,
            borderTop: "1px dashed var(--border)",
            margin: "14px 0",
          }}
        />

        <div>
          <span style={{ color: "var(--accent-cyan-deep)", fontWeight: 700 }}>
            # Overall (média ponderada)
          </span>
          <br />
          0,40·87 + 0,30·11 + 0,20·83 + 0,10·78 = 34,8 + 3,3 + 16,6 + 7,8
          <br />
          <strong style={{ fontSize: 14 }}>
            = 62 / 100  →  gargalo claro = Relevância (faltam K8s, Terraform)
          </strong>
        </div>
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--text-soft)",
          margin: "14px 0 0",
          fontStyle: "italic",
        }}
      >
        Esse cálculo roda em <code>lib/scoring/subscores.js</code> — código
        aberto no repositório. Inputs idênticos, output idêntico. Sem
        randomização, sem "temperatura".
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Seu Score real                                                  */
/* ------------------------------------------------------------------ */
function YourScoreSection({ subScores, overall }) {
  return (
    <section className="ct-page-section" aria-labelledby="seu-h">
      <p className="ct-section-eyebrow">Seu cálculo agora</p>
      <h2
        id="seu-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        {overall
          ? `Sua Saúde da carreira hoje: ${overall} /100`
          : "Sua Saúde da carreira aparece aqui após o primeiro diagnóstico"}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 16px",
          maxWidth: "60ch",
        }}
      >
        Mesma fórmula do exemplo acima, aplicada nos seus dados estruturados.
        Cada barra mostra a contribuição do sub-score no overall.
      </p>
      <FormulaTable subScores={subScores} overall={overall} />
    </section>
  );
}

// FormulaTable: 4 linhas (uma por sub-score) + total ponderado.
// Quando nao ha snapshot, mostra "—" no lugar do valor e da contribuicao.
function FormulaTable({ subScores, overall }) {
  return (
    <div className="ct-formula-card">
      {SS_KEYS.map((k) => {
        const meta = SS_META[k];
        const raw = subScores?.[k]?.valor;
        const v = typeof raw === "number" ? raw : null;
        const weight = (WEIGHTS[k] * 100).toFixed(0);
        const contrib = v !== null ? (v * WEIGHTS[k]).toFixed(1) : null;

        return (
          <div key={k} className="ct-formula-row">
            <div className="ct-formula-weight" aria-hidden="true">
              <div className="ct-formula-weight-label">peso</div>
              <div className="ct-formula-weight-value">{weight}%</div>
            </div>
            <div className="ct-formula-main">
              <div className="ct-formula-head">
                <span className="ct-formula-label">{meta.label}</span>
                <span className="ct-formula-value">
                  {v !== null ? v : "—"}
                </span>
              </div>
              <div
                className="ct-formula-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={v ?? 0}
                aria-label={`${meta.label}: ${v !== null ? v : "sem dado"}`}
              >
                <div
                  className="ct-formula-bar-fill"
                  style={{ width: v !== null ? `${v}%` : "0%" }}
                />
              </div>
              <p className="ct-formula-text">
                <span style={{ fontWeight: 700, color: "var(--text)" }}>
                  Cálculo:
                </span>{" "}
                {v !== null
                  ? `${v} × ${WEIGHTS[k]} (peso) = ${contrib} pts no score final`
                  : `peso de ${weight}% — rode um diagnóstico pra ver o valor real`}
              </p>
            </div>
          </div>
        );
      })}

      <div className="ct-formula-total">
        <div style={{ width: 56 }} aria-hidden="true" />
        <div className="ct-formula-total-label">
          Saúde da carreira{" "}
          <span style={{ fontWeight: 600, color: "var(--text-soft)" }}>
            = média ponderada
          </span>
        </div>
        <div className="ct-formula-total-value">
          <span>{overall ?? "—"}</span>
          <span
            style={{ fontSize: 13, color: "var(--text-soft)", fontWeight: 700 }}
          >
            /100
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. RAG: IA com fonte rastreável                                    */
/* ------------------------------------------------------------------ */
function RagSection() {
  const stats = [
    {
      label: "chunks curados",
      value: "159",
      desc: "BR-first: CLT, PJ, MEI, concursos, setor regulado",
    },
    {
      label: "embeddings",
      value: "Voyage-3",
      desc: "voyage-3-large · 1024 dimensões",
    },
    {
      label: "índice vetorial",
      value: "pgvector",
      desc: "HNSW · cosine · híbrido com BM25-lite (RRF k=60)",
    },
    {
      label: "Recall@3",
      value: "93,9%",
      desc: "medido em 50 queries de avaliação real",
    },
  ];

  return (
    <section className="ct-page-section" aria-labelledby="rag-h">
      <p className="ct-section-eyebrow">RAG · IA com fonte rastreável</p>
      <h2
        id="rag-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 12px",
          color: "var(--text-strong)",
        }}
      >
        Toda recomendação cita a fonte — clicável
      </h2>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text-muted)",
          margin: "0 0 16px",
          maxWidth: "65ch",
        }}
      >
        Quando o produto sugere "use método CAR/STAR pros seus bullets" ou
        "pleno backend BR 2025 paga R$ X", a frase é{" "}
        <span className="ct-accent-text">
          ancorada num chunk de conhecimento
        </span>{" "}
        recuperado por busca vetorial híbrida. Sem fonte recuperada, a IA não
        responde — fail-closed.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "14px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg, 12px)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10.5,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--accent-cyan-deep)",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-strong)",
                letterSpacing: "-.3px",
                marginBottom: 4,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                lineHeight: 1.45,
              }}
            >
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--text-soft)",
          margin: 0,
          padding: "12px 14px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent-cyan)",
          borderRadius: 8,
        }}
      >
        Exemplo real: a sugestão{" "}
        <em>"reescreva bullets com verbo de ação + métrica"</em> sai do chunk{" "}
        <code
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            padding: "1px 6px",
            background: "var(--surface)",
            borderRadius: 4,
            border: "1px solid var(--border)",
          }}
        >
          tera_mentoria_cv_bullets_2025
        </code>{" "}
        — fonte aparece embaixo da resposta, com link pro material original.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Mediana de mercado                                              */
/* ------------------------------------------------------------------ */
function MedianSection() {
  return (
    <section className="ct-page-section" aria-labelledby="med-h">
      <p className="ct-section-eyebrow">Mediana de mercado</p>
      <h2
        id="med-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 12px",
          color: "var(--text-strong)",
        }}
      >
        Onde estão os contratados? Verdade sobre o estágio atual.
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
        A mediana de score "de quem foi contratado" só vira número real quando
        coletamos ≥ 50 outcomes de contratação reportados pelos usuários. Até
        lá, é <span className="ct-accent-text">stub declarado</span>{" "}
        (HIRED_MEDIAN = 78), pra dar referência visual sem prometer ciência que
        ainda não temos.
      </p>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text-soft)",
          margin: 0,
          fontStyle: "italic",
          maxWidth: "65ch",
        }}
      >
        Preferimos dizer "ainda em construção" do que fingir base estatística
        inexistente. É a antítese do "+90% de empregabilidade" que black-box de
        concorrentes promete sem fonte.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Docs técnicos                                                   */
/* ------------------------------------------------------------------ */
function DocsSection() {
  return (
    <section className="ct-page-section" aria-labelledby="docs-h">
      <p className="ct-section-eyebrow">Documentação técnica</p>
      <h2
        id="docs-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-.4px",
          margin: "0 0 12px",
          color: "var(--text-strong)",
        }}
      >
        Quer ver o código? Está tudo aberto.
      </h2>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.6,
          color: "var(--text-muted)",
          margin: "0 0 14px",
          maxWidth: "65ch",
        }}
      >
        Fórmulas completas em <code>docs/ALGORITHMS.md</code>, pesos em{" "}
        <code>lib/score.js</code>, sub-scores detalhados em{" "}
        <code>lib/scoring/subscores.js</code>.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <a
          href="https://github.com/akamitatrush/CareerTwinAI"
          target="_blank"
          rel="noopener noreferrer"
          className="ct-accent-glow"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-pill, 999px)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-strong)",
            textDecoration: "none",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.6 18.4.5 12 .5z" />
          </svg>
          GitHub · CareerTwinAI
        </a>
        <Link
          href="/privacidade"
          className="ct-accent-glow"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-pill, 999px)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-strong)",
            textDecoration: "none",
          }}
        >
          LGPD by-design →
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Por que isso importa                                            */
/* ------------------------------------------------------------------ */
function WhyItMattersBanner() {
  return (
    <aside
      role="note"
      aria-label="Por que auditabilidade importa"
      className="ct-pulse-cyan"
      style={{
        marginTop: 32,
        padding: "22px 24px",
        background:
          "linear-gradient(135deg, var(--accent-cyan-glow) 0%, var(--surface) 70%)",
        border: "1px solid var(--accent-cyan)",
        borderRadius: "var(--radius-lg, 12px)",
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-cyan-deep)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: "none", marginTop: 2 }}
        aria-hidden="true"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-.3px",
            margin: "0 0 6px",
            color: "var(--text-strong)",
          }}
        >
          Por que isso importa
        </p>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--text)",
            margin: 0,
            maxWidth: "60ch",
          }}
        >
          Você paga R$ 40–80/mês por uma plataforma de copiloto. Sem fórmula
          explícita, é só ChatGPT customizado com branding bonito —{" "}
          <span className="ct-accent-text">
            qualquer número vira fé, não evidência
          </span>
          . Aqui você valida cada cálculo, no papel se quiser. Esse é o moat.
        </p>
      </div>
    </aside>
  );
}
