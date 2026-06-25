import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin-access";

// Pagina /admin — visao de uso pra owners. Mesma logica do /api/admin/usage
// mas SSR direto (sem fetch publico). Owner-only via OWNER_EMAILS env.
//
// Acesso:
//  - Nao logado → redirect /entrar
//  - Logado mas nao-owner → redirect /dashboard
//  - Owner → render

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Uso do produto" };

const WINDOW_DAYS = 14;

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtRelative(d) {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "agora há pouco";
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days}d atrás`;
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/entrar");
  if (!isAdminEmail(session.user.email)) redirect("/dashboard");

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    profileCount,
    snapshotCount,
    recentSnapshots,
    activeSessions,
    tailoredCount,
    applicationsCount,
    gapsCompletedCount,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.scoreSnapshot.count(),
    prisma.scoreSnapshot.count({ where: { createdAt: { gte: since } } }),
    prisma.session.count({ where: { expires: { gte: new Date() } } }),
    prisma.tailoredCv.count(),
    prisma.application.count(),
    prisma.gap.count({ where: { completedAt: { not: null } } }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        profile: {
          select: { targetRole: true, welcomedAt: true, updatedAt: true },
        },
        _count: {
          select: {
            snapshots: true,
            tailoredCvs: true,
            applications: true,
          },
        },
        snapshots: {
          select: { createdAt: true, overall: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const ownerEmails = String(process.env.OWNER_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const owners = users
    .filter((u) => u.email && ownerEmails.includes(u.email.toLowerCase().trim()))
    .map((u) => ({
      ...u,
      lastSnapshot: u.snapshots[0] || null,
    }));

  const publicCount = totalUsers - owners.length;

  return (
    <main id="main-content" className="app-container">
      <header className="ct-page-header">
        <div className="ct-page-header-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 13l3-3 4 4 5-5" />
          </svg>
        </div>
        <div className="ct-page-header-content">
          <div className="ct-page-header-eyebrow">ADMIN · USO DO PRODUTO</div>
          <h1 className="ct-page-header-title">Quem testou e o que fizeram</h1>
          <p className="ct-page-header-sub">
            Visão de uso da equipe autorizada (OWNER_EMAILS) + total do produto.
            Acesso restrito por ADMIN_EMAILS — apenas você vê isso.
          </p>
        </div>
      </header>

      {/* KPIs principais */}
      <section className="ct-kpi-strip" style={{ marginBottom: 24 }}>
        <div className="ct-kpi-card">
          <div className="ct-kpi-num">{totalUsers}</div>
          <div className="ct-kpi-label">Total de usuários</div>
          <div className="ct-kpi-sub">{owners.length} owners · {publicCount} público</div>
        </div>
        <div className="ct-kpi-card">
          <div className="ct-kpi-num ct-accent-text">{snapshotCount}</div>
          <div className="ct-kpi-label">Diagnósticos rodados</div>
          <div className="ct-kpi-sub">{recentSnapshots} nos últimos {WINDOW_DAYS} dias</div>
        </div>
        <div className="ct-kpi-card">
          <div className="ct-kpi-num">{activeSessions}</div>
          <div className="ct-kpi-label">Sessões ativas</div>
          <div className="ct-kpi-sub">Login válido agora</div>
        </div>
        <div className="ct-kpi-card">
          <div className="ct-kpi-num">{tailoredCount}</div>
          <div className="ct-kpi-label">CVs adaptados</div>
          <div className="ct-kpi-sub">{applicationsCount} candidaturas · {gapsCompletedCount} gaps fechados</div>
        </div>
      </section>

      <hr className="ct-section-divider" />

      {/* Tabela de owners (quem você autorizou) */}
      <section style={{ marginBottom: 24 }}>
        <div className="ct-section-eyebrow" style={{ marginBottom: 8 }}>
          OWNERS AUTORIZADOS
        </div>
        <h2 style={{ marginTop: 0 }}>Atividade dos teus convidados</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 18, fontSize: 14 }}>
          Pessoas listadas em <code>OWNER_EMAILS</code>. Plano <code>pro_yearly</code> automático
          (sem cap diário). Atividade real de quem você autorizou pra testar.
        </p>

        {owners.length === 0 ? (
          <div className="ct-empty-state-v2">
            <div className="ct-empty-state-v2-icon" aria-hidden="true">∅</div>
            <div className="ct-empty-state-v2-title">Nenhum owner ativo ainda</div>
            <div className="ct-empty-state-v2-desc">
              Você convidou {ownerEmails.length} email(s) via <code>OWNER_EMAILS</code> mas
              ninguém logou ainda. Quando logarem (magic link ou OAuth), aparecem aqui.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13.5,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
            }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>Email</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>Cargo-alvo</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center" }}>Diags</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center" }}>Score</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center" }}>CVs</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center" }}>Apps</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>Última atividade</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>Conta criada</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((u) => {
                  const lastActivity = u.lastSnapshot?.createdAt || u.profile?.updatedAt || u.createdAt;
                  const isYou = u.email === session.user.email;
                  return (
                    <tr key={u.id} style={{
                      borderTop: "1px solid var(--border)",
                      background: isYou ? "var(--accent-cyan-glow)" : "transparent",
                    }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {u.email}
                        {isYou && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent-cyan-deep)", fontWeight: 700 }}>(você)</span>}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                        {u.profile?.targetRole || <span style={{ opacity: 0.4 }}>— sem cargo</span>}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span className={u._count.snapshots > 0 ? "ct-accent-text" : ""} style={{ fontWeight: 700 }}>
                          {u._count.snapshots}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>
                        {u.lastSnapshot?.overall ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>{u._count.tailoredCvs}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>{u._count.applications}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {fmtRelative(lastActivity)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12.5 }}>
                        {fmtDate(u.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr className="ct-section-divider" />

      {/* Legenda + dicas */}
      <section style={{ marginBottom: 24, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <div className="ct-section-eyebrow" style={{ marginBottom: 8 }}>
          O QUE ESSES NÚMEROS DIZEM
        </div>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Diags</strong>: quantas vezes a pessoa rodou o diagnóstico (incluindo refresh)</li>
          <li><strong>Score</strong>: Career Health do último snapshot</li>
          <li><strong>CVs</strong>: currículos tailored por vaga (usou <code>/api/tailor</code>)</li>
          <li><strong>Apps</strong>: candidaturas adicionadas no kanban</li>
          <li><strong>Última atividade</strong>: data do último diagnóstico ou edição de perfil</li>
        </ul>
        <p style={{ marginTop: 14 }}>
          <strong>Pra ver tudo</strong> (eventos detalhados, funil, retenção): PostHog dashboard com
          filtro <code>is_owner: true</code>. Aqui é o resumo dentro do próprio produto.
        </p>
      </section>
    </main>
  );
}
