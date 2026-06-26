import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WEIGHTS, SS_META } from "@/lib/score";
import { computeCompleteness } from "@/lib/metrics/completeness";
import { getRealMedian } from "@/lib/metrics/median-real";
import ActionCardClient from "./ActionCardClient";
import RefreshDiagnosisButton from "./RefreshDiagnosisButton";
import DashboardTracker from "./DashboardTracker";
import DailyQuestCard from "./DailyQuestCard";
import DashboardHighlightBanner from "@/components/DashboardHighlightBanner";
import SkillGraph from "@/components/SkillGraph";
import { skillsForRole } from "@/lib/skills-taxonomy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — CareerTwin AI" };

// Server action: dismissa o banner welcome marcando Profile.welcomedAt.
// Sem userId no input: id sempre vem de auth() no servidor (anti IDOR).
// Falha silenciosa — proxima visita ao /dashboard volta a mostrar o banner
// caso o UPDATE caia, mas nao queremos derrubar o render por isso.
async function dismissWelcomeAction() {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;
  try {
    await prisma.profile.update({
      where: { userId: session.user.id },
      data: { welcomedAt: new Date() },
    });
    revalidatePath("/dashboard");
  } catch (e) {
    console.error("dismiss welcome falhou:", e?.message);
  }
}

const SS_KEYS = [
  "aderencia_vagas",
  "relevancia_habilidades",
  "otimizacao_perfil",
  "experiencia_mercado",
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const userId = session.user.id;

  // median e dado agregado (sem PII) — Promise.all paraleliza com queries do user.
  // getRealMedian tem cache em memoria 1h, entao normalmente nao toca DB.
  const [profile, snapshots, median] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { gaps: true, planItems: { orderBy: { semana: "asc" } } },
    }),
    getRealMedian(),
  ]);

  const latest = snapshots[0] || null;
  const first = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const deltaFromFirst = latest && first ? latest.overall - first.overall : 0;
  const monthsSinceFirst = first
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(first.createdAt).getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        ),
      )
    : null;

  // Score projetado: soma impactoPontos das microacoes concluidas em cima do
  // overall do snapshot atual. snapshot.overall NAO recalcula sozinho — e
  // baseado no estado do CV no momento do diagnostico. Pra cristalizar o
  // ganho projetado, user precisa atualizar o CV e refazer o diagnostico.
  const completedGaps = Array.isArray(latest?.gaps)
    ? latest.gaps.filter((g) => g.completedAt)
    : [];
  const totalGaps = Array.isArray(latest?.gaps) ? latest.gaps.length : 0;
  const allGapsDone = totalGaps > 0 && completedGaps.length === totalGaps;
  const projectedGain = completedGaps.reduce(
    (acc, g) => acc + (g.impactoPontos || 0),
    0,
  );
  const currentScore = Number(latest?.overall) || 0;
  const projectedScore = Math.min(100, currentScore + projectedGain);
  // Soma impactoPontos por dimensao -> projecao dos sub-scores.
  const projectedByDimension = completedGaps.reduce((acc, g) => {
    if (g.impactoDimensao && g.impactoPontos) {
      acc[g.impactoDimensao] = (acc[g.impactoDimensao] || 0) + g.impactoPontos;
    }
    return acc;
  }, {});

  const completeness = computeCompleteness(profile);
  const firstName =
    (profile?.nome || session.user.name || "").split(" ")[0] || "você";

  return (
    <main id="main-content" className="app-container">
      {/* Analytics: dispara dashboard_viewed no client com metricas pre-calc.
          Sem-PII: so contadores e score (sem habilidades/nome/email). */}
      <DashboardTracker
        hasSnapshot={!!latest}
        score={Number(latest?.overall) || 0}
        gapsCount={Array.isArray(latest?.gaps) ? latest.gaps.length : 0}
      />
      {/* Header — Arwen uplift: typography ambicioso clamp() + spacing generoso.
          Mantem classes (Galadriel polishing CSS em paralelo) mas adiciona style
          inline pra garantir vibe Cloudwalk independente do que .ct-dash-title
          tem hoje. */}
      <div
        className="ct-dash-header site-section-mesh"
        style={{
          paddingTop: "clamp(48px, 8vw, 96px)",
          paddingBottom: "clamp(32px, 5vw, 64px)",
        }}
      >
        <div>
          <p
            className="ct-dash-eyebrow"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent-cyan-deep)",
              marginBottom: "14px",
            }}
          >
            Dashboard · Bom te ver de volta
          </p>
          <h1
            className="ct-dash-title"
            style={{
              fontSize: "clamp(40px, 6vw, 80px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: "16px",
            }}
          >
            Olá, {firstName}
          </h1>
        </div>
        <Link
          href="/conta"
          className="ct-target-pill"
          title="Editar cargo-alvo"
          aria-label={`Mudar cargo-alvo, atual: ${profile?.targetRole || "não definido"}`}
        >
          <span className="ct-target-label">CARGO-ALVO</span>
          <span className="ct-target-value">
            {profile?.targetRole || "Defina seu cargo"}
          </span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Link>
      </div>

      {/* Welcome banner: aparece ate o user dismissar (welcomedAt setado).
          Para users sem diagnostico (firstDiagnosisAt null) direciona pra home,
          para users que acabaram de fazer o primeiro mostra mensagem de boas-vindas. */}
      {!profile?.welcomedAt && (
        <WelcomeBanner profile={profile} onDismiss={dismissWelcomeAction} />
      )}

      {/* Empty state se sem snapshot */}
      {!latest && <EmptyState />}

      {/* Highlight banner: mensagem contextual baseada no estado do user.
          So aparece quando ha snapshot — empty state ja tem call-to-action
          proprio. Variant "microacao" se ha gaps completados (incentivo a
          recalcular), senao "refresh" (lembrete suave de atualizar). */}
      {latest && completedGaps.length > 0 && (
        <DashboardHighlightBanner variant="microacao" count={completedGaps.length} />
      )}
      {latest && completedGaps.length === 0 && (
        <DashboardHighlightBanner variant="refresh" />
      )}

      {/* HERO: Score Ring + Sub-scores */}
      {latest && (
        <div className="ct-dash-hero app-glass">
          <ScoreRingCol
            latest={latest}
            deltaFromFirst={deltaFromFirst}
            monthsSinceFirst={monthsSinceFirst}
            firstName={firstName}
            currentScore={currentScore}
            projectedScore={projectedScore}
            projectedGain={projectedGain}
            completedCount={completedGaps.length}
            median={median}
          />
          <SubScoresCol latest={latest} projectedByDimension={projectedByDimension} />
        </div>
      )}

      {latest && <hr className="ct-section-divider" />}

      {/* Daily quest — feature #10 do roadmap (habit loop). Renderiza so depois
          do hero pra dar destaque sem competir com o score. Componente faz
          fetch lazy, retorna null em erro/loading (degrada silenciosamente). */}
      {latest && <DailyQuestCard />}

      {/* Skill graph — feature #7 do roadmap. Renderiza so quando o user tem
          snapshot E perfil estruturado com skills (sem isso o grafo fica vazio
          e nao agrega). targetSkills vem de skillsForRole — lookup hardcoded
          por enquanto (Fase 3 sera embeddings de JD). */}
      {latest && Array.isArray(profile?.skills) && profile.skills.length > 0 && (
        <section
          className="ct-dash-skill-graph"
          aria-labelledby="ct-skill-graph-title"
        >
          <h2 id="ct-skill-graph-title" className="ct-section-title">
            Mapa de skills
          </h2>
          <p className="ct-section-sub">
            Visual interativo das suas skills vs o que o cargo-alvo pede.
          </p>
          <SkillGraph
            profileSkills={profile.skills}
            targetSkills={skillsForRole(profile.targetRole)}
            role={profile.targetRole}
          />
        </section>
      )}

      {latest && <hr className="ct-section-divider" />}

      {/* 2-col: actions + profile snapshot */}
      {latest && (
        <div className="ct-dash-cols">
          <NextActionsCol latest={latest} allGapsDone={allGapsDone} projectedGain={projectedGain} />
          <ProfileSnapshotCol
            profile={profile}
            completeness={completeness}
            latest={latest}
          />
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="ct-dash-empty app-glass">
      <h2>Seu gêmeo ainda está em branco.</h2>
      <p>
        Cole seu currículo e diga o cargo-alvo na <Link href="/">home</Link>{" "}
        pra começar a ver o diagnóstico aqui.
      </p>
      <Link
        href="/"
        className="btn btn-primary"
        style={{ marginTop: 14, display: "inline-block" }}
      >
        Construir meu gêmeo →
      </Link>
    </div>
  );
}

