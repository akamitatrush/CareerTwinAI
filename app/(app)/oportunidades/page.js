import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import RadarClient from "./RadarClient";

// Render dinamico: depende de auth() (cookies) e do snapshot mais recente.
// Cachear estaticamente entregaria a tela "sem diagnostico" pra todo mundo.
export const dynamic = "force-dynamic";
export const metadata = { title: "Radar de vagas — CareerTwin AI" };

export default async function OportunidadesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const userId = session.user.id;
  const [profile, latestSnapshot] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { gaps: true },
    }),
  ]);

  // Sem cargo-alvo ou sem snapshot a busca nao tem o que ranquear. Mandamos
  // pro /dashboard em vez de chamar a API que retornaria PROFILE_REQUIRED.
  if (!profile?.targetRole || !latestSnapshot) {
    return (
      <main id="main-content" className="app-container">
        <PageHeader />
        <div
          className="ct-empty-state-v2 app-glass"
          style={{
            boxShadow:
              "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)",
          }}
        >
          <h2>Sem diagnóstico ainda</h2>
          <p>
            Faça um diagnóstico no <Link href="/dashboard">seu dashboard</Link> pra
            eu poder buscar vagas ranqueadas pelo seu perfil.
          </p>
        </div>
      </main>
    );
  }

  // Server passa o snapshotId pra rota — quando ele existe, a API ignora
  // role/perfil/gaps do body e usa o que esta no DB (mais seguro).
  const initialData = {
    snapshotId: latestSnapshot.id,
    role: latestSnapshot.role,
    perfil: latestSnapshot.perfilJson,
    gaps: latestSnapshot.gaps.map((g) => g.habilidade),
  };

  return (
    <main id="main-content" className="app-container">
      <PageHeader targetRole={profile.targetRole} />
      <RadarClient initial={initialData} />
    </main>
  );
}

// Header padrao da pagina — ct-page-header com icone radar, eyebrow, title,
// sub e (quando ha targetRole) o target pill. Extraido pra evitar duplicacao
// entre o caminho "sem diagnostico" e o caminho normal.
function PageHeader({ targetRole }) {
  return (
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
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      </div>
      <div className="ct-page-header-content">
        <div className="ct-page-header-eyebrow">RADAR · OPORTUNIDADES</div>
        <h1 className="ct-page-header-title">Radar de vagas</h1>
        <p className="ct-page-header-sub">
          Vagas reais matched ao seu perfil. Match em %, transparente.
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
    </header>
  );
}
