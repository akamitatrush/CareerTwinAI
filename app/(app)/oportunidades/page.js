import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Icon from "@/components/Icon";
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
        <div className="ct-empty-state-v2 app-glass">
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

  // Snapshot drift detection (alerta vermelho do consolidado 2026-06-30).
  // Users que editaram Profile.targetRole ANTES do auto-refresh sincrono
  // (commit c90582e) tem snapshot orfao — pill mostra novo cargo, ranking
  // usa o velho. Sem este banner, o bug raiz reportado pelo fundador
  // sobrevive ate user salvar /conta de novo.
  const normalizeRole = (s) => String(s || "").toLowerCase().trim();
  const snapshotRoleDrift =
    normalizeRole(profile.targetRole) !== normalizeRole(latestSnapshot.role);

  return (
    <main id="main-content" className="app-container">
      <PageHeader targetRole={profile.targetRole} />
      {snapshotRoleDrift && (
        <SnapshotDriftBanner
          currentRole={profile.targetRole}
          snapshotRole={latestSnapshot.role}
        />
      )}
      <RadarClient initial={initialData} />
    </main>
  );
}

function SnapshotDriftBanner({ currentRole, snapshotRole }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        margin: "16px 0 24px",
        padding: "14px 18px",
        background: "var(--surface, rgba(255,255,255,0.03))",
        border: "1px solid var(--border-strong, rgba(255,255,255,0.12))",
        borderLeft: "3px solid var(--accent-cyan, #5BE0C4)",
        borderRadius: "var(--radius-md, 10px)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-strong, var(--text))" }}>
        Diagnóstico desatualizado pro cargo-alvo
      </p>
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-soft)", lineHeight: 1.55 }}>
        Você definiu <strong>{currentRole}</strong> como cargo-alvo, mas seu último
        diagnóstico foi gerado pra <strong>{snapshotRole}</strong>. As vagas abaixo
        ainda estão sendo ranqueadas pelo cargo antigo.
      </p>
      <Link
        href="/conta"
        style={{
          alignSelf: "flex-start",
          marginTop: 4,
          padding: "8px 14px",
          background: "var(--accent-cyan, #5BE0C4)",
          color: "var(--accent-on-cyan, #0A0A0E)",
          borderRadius: "var(--radius-sm, 6px)",
          fontWeight: 600,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Atualizar diagnóstico em /conta →
      </Link>
    </div>
  );
}

// Header padrao da pagina — ct-page-header com icone radar, eyebrow, title,
// sub e (quando ha targetRole) o target pill. Extraido pra evitar duplicacao
// entre o caminho "sem diagnostico" e o caminho normal.
function PageHeader({ targetRole }) {
  return (
    <header className="ct-page-header app-glass">
      <div className="ct-page-header-icon" aria-hidden="true">
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
          <Icon name="chevron-down" size={15} stroke={2} />
        </Link>
      )}
    </header>
  );
}