// Banner de boas-vindas. Server component que recebe a server action via prop
// — o <form action={onDismiss}> aciona dismissWelcomeAction e re-renderiza
// o /dashboard sem o banner. Variante "primeira vez" (sem firstDiagnosisAt)
// orienta a fazer o diagnostico; variante "ja diagnosticou" celebra o score.
function WelcomeBanner({ profile, onDismiss }) {
  const isFirstTime = !profile?.firstDiagnosisAt;
  return (
    <div className="ct-welcome-banner" role="region" aria-label="Boas-vindas">
      <div className="ct-welcome-banner-icon" aria-hidden="true">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z" />
        </svg>
      </div>
      <div className="ct-welcome-banner-body">
        <h2 className="ct-welcome-banner-title">
          {isFirstTime ? "Bem-vindo ao CareerTwin AI" : "Olá de novo"}
        </h2>
        <p className="ct-welcome-banner-text">
          {isFirstTime
            ? "Cole seu currículo na home (/) ou clique em “Construir meu gêmeo” pra começar. Tudo fica salvo aqui."
            : "Seu diagnóstico está abaixo. Conforme você conclui microações, mostramos o ganho projetado. Quando estiver pronto, clique em “Atualizar diagnóstico” que recalculamos sem você ter que re-colar o CV."}
        </p>
        <div className="ct-welcome-banner-actions">
          {isFirstTime ? (
            <Link href="/" className="ct-welcome-banner-cta">
              Construir meu gêmeo →
            </Link>
          ) : (
            <Link href="/transparencia" className="ct-welcome-banner-cta">
              Ver como o score é calculado →
            </Link>
          )}
          <form action={onDismiss}>
            <button type="submit" className="ct-welcome-banner-dismiss">
              Não mostrar mais
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ScoreRingCol({
  latest,
  deltaFromFirst,
  monthsSinceFirst,
  firstName,
  currentScore,
  projectedScore,
  projectedGain,
  completedCount,
  median,
}) {
  // median pode ser undefined (defesa em depth contra alguem chamar
  // sem prop). Usa stub default e isStub true.
  const medianValue = Number(median?.value) || 78;
  const isStub = median?.isStub !== false; // default true
  const sampleSize = Number(median?.sampleSize) || 0;
  const score = Math.max(0, Math.min(100, currentScore));
  const projScore = Math.max(0, Math.min(100, projectedScore));
  const CIRC = 2 * Math.PI * 74; // r=74
  const offsetCurrent = CIRC * (1 - score / 100);
  const offsetProjected = CIRC * (1 - projScore / 100);
  const hasProjection = projectedGain > 0;

  return (
    <div className="ct-score-col">
      <div
        className="ct-score-ring-wrap"
        style={{ boxShadow: "0 8px 24px -6px var(--accent-cyan-glow)", borderRadius: "50%" }}
      >
        <svg
          width="172"
          height="172"
          viewBox="0 0 172 172"
          role="img"
          aria-label={
            hasProjection
              ? `Score atual: ${score} de 100. Projetado com microacoes feitas: ${projScore} de 100.`
              : `Saúde da carreira: ${score} de 100`
          }
        >
          <circle
            cx="86"
            cy="86"
            r="74"
            fill="none"
            stroke="var(--primary-soft)"
            strokeWidth="13"
          />
          {/* Anel pontilhado da projecao — atras do principal, fica visivel
              alem dele quando projScore > score. */}
          {hasProjection && projScore > score && (
            <circle
              cx="86"
              cy="86"
              r="74"
              fill="none"
              stroke="var(--positive)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray="6 5"
              strokeDashoffset={offsetProjected.toFixed(1)}
              transform="rotate(-90 86 86)"
              opacity="0.55"
              style={{
                strokeDasharray: `${CIRC.toFixed(1)}`,
                strokeDashoffset: offsetProjected.toFixed(1),
              }}
            />
          )}
          <circle
            cx="86"
            cy="86"
            r="74"
            fill="none"
            stroke="url(#scoreg)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={CIRC.toFixed(1)}
            strokeDashoffset={offsetCurrent.toFixed(1)}
            transform="rotate(-90 86 86)"
          />
          <defs>
            <linearGradient id="scoreg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--primary-light)" />
              <stop offset="1" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="ct-score-num" aria-hidden="true">
          <div className="ct-score-big">{score}</div>
          <div className="ct-score-of">de 100</div>
        </div>
      </div>
      <div className="ct-score-label">Saúde da carreira</div>
      {hasProjection && (
        <div className="ct-score-projection" role="note">
          <span className="ct-score-proj-dot" aria-hidden="true" />
          <span>
            <strong>+{projectedGain} pts projetados</strong> com{" "}
            {completedCount} {completedCount === 1 ? "ação concluída" : "ações concluídas"}
            <span className="ct-score-proj-help">
              {" "}— clique em “Atualizar diagnóstico” abaixo pra cristalizar.
            </span>
          </span>
        </div>
      )}
      {deltaFromFirst > 0 && monthsSinceFirst > 0 && (
        <div className="ct-score-delta">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 17l6-6 4 4 6-7" />
            <path d="M16 8h4v4" />
          </svg>
          +{deltaFromFirst} em {monthsSinceFirst}{" "}
          {monthsSinceFirst === 1 ? "mês" : "meses"}
        </div>
      )}
      <p className="ct-score-baseline">
        Baseado em vagas reais de <strong>{latest.role || "—"}</strong>{" "}
        analisadas
      </p>
      <div className="ct-mediana">
        <div className="ct-mediana-row">
          <span>Mediana de contratados</span>
          <span className="ct-mediana-value">{medianValue}</span>
        </div>
        <div
          className="ct-mediana-bar"
          role="img"
          aria-label={`Seu score ${score} comparado com a mediana ${medianValue}`}
        >
          <div
            className="ct-mediana-bar-fill"
            style={{ width: `${Math.min(100, score)}%` }}
          />
          <div
            className="ct-mediana-bar-mark"
            style={{ left: `${medianValue}%` }}
          />
        </div>
        <div className="ct-mediana-foot">
          {isStub ? (
            <>
              Estimativa em construção · você está a{" "}
              <strong>{Math.max(0, medianValue - score)} pontos</strong> da
              mediana.
            </>
          ) : (
            <>
              Mediana real (N={sampleSize}) · você está a{" "}
              <strong>{Math.max(0, medianValue - score)} pontos</strong> da
              mediana de contratados.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SubScoresCol({ latest, projectedByDimension = {} }) {
  const ss =
    latest && typeof latest.subScores === "object" && latest.subScores !== null
      ? latest.subScores
      : {};
  return (
    <div className="ct-subscores-col">
      <div className="ct-subscores-head">
        <div className="ct-subscores-title">Como esse número é formado</div>
        <Link href="/transparencia" className="ct-subscores-link">
          Como calculamos
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <div className="ct-subscores-list">
        {SS_KEYS.map((k) => {
          const entry = ss?.[k];
          const rawV = Number(entry?.valor);
          const v = Number.isFinite(rawV)
            ? Math.max(0, Math.min(100, rawV))
            : 0;
          const proj = Math.min(100, v + (projectedByDimension[k] || 0));
          const gain = proj - v;
          const why = typeof entry?.explicacao === "string"
            ? entry.explicacao
            : "";
          const cleanWhy = why.replace(/\s*\[(.+?)\]\s*$/, "");
          const source = why.match(/\[(.+?)\]\s*$/)?.[1] || "Currículo";
          const meta = SS_META[k] || { label: k };
          return (
            <div className="ct-ss-row" key={k}>
              <div className="ct-ss-head">
                <span className="ct-ss-label">{meta.label}</span>
                <span className="ct-ss-value">
                  {v}
                  {gain > 0 && (
                    <span className="ct-ss-gain"> · +{gain} proj.</span>
                  )}
                </span>
              </div>
              <div className="ct-ss-bar">
                {gain > 0 && (
                  <div
                    className="ct-ss-bar-fill projected"
                    style={{ width: proj + "%" }}
                    aria-hidden="true"
                  />
                )}
                <div
                  className="ct-ss-bar-fill"
                  style={{ width: v + "%" }}
                />
              </div>
              <p className="ct-ss-why">
                {cleanWhy || "Sem explicação registrada nesse snapshot."}{" "}
                <span className="ct-ss-source">· {source}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextActionsCol({ latest, allGapsDone, projectedGain }) {
  // Pega 3 microactions a partir de gaps ordenados por impacto.
  // Filtra completados; o re-render apos POST /complete recalcula e some.
  const gaps = (Array.isArray(latest?.gaps) ? latest.gaps : [])
    .filter((g) => !g.completedAt)
    .sort((a, b) => (b.impactoPontos || 0) - (a.impactoPontos || 0))
    .slice(0, 3);

  const completedCount = Array.isArray(latest?.gaps)
    ? latest.gaps.filter((g) => g.completedAt).length
    : 0;

  // Mostra botao "Atualizar diagnostico" SEMPRE que ha pelo menos 1 acao
  // concluida (nao precisa esperar todas). UX: user marca 1 -> ja pode
  // recalcular pra ver o ganho. Antes era so no empty state (todas done).
  const showRefreshHint = completedCount > 0 && gaps.length > 0;

  return (
    <div>
      <div className="ct-actions-head">
        <h2 className="ct-actions-title">
          As 3 próximas ações de maior impacto
        </h2>
        <span className="ct-actions-sub">priorizado por ganho no score</span>
      </div>

      {showRefreshHint && (
        <div className="ct-actions-refresh-hint">
          <RefreshDiagnosisButton
            allGapsDone={false}
            projectedGain={projectedGain}
            completedCount={completedCount}
          />
        </div>
      )}

      <div className="ct-actions-list">
        {gaps.length === 0 ? (
          <RefreshDiagnosisButton
            allGapsDone={allGapsDone}
            projectedGain={projectedGain}
            completedCount={completedCount}
          />
        ) : (
          gaps.map((g, i) => (
            <ActionCardClient key={g.id || i} gap={g} index={i} />
          ))
        )}
      </div>
    </div>
  );
}

function ProfileSnapshotCol({ profile, completeness, latest }) {
  const nome = profile?.nome || "Seu perfil";
  const initial = (nome.trim().charAt(0) || "?").toUpperCase();
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const oneMissing = completeness.missing[0];

  return (
    <div>
      <div className="ct-profile-head">
        <h2 className="ct-profile-title">Seu perfil estruturado</h2>
        <span className="ct-profile-pct">
          <span className="ct-profile-dot" />
          {completeness.percent}% completo
        </span>
      </div>
      <div className="ct-profile-card app-glass">
        <div className="ct-profile-top">
          <div className="ct-profile-avatar">{initial}</div>
          <div>
            <div className="ct-profile-name">{nome}</div>
            <div className="ct-profile-loc">
              {profile?.cargoAtual || "—"}
            </div>
          </div>
        </div>
        <div className="ct-profile-fields">
          <Field
            label="Atual"
            value={
              profile?.cargoAtual
                ? `${profile.cargoAtual}${profile.senioridade ? " · " + profile.senioridade : ""}`
                : "—"
            }
          />
          <Field
            label="Alvo"
            value={profile?.targetRole || "—"}
            highlight
          />
          {skills.length > 0 && (
            <div>
              <div className="ct-profile-field-label">Skills principais</div>
              <div className="ct-skill-chips">
                {skills.slice(0, 8).map((s, i) => (
                  <span className="ct-skill-chip" key={i}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {oneMissing && completeness.percent < 100 && (
          <div className="ct-profile-alert">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16v.01" />
            </svg>
            <p>
              <strong>
                Falta {completeness.missing.length}{" "}
                {completeness.missing.length === 1 ? "item" : "itens"}:
              </strong>{" "}
              próximo é <i>{oneMissing.label}</i>. Adicione em{" "}
              <Link href="/conta">/conta</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, highlight }) {
  return (
    <div className="ct-profile-field">
      <div className="ct-profile-field-label">{label}</div>
      <div
        className={
          "ct-profile-field-value" + (highlight ? " highlight" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
