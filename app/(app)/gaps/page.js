import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { SKILLS } from "@/lib/skills-taxonomy";
import { computeAdherenceTop } from "@/lib/scoring/adherence";
import { suggestCoursesForSkill } from "@/lib/knowledge/course-retrieval";
import DashboardHighlightBanner from "@/components/DashboardHighlightBanner";
import Icon from "@/components/Icon";
import GapsKpiStrip from "./GapsKpiStrip";
import SkillMap from "./SkillMap";
import RequirementsFrequency from "./RequirementsFrequency";
import MicroactionCard from "./MicroactionCard";

// Render dinamico: auth() (cookies) + Prisma + chamada a provedores externos
// de vagas. Nada disso pode ser cacheado estaticamente.
export const dynamic = "force-dynamic";
export const metadata = { title: "Análise de lacunas — CareerTwin AI" };

// Server component: delega calculo a lib/scoring/adherence.js (refactor
// 2026-06-29, auditoria Gandalf). Antes duplicava a logica de /api/gaps/*
// pra evitar fetch HTTP interno; agora a fonte unica e o modulo. Snapshot
// do user vem do banco como antes — gaps reais sao do /api/analyze.
async function getGapsData(userId) {
  const [profile, latestSnapshot] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { gaps: true },
    }),
  ]);
  if (!profile?.targetRole) {
    return { profile, latestSnapshot, noTarget: true };
  }

  // Pool grande pra agregacao estatistica (limit 200). Tolerante a falha:
  // se provedores cairem, mostramos empty state ao inves de quebrar.
  let jobsPayload = { jobs: [], sources: [] };
  try {
    jobsPayload = await searchJobs({
      role: profile.targetRole,
      location: "Brasil",
      limit: 200,
    });
  } catch (e) {
    console.error("gaps page jobs falhou:", e?.message);
  }

  const totalJobs = jobsPayload.jobs.length || 0;
  const top = computeAdherenceTop(profile.skills, jobsPayload.jobs);
  const requirements = top.requirements;

  // illustrativeRatio (0..1) substitui o boolean enganoso da era pre-auditoria.
  // Hoje searchJobs nao mescla mais fixtures pra completar limite: ou veio do
  // mercado real, ou caiu 100% em fixtures (fallback total quando nenhum
  // provider respondeu).
  const illustrativeRatio = typeof jobsPayload.illustrativeRatio === "number"
    ? jobsPayload.illustrativeRatio
    : (jobsPayload.sources.includes("fixtures") && jobsPayload.sources.length === 1 ? 1 : 0);
  const isIllustrative = illustrativeRatio >= 0.5;

  // === Conjuntos derivados para o SkillMap ===
  // requirementSet: skills (lowercase) que estao nos requirements top-18.
  // canonicalSet: TODAS as habilidades canonicas + aliases da taxonomy
  // (lowercase), pra classificar uma habilidade do perfil como "rare"
  // (dentro da taxonomy mas fora do pool) versus "unknown" (fora da
  // taxonomy completamente).
  const requirementSet = new Set(requirements.map((r) => r.name.toLowerCase()));
  const canonicalSet = new Set();
  for (const [canon, aliases] of Object.entries(SKILLS)) {
    canonicalSet.add(canon.toLowerCase());
    for (const a of aliases) canonicalSet.add(String(a).toLowerCase());
  }

  return {
    profile,
    latestSnapshot,
    noTarget: false,
    summary: {
      totalJobs,
      realCount: jobsPayload.realCount ?? totalJobs,
      skillsRequired: top.skillsRequired,
      skillsHave: top.skillsHave,
      highPriorityGaps: top.highPriorityGaps,
      adherence: top.adherence,
      illustrativeRatio,
      isIllustrative,
    },
    requirements,
    requirementSet,
    canonicalSet,
  };
}

