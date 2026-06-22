import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { extractSkills } from "@/lib/skills-taxonomy";

// Render dinâmico: auth() (cookies) + Prisma + chamada a provedores externos
// de vagas. Nada disso pode ser cacheado estaticamente.
export const dynamic = "force-dynamic";
export const metadata = { title: "Análise de gaps — CareerTwin AI" };

// Espelha exatamente a lógica de /api/gaps/summary e /api/gaps/requirements
// pra evitar chamada HTTP interna num server component (URL absoluta chata
// em dev/preview/prod). Mesma fórmula, mesmo top-18, mesma definição de
// "high priority" e aderência ponderada.
async function getGapsData(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.targetRole) {
    return { profile, noTarget: true };
  }

  const userSkills = new Set(
    (profile.skills || []).map((s) => String(s).toLowerCase()),
  );

  // Pool grande pra agregação estatística (limit 200). Tolerante a falha:
  // se provedores caírem, mostramos empty state ao invés de quebrar.
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

  const skillMap = new Map();
  jobsPayload.jobs.forEach((j) => {
    const skills = extractSkills(`${j.titulo || ""} ${j.descricao || ""}`);
    skills.forEach((sk) => {
      const key = String(sk).toLowerCase();
      skillMap.set(key, (skillMap.get(key) || 0) + 1);
    });
  });

  // Top 18 requisitos mais frequentes — mesmo recorte das APIs.
  const requirements = Array.from(skillMap.entries())
    .map(([skill, count]) => ({
      name: skill,
      count,
      pct: totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0,
      status: userSkills.has(skill) ? "have" : "missing",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);

  const skillsHave = requirements.filter((r) => r.status === "have").length;
  // "High priority" = skill em 70%+ das vagas que o usuário ainda não tem.
  const highPriorityGaps = requirements.filter(
    (r) => r.status === "missing" && r.pct >= 70,
  ).length;

  // Aderência ponderada por frequência: skills muito pedidas pesam mais.
  const totalWeight = requirements.reduce((s, r) => s + r.pct, 0);
  const matchedWeight = requirements
    .filter((r) => r.status === "have")
    .reduce((s, r) => s + r.pct, 0);
  const adherence =
    totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  // Rail direita: até 12 skills do usuário + 4 maiores gaps faltantes.
  const haveList = Array.from(userSkills).slice(0, 12);
  const missingList = requirements
    .filter((r) => r.status === "missing")
    .slice(0, 4);

  // Bandeira de transparência: se a única fonte foi fixtures, é ilustrativo.
  const isIllustrative =
    jobsPayload.sources.includes("fixtures") &&
    jobsPayload.sources.length === 1;

  return {
    profile,
    noTarget: false,
    summary: {
      totalJobs,
      skillsRequired: requirements.length,
      skillsHave,
      highPriorityGaps,
      adherence,
      isIllustrative,
    },
    requirements,
    haveList,
    missingList,
  };
}

export default async function GapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const data = await getGapsData(session.user.id);

  return (
    <div className="app-container">
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">Análise de gaps</h1>
          <p className="ct-gaps-sub">
            O que o mercado pede para o seu cargo-alvo vs. o que você já tem.
          </p>
        </div>
        {data.profile?.targetRole && (
          <Link
            href="/conta"
            className="ct-target-pill"
            title="Mudar cargo-alvo"
          >
            <span className="ct-target-label">CARGO-ALVO</span>
            <span className="ct-target-value">{data.profile.targetRole}</span>
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
        )}
      </div>

      {data.noTarget ? (
        <NoTargetState />
      ) : data.summary.totalJobs === 0 ? (
        <NoJobsState />
      ) : (
        <>
          <KPIStrip summary={data.summary} />
          <div className="ct-gaps-cols">
            <RequirementsList
              requirements={data.requirements}
              isIllustrative={data.summary.isIllustrative}
            />
            <SkillRail
              haveList={data.haveList}
              missingList={data.missingList}
            />
          </div>
        </>
      )}
    </div>
  );
}

function NoTargetState() {
  return (
    <div className="ct-dash-empty">
      <h2>Defina seu cargo-alvo primeiro</h2>
      <p>
        Sem cargo-alvo, não dá pra comparar você com o mercado. Configure em{" "}
        <Link href="/conta">/conta</Link> ou rode um diagnóstico em{" "}
        <Link href="/meu-gemeo">/meu-gemeo</Link>.
      </p>
    </div>
  );
}

