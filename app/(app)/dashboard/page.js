import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WEIGHTS, SS_META } from "@/lib/score";
import { computeCompleteness } from "@/lib/metrics/completeness";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — CareerTwin AI" };

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

  const [profile, snapshots] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { gaps: true, planItems: { orderBy: { semana: "asc" } } },
    }),
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

  const completeness = computeCompleteness(profile);
  const firstName =
    (profile?.nome || session.user.name || "").split(" ")[0] || "você";

  return (
    <div className="app-container">
      {/* Header */}
      <div className="ct-dash-header">
        <div>
          <p className="ct-dash-eyebrow">Bom te ver de volta,</p>
          <h1 className="ct-dash-title">Olá, {firstName}</h1>
        </div>
        <Link
          href="/conta"
          className="ct-target-pill"
          title="Editar cargo-alvo"
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
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Link>
      </div>

      {/* Empty state se sem snapshot */}
      {!latest && <EmptyState />}

      {/* HERO: Score Ring + Sub-scores */}
      {latest && (
        <div className="ct-dash-hero">
          <ScoreRingCol
            latest={latest}
            deltaFromFirst={deltaFromFirst}
            monthsSinceFirst={monthsSinceFirst}
            firstName={firstName}
          />
          <SubScoresCol latest={latest} />
        </div>
      )}

      {/* 2-col: actions + profile snapshot */}
      {latest && (
        <div className="ct-dash-cols">
          <NextActionsCol latest={latest} />
          <ProfileSnapshotCol
            profile={profile}
            completeness={completeness}
            latest={latest}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="ct-dash-empty">
      <h2>Seu gêmeo ainda está em branco.</h2>
      <p>
        Cole seu currículo e diga o cargo-alvo em{" "}
        <Link href="/dashboard">/dashboard</Link> pra começar a ver o
        diagnóstico aqui.
      </p>
      <Link
        href="/dashboard"
        className="btn btn-primary"
        style={{ marginTop: 14, display: "inline-block" }}
      >
        Construir meu gêmeo →
      </Link>
    </div>
  );
}

function ScoreRingCol({ latest, deltaFromFirst, monthsSinceFirst, firstName }) {
  const rawScore = Number(latest?.overall);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, rawScore))
    : 0;
  const CIRC = 2 * Math.PI * 74; // r=74
  const offset = CIRC * (1 - score / 100);

  return (
    <div className="ct-score-col">
      <div className="ct-score-ring-wrap">
        <svg width="172" height="172" viewBox="0 0 172 172">
          <circle
            cx="86"
            cy="86"
            r="74"
            fill="none"
            stroke="var(--primary-soft)"
            strokeWidth="13"
          />
          <circle
            cx="86"
            cy="86"
            r="74"
            fill="none"
            stroke="url(#scoreg)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={CIRC.toFixed(1)}
            strokeDashoffset={offset.toFixed(1)}
            transform="rotate(-90 86 86)"
          />
          <defs>
            <linearGradient id="scoreg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--primary-light)" />
              <stop offset="1" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="ct-score-num">
          <div className="ct-score-big">{score}</div>
          <div className="ct-score-of">de 100</div>
        </div>
      </div>
      <div className="ct-score-label">Saúde da carreira</div>
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
    </div>
  );
}

function SubScoresCol({ latest }) {
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
                <span className="ct-ss-value">{v}</span>
              </div>
              <div className="ct-ss-bar">
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

function NextActionsCol({ latest }) {
  // Pega 3 microactions a partir de gaps ordenados por impacto.
  const gaps = (Array.isArray(latest?.gaps) ? latest.gaps : [])
    .filter((g) => !g.completedAt)
    .sort((a, b) => (b.impactoPontos || 0) - (a.impactoPontos || 0))
    .slice(0, 3);

  return (
    <div>
      <div className="ct-actions-head">
        <h2 className="ct-actions-title">
          As 3 próximas ações de maior impacto
        </h2>
        <span className="ct-actions-sub">priorizado por ganho no score</span>
      </div>
      <div className="ct-actions-list">
        {gaps.length === 0 ? (
          <div className="ct-empty-card">
            Sem ações pendentes. Refaça o diagnóstico no{" "}
            <Link href="/dashboard">seu dashboard</Link> pra ver novas microações.
          </div>
        ) : (
          gaps.map((g, i) => (
            <div className="ct-action-card" key={g.id || i}>
              <div className="ct-action-num">{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ct-action-top">
                  <div className="ct-action-title">{g.habilidade}</div>
                  <span className="ct-action-impact">
                    +{g.impactoPontos || 4} pts
                  </span>
                </div>
                <p className="ct-action-why">
                  {g.microacao || g.porque || ""}
                </p>
                <div className="ct-action-foot">
                  <span className="ct-action-tag">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21l2.3-7.2-6-4.4h7.6z" />
                    </svg>
                    {g.frequencia || "alta frequência"}
                  </span>
                  <Link href="/gaps" className="ct-action-cta">
                    Começar →
                  </Link>
                </div>
              </div>
            </div>
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
      <div className="ct-profile-card">
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
