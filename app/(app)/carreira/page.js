import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCareerPath, getAllPaths } from "@/lib/career-paths";

// Forca render dinamico: auth() (cookies) + Prisma. Nunca cachear.
export const dynamic = "force-dynamic";
export const metadata = { title: "Plano de carreira — CareerTwin AI" };

export default async function CarreiraPage() {
  // 1. Sessao validada na rota (defense in depth — middleware ja cobre /app/*).
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // 2. Query escopada por userId — IDOR proof (OWASP A01). Sem id no body.
  //    findUnique no userId @unique do Profile garante zero exposicao cruzada.
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { targetRole: true, skills: true, nome: true },
  });

  const targetRole = profile?.targetRole || "";
  const path = getCareerPath(targetRole);
  const allPaths = getAllPaths();
  const userSkills = Array.isArray(profile?.skills) ? profile.skills : [];

  return (
    <main id="main-content" className="app-container">
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">Plano de carreira</h1>
          <p className="ct-gaps-sub">
            Roadmap visual pra chegar no seu cargo-alvo.{" "}
            {targetRole && (
              <>
                Alvo: <strong>{targetRole}</strong>.
              </>
            )}
          </p>
        </div>
        {targetRole && (
          <Link
            href="/conta"
            className="ct-target-pill"
            title="Mudar cargo-alvo"
            aria-label={`Mudar cargo-alvo, atual: ${targetRole}`}
          >
            <span className="ct-target-label">CARGO-ALVO</span>
            <span className="ct-target-value">{targetRole}</span>
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
        )}
      </div>

      {!targetRole ? (
        <NoTargetState />
      ) : !path ? (
        <NoPathState role={targetRole} allPaths={allPaths} />
      ) : (
        <CareerRoadmap path={path} userSkills={userSkills} />
      )}
    </main>
  );
}

function NoTargetState() {
  return (
    <div className="ct-dash-empty">
      <h2>Defina seu cargo-alvo primeiro</h2>
      <p>
        Sem cargo-alvo, nao da pra montar um plano de carreira. Adicione em{" "}
        <Link href="/conta">/conta</Link>.
      </p>
      <Link href="/conta" className="btn-primary" style={{ marginTop: 16 }}>
        Definir cargo-alvo
      </Link>
    </div>
  );
}

function NoPathState({ role, allPaths }) {
  return (
    <div className="ct-dash-empty">
      <h2>Ainda nao temos roadmap pra &ldquo;{role}&rdquo;</h2>
      <p>Estamos curando paths para mais cargos. Por enquanto, paths disponiveis:</p>
      <ul className="ct-career-paths-list">
        {allPaths.map((p) => (
          <li key={p.key}>
            <strong>{p.title}</strong>{" "}
            <span className="ct-career-paths-meta">
              ({p.timeline} · {p.milestonesCount} milestones)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Roadmap visual: lista ordenada de milestones com numero + linha conectora.
// Cada card mostra skills do milestone cruzadas com Profile.skills (have/missing),
// barra de progresso, acoes concretas e a evidencia esperada pra "fechar".
function CareerRoadmap({ path, userSkills }) {
  // Set de skills lowercase pra match case-insensitive sem alocacao em cada item.
  const userSkillsSet = new Set(
    userSkills.map((s) => String(s).toLowerCase()),
  );

  return (
    <div className="ct-career-roadmap">
      <header className="ct-career-roadmap-head">
        <h2>{path.targetTitle}</h2>
        <p className="ct-career-roadmap-timeline">
          Timeline estimado: <strong>{path.timeline}</strong>
        </p>
      </header>

      <ol className="ct-career-milestones">
        {path.milestones.map((m, i) => {
          const skillsHave = m.skills.filter((s) =>
            userSkillsSet.has(s.toLowerCase()),
          );
          const total = m.skills.length || 1;
          const progress = Math.round((skillsHave.length / total) * 100);
          const isLast = i === path.milestones.length - 1;

          return (
            <li key={m.order} className="ct-career-milestone">
              <div className="ct-career-milestone-marker">
                <span className="ct-career-milestone-num" aria-hidden="true">
                  {m.order}
                </span>
                {!isLast && <span className="ct-career-milestone-line" />}
              </div>
              <div className="ct-career-milestone-content">
                <header className="ct-career-milestone-header">
                  <h3>{m.title}</h3>
                  <span className="ct-career-milestone-duration">
                    {m.durationWeeks} semanas
                  </span>
                </header>

                <div className="ct-career-milestone-progress">
                  <span className="ct-progress-label">
                    Skills cobertas: {skillsHave.length}/{m.skills.length}
                  </span>
                  <div
                    className="ct-progress-bar"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progresso do milestone ${m.order}: ${progress}%`}
                  >
                    <div style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="ct-career-milestone-skills">
                  {m.skills.map((skill) => {
                    const has = userSkillsSet.has(skill.toLowerCase());
                    return (
                      <span
                        key={skill}
                        className={
                          "ct-career-skill " + (has ? "have" : "missing")
                        }
                      >
                        <span aria-hidden="true">{has ? "✓" : "·"}</span>{" "}
                        {skill}
                      </span>
                    );
                  })}
                </div>

                <div className="ct-career-milestone-actions">
                  <h4>Acoes concretas:</h4>
                  <ul>
                    {m.actions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                </div>

                <div className="ct-career-milestone-evidence">
                  <strong>Evidencia pra fechar este milestone:</strong>{" "}
                  {m.evidence}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
