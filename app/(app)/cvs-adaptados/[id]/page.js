import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CvDiffView from "../CvDiffView";
import { diffLines, lineStats, changePercent } from "@/lib/text-diff";

// Render dinamico: auth() le cookies + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";
export const metadata = { title: "Diff do CV adaptado — CareerTwin AI" };

// Detail page do CV adaptado com visualizacao diff antes/depois.
//
// IDOR-safe: where escopa por id E userId. Se nao bate, redireciona pra lista
// (nunca exibe 403 — vaza existencia do recurso). Mesma estrategia do route.js
// /api/tailored-cvs/[id].
//
// Stats: calculadas server-side pra evitar payload duplicado e flash de
// "Carregando 0 / 0" no client. KPIs vem pre-renderizados.
export default async function CvDiffPage({ params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const { id } = await params;
  if (!id || typeof id !== "string" || id.length > 50) {
    redirect("/cvs-adaptados");
  }

  const cv = await prisma.tailoredCv.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      applicationId: true,
      vagaTitulo: true,
      vagaEmpresa: true,
      beforeText: true,
      afterText: true,
      createdAt: true,
    },
  });

  // IDOR check: se nao existe ou nao pertence ao user, redirect (nao 403)
  if (!cv || cv.userId !== session.user.id) {
    redirect("/cvs-adaptados");
  }

  const original = cv.beforeText || "";
  const tailored = cv.afterText || "";

  // Pre-calcula stats no server pra evitar layout shift no client.
  // Esses numeros tambem aparecem no <CvDiffView> mas duplicar e barato
  // e melhora UX (numeros aparecem antes do JS hydrar).
  const stats = lineStats(diffLines(original, tailored));
  const pct = changePercent(stats);

  const dateStr = new Date(cv.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <main className="app-container" id="main-content">
      {/* Refresh visual (Sam) — glass + hover lift nos KPI cards do diff. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .diff-kpi-glass {
              transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
            }
            .diff-kpi-glass:hover {
              transform: scale(1.01);
              box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-cyan-glow);
              border-color: var(--accent-cyan-glow);
            }
            @media (prefers-reduced-motion: reduce) {
              .diff-kpi-glass,
              .diff-kpi-glass:hover {
                transition: none;
                transform: none;
              }
            }
          `,
        }}
      />
      <Link
        href="/cvs-adaptados"
        className="ct-self-back"
        style={{
          display: "inline-block",
          marginBottom: 16,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        ← Voltar para CVs adaptados
      </Link>

      <header className="ct-page-header">
        <div className="ct-page-header-icon" aria-hidden="true">
          <DiffIcon />
        </div>
        <div className="ct-page-header-content">
          <p className="ct-page-header-eyebrow">CV ADAPTADO · DIFF</p>
          <h1 className="ct-page-header-title">Comparação antes / depois</h1>
          <p className="ct-page-header-sub">
            Veja exatamente o que a IA mudou no seu CV pra essa vaga. Cada
            alteração é auditável.
          </p>
          <div className="ct-page-header-meta">
            <span>{cv.vagaTitulo}</span>
            {cv.vagaEmpresa && <span>· {cv.vagaEmpresa}</span>}
            <span>· gerado em {dateStr}</span>
          </div>
        </div>
      </header>

      {/* Stats summary pre-renderizado server-side. O CvDiffView tambem
          mostra os mesmos numeros — duplicacao intencional pra evitar
          flash sem KPIs ate o JS hydrar. */}
      <div
        className="ct-kpi-strip"
        aria-label="Resumo da comparacao"
        style={{ marginTop: 24, marginBottom: 12 }}
      >
        <div className="ct-kpi-card app-glass diff-kpi-glass">
          <div className="ct-kpi-value" style={{ color: "rgb(22,163,74)" }}>
            {stats.added}
          </div>
          <div className="ct-kpi-label">Linhas adicionadas</div>
        </div>
        <div className="ct-kpi-card app-glass diff-kpi-glass">
          <div className="ct-kpi-value" style={{ color: "rgb(220,38,38)" }}>
            {stats.removed}
          </div>
          <div className="ct-kpi-label">Linhas removidas</div>
        </div>
        <div className="ct-kpi-card app-glass diff-kpi-glass">
          <div className="ct-kpi-value" style={{ color: "rgb(202,138,4)" }}>
            {stats.changed}
          </div>
          <div className="ct-kpi-label">Linhas alteradas</div>
        </div>
        <div className="ct-kpi-card app-glass diff-kpi-glass">
          <div className="ct-kpi-value ct-kpi-primary">{pct}%</div>
          <div className="ct-kpi-label">% de mudança</div>
        </div>
      </div>

      <CvDiffView original={original} tailored={tailored} />
    </main>
  );
}

// SVG inline — diff icon (2 paineis lado a lado com seta entre).
// Sem dependencia de icon lib externa. Stroke seguindo cor do header icon.
function DiffIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
      <line x1="10.5" y1="12" x2="13.5" y2="12" />
      <polyline points="12,10 14,12 12,14" />
    </svg>
  );
}
