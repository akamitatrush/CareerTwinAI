import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ALL_ASSESSMENTS, slugFromKind } from "@/lib/assessments/definitions";
import { AssessmentIcon } from "./icons";

// Render dinamico: auth() le cookies + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";
export const metadata = { title: "Autoconhecimento — CareerTwin AI" };

// Microcopy por kind: o que o user GANHA fazendo (1-2 bullets). Mostrado no
// card pra trocar o "Não feito ainda" frio por motivacao concreta.
const CARD_BENEFITS = {
  DISC_LITE: [
    "Quadrante dominante + leitura por estilo",
    "3 dicas concretas de onde brilhar",
  ],
  VALORES: [
    "Top 5 valores em radar visual",
    "Arquetipo + cargos que combinam",
  ],
  IKIGAI: [
    "Diagrama 4-circulos preenchido",
    "Sintese textual da intersecao",
  ],
};

export default async function AutoconhecimentoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // groupBy nos resultados pra trazer o "ultimo" de cada kind numa query so.
  // IDOR-safe: where escopado pelo user da sessao.
  let latest = [];
  try {
    latest = await prisma.assessmentResult.groupBy({
      by: ["kind"],
      where: { userId: session.user.id },
      _max: { completedAt: true },
    });
  } catch {
    // Se a tabela ainda nao existir (migration nao rodou em algum ambiente),
    // o card aparece como "nao feito" — sem derrubar a pagina.
    latest = [];
  }
  const doneMap = new Map(latest.map((l) => [l.kind, l._max?.completedAt]));
  const doneCount = Array.from(doneMap.values()).filter(Boolean).length;
  const totalCount = ALL_ASSESSMENTS.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  return (
    <main className="app-container" id="main-content">
      {/* Hero — Arwen uplift: mesh sutil + typography ambicioso clamp() +
          spacing generoso. Mantem classes pra Galadriel polir CSS em
          paralelo, style inline garante vibe premium agora. */}
      <section
        className="ct-self-hero site-section-mesh"
        style={{
          paddingTop: "clamp(56px, 9vw, 96px)",
          paddingBottom: "clamp(32px, 5vw, 64px)",
          marginBottom: "clamp(32px, 5vw, 64px)",
        }}
      >
        <p
          className="ct-self-hero-eyebrow"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--accent-cyan-deep)",
            marginBottom: "14px",
          }}
        >
          Autoconhecimento
        </p>
        <h1
          className="ct-self-hero-title"
          style={{
            fontSize: "clamp(40px, 6vw, 80px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginBottom: "16px",
          }}
        >
          Quem você é, antes da próxima vaga
        </h1>
        <p
          className="ct-self-hero-sub"
          style={{
            fontSize: "clamp(16px, 1.4vw, 19px)",
            lineHeight: 1.55,
            color: "var(--text-muted)",
            maxWidth: "62ch",
          }}
        >
          3 reflexões pra mapear estilo, valores e propósito. Não são
          diagnósticos clínicos — são pontos de partida pra decisões melhores
          de carreira.
        </p>
        <ul className="ct-self-stats" aria-label="Caracteristicas dos assessments">
          <li>
            <span className="ct-self-stat-num">~5min</span>
            <span className="ct-self-stat-label">cada um</span>
          </li>
          <li>
            <span className="ct-self-stat-num">100%</span>
            <span className="ct-self-stat-label">privado e só seu</span>
          </li>
          <li>
            <span className="ct-self-stat-num">∞</span>
            <span className="ct-self-stat-label">refaz quando quiser</span>
          </li>
        </ul>
      </section>

      <section
        className="ct-self-progress"
        aria-label={`${doneCount} de ${totalCount} reflexoes feitas`}
      >
        <div className="ct-self-progress-head">
          <span className="ct-self-progress-label">
            {doneCount} de {totalCount} reflexões feitas
          </span>
          <span className="ct-self-progress-value">{progressPct}%</span>
        </div>
        <div
          className="ct-self-progress-track"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="ct-self-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      <div className="ct-self-grid">
        {ALL_ASSESSMENTS.map((def) => {
          const doneAt = doneMap.get(def.kind);
          const slug = slugFromKind(def.kind);
          const palette = def.palette || "indigo";
          const benefits = CARD_BENEFITS[def.kind] || [];
          // Tempo estimado e tipo — texto curto que substitui a descricao
          // tecnica antiga ("12 perguntas. ~3 minutos.") por algo mais util.
          const meta =
            def.type === "likert"
              ? `${def.questions.length} perguntas · ~3 min`
              : def.type === "multiselect"
                ? `Escolha de ${def.maxSelections} · ~2 min`
                : `${def.questions.length} reflexões abertas · ~10 min`;
          return (
            <Link
              key={def.kind}
              href={`/autoconhecimento/${slug}`}
              className={`ct-self-card ct-self-card-${palette}`}
              data-done={doneAt ? "true" : "false"}
            >
              <div className="ct-self-card-head">
                <div
                  className={`ct-self-card-icon ct-self-card-icon-${palette}`}
                  aria-hidden="true"
                >
                  <AssessmentIcon kind={def.iconKind} size={26} />
                </div>
                {doneAt ? (
                  <span className="ct-self-badge ct-self-badge-done" aria-label="Concluido">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                    Concluído
                  </span>
                ) : (
                  <span className="ct-self-badge ct-self-badge-todo">Pendente</span>
                )}
              </div>
              <h2 className="ct-self-card-title">{def.title}</h2>
              <p className="ct-self-card-desc">{def.intro}</p>

              {benefits.length > 0 && (
                <ul className="ct-self-card-benefits">
                  {benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}

              <div className="ct-self-card-foot">
                <span className="ct-self-card-meta">{meta}</span>
                <span className="ct-self-card-cta" aria-hidden="true">
                  {doneAt ? "Refazer →" : "Começar →"}
                </span>
              </div>
              {doneAt && (
                <p className="ct-self-card-date">
                  Salvo em {new Date(doneAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      <aside className="ct-self-disclaimer" role="note">
        <strong>Importante:</strong> estes assessments são informativos. Não
        substituem MBTI/DISC oficial, avaliação psicológica ou consulta com
        psicólogo. Use como ponto de partida.
      </aside>
    </main>
  );
}
