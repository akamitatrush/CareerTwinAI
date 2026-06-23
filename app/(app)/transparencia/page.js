import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WEIGHTS, SS_META } from "@/lib/score";

// Auth + Prisma sao dinamicos; layout (app) ja forca isso, mas reforcamos
// aqui pra deixar explicito: a pagina LE dado do usuario.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transparência — CareerTwin AI",
  description:
    "Como a Saúde da carreira é calculada: fórmula auditável, fontes de dados e política de uso de dados.",
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
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            color: "var(--text-soft)",
            fontStyle: "italic",
          }}
        >
          Transparência
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-.6px",
            marginTop: 2,
            color: "var(--text)",
          }}
        >
          Por que você pode confiar nesse número
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--text-muted)",
            marginTop: 6,
            maxWidth: 640,
            lineHeight: 1.55,
          }}
        >
          Nenhum score aqui sai de uma caixa-preta. A regra que seguimos em todo
          o produto é simples — e está explicada abaixo.
        </p>
      </div>

      <PrincipleCard />

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          marginTop: 32,
          marginBottom: 4,
          color: "var(--text)",
        }}
      >
        {overall
          ? `Como a sua Saúde da carreira (${overall}) é montada`
          : "Como a Saúde da carreira é montada"}
      </h2>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--text-muted)",
          marginBottom: 14,
        }}
      >
        Média ponderada de 4 sub-scores. O peso reflete o quanto cada dimensão
        influencia a sua chance de contratação.
      </p>
      <FormulaTable subScores={subScores} overall={overall} />

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          marginTop: 32,
          marginBottom: 14,
          color: "var(--text)",
        }}
      >
        De onde vêm os dados
      </h2>
      <DataSourcesGrid />

      <LGPDBanner />
    </main>
  );
}

// PrincipleCard — gradient indigo + duas colunas com icone e texto.
function PrincipleCard() {
  return (
    <div className="ct-principle-card">
      <div className="ct-principle-col">
        <div className="ct-principle-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <path d="M9 6h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h6" />
          </svg>
        </div>
        <div>
          <div className="ct-principle-title">Número = cálculo auditável</div>
          <p className="ct-principle-text">
            Cada score é uma fórmula determinística sobre dados reais. Roda
            igual toda vez e dá pra rastrear exatamente o que puxou pra cima ou
            pra baixo.
          </p>
        </div>
      </div>
      <div className="ct-principle-col">
        <div className="ct-principle-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-1L3 20l1.1-4A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
          </svg>
        </div>
        <div>
          <div className="ct-principle-title">Texto = explicação com fonte</div>
          <p className="ct-principle-text">
            A IA só redige a explicação a partir dos dados já calculados e
            sempre cita a origem. Ela nunca inventa nem arredonda o número.
          </p>
        </div>
      </div>
    </div>
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

function DataSourcesGrid() {
  const sources = [
    {
      title: "Vagas reais",
      desc: "Vagas coletadas no Brasil via Adzuna, Jooble e Greenhouse ATS. Cada exigência é contada e ligada à sua fonte.",
      icon: (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 4v16" />
        </>
      ),
    },
    {
      title: "Seu perfil estruturado",
      desc: "Currículo, LinkedIn e GitHub normalizados na mesma taxonomia de skills das vagas — evidência declarada e demonstrada.",
      icon: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c.8-4 3.6-6 8-6s7.2 2 8 6" />
        </>
      ),
    },
    {
      title: "Anthropic Claude (LLM)",
      desc: "Modelo que estrutura o CV livre em campos e redige as explicações. Recebe só o seu CV, não treina nossos modelos.",
      icon: (
        <>
          <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21l2.3-7.2-6-4.4h7.6z" />
        </>
      ),
    },
  ];

  return (
    <div className="ct-source-grid">
      {sources.map((s) => (
        <div key={s.title} className="ct-source-card">
          <div className="ct-source-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {s.icon}
            </svg>
          </div>
          <div className="ct-source-title">{s.title}</div>
          <p className="ct-source-text">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}

function LGPDBanner() {
  return (
    <div className="ct-lgpd-banner">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: "none", marginTop: 1 }}
        aria-hidden="true"
      >
        <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <p>
        <strong>Seus dados nunca treinam nossos modelos.</strong> São isolados
        por usuário, processados com criptografia e deletáveis a qualquer
        momento. As explicações são geradas com restrição às suas fontes — nada
        de informação inventada. Conforme a <strong>LGPD</strong>. Detalhes em{" "}
        <Link href="/privacidade">/privacidade</Link>.
      </p>
    </div>
  );
}