function NoJobsState() {
  return (
    <div className="ct-dash-empty">
      <h2>Não consegui buscar vagas agora</h2>
      <p>
        As fontes de vagas (Adzuna, Jooble, Greenhouse) não retornaram
        resultados pro seu cargo-alvo. Pode ser cargo muito específico, ou
        momento ruim do mercado. Tente daqui a algumas horas.
      </p>
    </div>
  );
}

function KPIStrip({ summary }) {
  return (
    <div className="ct-kpi-strip">
      <KPICard value={summary.totalJobs} label="vagas reais analisadas" />
      <KPICard
        value={`${summary.skillsHave}/${summary.skillsRequired}`}
        label="skills exigidas que você tem"
      />
      <KPICard
        value={summary.highPriorityGaps}
        label="gaps de alta prioridade"
        color="attention"
      />
      <KPICard
        value={`${summary.adherence}%`}
        label="aderência média ao cargo"
        color="primary"
      />
    </div>
  );
}

function KPICard({ value, label, color }) {
  const colorClass =
    color === "attention"
      ? "ct-kpi-attention"
      : color === "primary"
        ? "ct-kpi-primary"
        : "";
  return (
    <div className="ct-kpi-card">
      <div className={"ct-kpi-value " + colorClass}>{value}</div>
      <div className="ct-kpi-label">{label}</div>
    </div>
  );
}

function RequirementsList({ requirements, isIllustrative }) {
  return (
    <div className="ct-req-card">
      <div className="ct-req-head">
        <h2>O que as vagas pedem</h2>
        <span className="ct-req-sub">ordenado por frequência nas vagas</span>
      </div>
      {isIllustrative && (
        <div className="ct-req-illustrative">
          Sem provider de vagas configurado — exibindo dados ilustrativos.
          Configure ADZUNA_APP_ID / JOOBLE_API_KEY pra vagas reais.
        </div>
      )}
      <div>
        {requirements.map((r, i) => (
          <div className="ct-req-row" key={r.name + i}>
            <div className="ct-req-row-head">
              <span
                className={
                  "ct-req-dot " + (r.status === "have" ? "have" : "missing")
                }
              />
              <span className="ct-req-name">{r.name}</span>
              <span
                className={
                  "ct-req-status " + (r.status === "have" ? "have" : "missing")
                }
              >
                {r.status === "have" ? "você tem" : "falta"}
              </span>
            </div>
            <div className="ct-req-row-foot">
              <div className="ct-req-bar">
                <div
                  className={
                    "ct-req-bar-fill " +
                    (r.status === "have" ? "have" : "missing")
                  }
                  style={{ width: r.pct + "%" }}
                />
              </div>
              <span className="ct-req-pct">
                pedido em {r.pct}% · {r.count} vagas
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillRail({ haveList, missingList }) {
  return (
    <div className="ct-rail">
      <div className="ct-rail-card">
        <div className="ct-rail-title">
          <span className="ct-rail-dot have" />
          Skills que você já tem
        </div>
        <div className="ct-skill-chips" style={{ marginTop: 13 }}>
          {haveList.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-faint)",
                margin: 0,
              }}
            >
              Nenhuma skill detectada no perfil ainda.
            </p>
          ) : (
            haveList.map((s, i) => (
              <span className="ct-skill-chip have" key={i}>
                {s}
              </span>
            ))
          )}
        </div>
      </div>
      <div className="ct-rail-card">
        <div className="ct-rail-title">
          <span className="ct-rail-dot attention" />
          Priorize aprender estas
        </div>
        <p className="ct-rail-sub">As de maior frequência que ainda faltam</p>
        <div className="ct-rail-missing-list">
          {missingList.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-faint)",
                margin: 0,
              }}
            >
              Sem gaps importantes! Você cobre os principais requisitos.
            </p>
          ) : (
            missingList.map((g, i) => (
              <div className="ct-rail-missing-row" key={i}>
                <span className="ct-rail-missing-name">{g.name}</span>
                <span className="ct-rail-missing-pct">{g.pct}% das vagas</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