export default async function GapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const data = await getGapsData(session.user.id);
  const snapshot = data.latestSnapshot;
  const gaps = Array.isArray(snapshot?.gaps) ? snapshot.gaps : [];
  const hasGaps = gaps.length > 0;
  const completedCount = gaps.filter((g) => g.completedAt).length;
  const openCount = gaps.length - completedCount;

  // Pre-calcula cursos por gap pra renderizar inline em cada microacao
  // (em vez de uma secao "Cursos sugeridos" separada no final, que perdia
  // contexto). limit 2 = nao polui o card, deixa decisao rapida.
  const coursesByGapId = new Map();
  for (const g of gaps) {
    const sk = g.habilidade || g.skill || g.name;
    if (!sk) continue;
    const found = suggestCoursesForSkill(sk, { limit: 2 });
    if (found.length > 0) coursesByGapId.set(g.id, found);
  }

  // Ordena por impactoPontos desc; marca o primeiro pendente como "top".
  const sortedGaps = [...gaps].sort(
    (a, b) => (b.impactoPontos || 0) - (a.impactoPontos || 0),
  );
  const firstPendingId = sortedGaps.find((g) => !g.completedAt)?.id;

  return (
    <main id="main-content" className="app-container">
      <header
        className="ct-page-header app-glass site-section-mesh"
        style={{
          boxShadow:
            "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)",
        }}
      >
        <div
          className="ct-page-header-icon"
          aria-hidden="true"
          style={{ filter: "drop-shadow(0 0 6px var(--accent-cyan-glow))" }}
        >
          <Icon name="nav-chart" size={22} stroke={2} />
        </div>
        <div className="ct-page-header-content">
          <div className="ct-page-header-eyebrow">DIAGNÓSTICO · LACUNAS</div>
          <h1 className="ct-page-header-title">Análise de lacunas</h1>
          <p className="ct-page-header-sub">
            Identificamos o que falta entre seu perfil atual e o cargo-alvo.
            Cada gap vem com microação acionável.
          </p>
          {hasGaps && (
            <div className="ct-page-header-meta">
              <span>
                <strong className="ct-accent-text">{gaps.length}</strong>{" "}
                {gaps.length === 1 ? "gap" : "gaps"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="ct-accent-text">{completedCount}</strong>{" "}
                {completedCount === 1 ? "concluído" : "concluídos"}
              </span>
            </div>
          )}
        </div>
        {data.profile?.targetRole && (
          <Link
            href="/conta"
            className="ct-target-pill"
            title="Mudar cargo-alvo"
            aria-label={`Mudar cargo-alvo, atual: ${data.profile.targetRole}`}
          >
            <span className="ct-target-label">CARGO-ALVO</span>
            <span className="ct-target-value">{data.profile.targetRole}</span>
            <Icon name="chevron-down" size={15} stroke={2} />
          </Link>
        )}
      </header>

      {/* Highlight banner: convida a recalcular quando o user ja fez progresso
          mas ainda tem gaps abertos. So aparece nesse cenario — empty/no-target
          tem CTAs proprios; "tudo feito" nao precisa de empuxo. */}
      {hasGaps && completedCount > 0 && openCount > 0 && (
        <DashboardHighlightBanner
          variant="microacao"
          count={completedCount}
        />
      )}

      {data.noTarget ? (
        <NoTargetState />
      ) : data.summary && data.summary.totalJobs === 0 && !hasGaps ? (
        <NoJobsState />
      ) : (
        <>
          {/* Ato 1 — Onde voce esta */}
          <GapsKpiStrip
            summary={data.summary}
            snapshot={snapshot}
            targetRole={data.profile?.targetRole}
          />

          {/* Ato 2 — O que falta */}
          {data.summary && data.summary.totalJobs > 0 && (
            <>
              <hr className="ct-section-divider" />
              <section className="ct-gaps-act ct-gaps-act-2" aria-labelledby="gaps-act-2">
                <header className="ct-gaps-act-head">
                  <span className="ct-gaps-act-num" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <h2 id="gaps-act-2" className="ct-gaps-act-title">
                      O que falta
                    </h2>
                    <p className="ct-gaps-act-sub">
                      Lado a lado: suas habilidades cruzadas com o mercado e o
                      que aparece mais nas vagas reais.
                    </p>
                  </div>
                </header>
                <div className="ct-gaps-act-2-cols">
                  <SkillMap
                    skills={data.profile?.skills || []}
                    requirementSet={data.requirementSet}
                    canonicalSet={data.canonicalSet}
                  />
                  <RequirementsFrequency
                    requirements={data.requirements}
                    isIllustrative={data.summary.isIllustrative}
                    limit={8}
                  />
                </div>
              </section>
            </>
          )}

          {/* Ato 3 — O que fazer */}
          {hasGaps && (
            <>
              <hr className="ct-section-divider" />
              <section className="ct-gaps-act ct-gaps-act-3" aria-labelledby="gaps-act-3">
                <header className="ct-gaps-act-head">
                  <span className="ct-gaps-act-num" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <h2 id="gaps-act-3" className="ct-gaps-act-title">
                      O que fazer
                    </h2>
                    <p className="ct-gaps-act-sub">
                      Microações priorizadas por impacto no seu score. Cada uma
                      sugere cursos pra fechar a lacuna.
                    </p>
                  </div>
                </header>
                <div className="ct-microactions-list">
                  {sortedGaps.map((gap) => (
                    <MicroactionCard
                      key={gap.id}
                      gap={gap}
                      courses={coursesByGapId.get(gap.id) || []}
                      priority={gap.id === firstPendingId ? "top" : null}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

function NoTargetState() {
  return (
    <div
      className="ct-dash-empty app-glass"
      style={{
        boxShadow:
          "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)",
      }}
    >
      <h2>Defina seu cargo-alvo primeiro</h2>
      <p>
        Sem cargo-alvo, não dá pra comparar você com o mercado. Configure em{" "}
        <Link href="/conta">/conta</Link> ou rode um diagnóstico no{" "}
        <Link href="/dashboard">seu dashboard</Link>.
      </p>
    </div>
  );
}

function NoJobsState() {
  return (
    <div
      className="ct-dash-empty app-glass"
      style={{
        boxShadow:
          "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)",
      }}
    >
      <h2>Não consegui buscar vagas agora</h2>
      <p>
        As fontes de vagas (Adzuna, Jooble, Greenhouse) não retornaram
        resultados pro seu cargo-alvo. Pode ser cargo muito específico, ou
        momento ruim do mercado. Tente daqui a algumas horas.
      </p>
    </div>
  );
}
