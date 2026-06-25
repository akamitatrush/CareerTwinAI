import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin-access";
import {
  isAdminAuthenticated,
  verifyAdminPassword,
  setAdminCookie,
  clearAdminCookie,
  adminPasswordConfigured,
} from "@/lib/admin-session";

// Pagina /admin — visao de uso pro founder. Defesa em CAMADAS:
//
//  Camada 1: session logada (Auth.js)
//  Camada 2: email em ADMIN_EMAILS env
//  Camada 3: senha em ADMIN_PASSWORD via cookie HTTP-only signed (7 dias)
//
// Sem qualquer camada → form de senha ou redirect, sem expor /admin existe.
//
// Acesso:
//  - Nao logado → redirect /entrar
//  - Logado mas nao-admin email → redirect /dashboard
//  - Admin email mas sem cookie → form de senha
//  - Admin email + cookie valido → render

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

// Server action: valida senha admin. Tudo server-side, sem JS no cliente.
// Re-valida session + email (defesa) — sem isso atacante poderia POST direto
// na action mesmo deslogado. Server actions sao endpoint POST publico por
// default, entao toda action sensivel re-valida do zero.
async function adminLoginAction(formData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/entrar");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }
  const password = formData.get("password");
  if (!verifyAdminPassword(password)) {
    // Sem leak de "errou senha" no GET — só re-render do form (search param).
    // Em prod adicionar audit log AQUI quando AuditLog suportar action custom.
    redirect("/admin?err=1");
  }
  await setAdminCookie();
  redirect("/admin");
}

async function adminLogoutAction() {
  "use server";
  await clearAdminCookie();
  redirect("/admin");
}

function AdminLoginForm({ error }) {
  const passwordSet = adminPasswordConfigured();
  return (
    <main id="main-content" className="app-container" style={{ maxWidth: 480, margin: "60px auto" }}>
      <header className="ct-page-header">
        <div className="ct-page-header-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div className="ct-page-header-content">
          <div className="ct-page-header-eyebrow">ADMIN · ACESSO RESTRITO</div>
          <h1 className="ct-page-header-title">Senha necessária</h1>
          <p className="ct-page-header-sub">
            Email autorizado + segunda camada de senha. Sessão admin dura 7 dias.
          </p>
        </div>
      </header>

      {!passwordSet ? (
        <div className="ct-empty-state-v2">
          <div className="ct-empty-state-v2-icon" aria-hidden="true">⚠</div>
          <div className="ct-empty-state-v2-title">ADMIN_PASSWORD não configurado</div>
          <div className="ct-empty-state-v2-desc">
            Configure a env var <code>ADMIN_PASSWORD</code> no Vercel pra ativar a
            camada de senha. Sem isso, nenhum acesso é permitido (fail-closed).
          </div>
        </div>
      ) : (
        <form
          action={adminLoginAction}
          className="app-glass"
          style={{ marginTop: 24, padding: 24 }}
        >
          <label htmlFor="password" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
            Senha admin
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="admin-pw-input"
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 14,
              fontFamily: "var(--font-mono, monospace)",
              border: "1px solid var(--app-glass-border, var(--border))",
              borderRadius: 8,
              background: "var(--app-glass-bg, var(--surface))",
              color: "var(--text)",
              marginBottom: 12,
              transition: "box-shadow .15s, border-color .15s",
            }}
          />
          {error && (
            <div style={{
              fontSize: 13,
              color: "var(--danger, #c0392b)",
              marginBottom: 12,
              padding: "8px 12px",
              background: "rgba(192, 57, 43, 0.08)",
              borderRadius: 6,
              border: "1px solid rgba(192, 57, 43, 0.2)",
            }}>
              Senha incorreta. Tenta de novo.
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(140deg, var(--accent-cyan) 0%, var(--accent-cyan-deep) 100%)",
              color: "#08313F",
              border: "0",
              borderRadius: 8,
              cursor: "pointer",
              boxShadow: "0 4px 14px -2px var(--accent-cyan-glow)",
            }}
            className="ct-accent-glow"
          >
            Entrar
          </button>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>
            Sessão expira em 7 dias. Cookie HTTP-only signed com AUTH_SECRET.
          </p>
          <style>{`
            .admin-pw-input:focus{
              outline: none;
              border-color: var(--accent-cyan-deep);
              box-shadow: 0 0 0 3px var(--accent-cyan-glow);
            }
          `}</style>
        </form>
      )}
    </main>
  );
}

export default async function AdminPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/entrar");
  if (!isAdminEmail(session.user.email)) redirect("/dashboard");

  // Camada 3: senha. Se nao tem cookie valido, mostra form.
  const authed = await isAdminAuthenticated();
  if (!authed) {
    const params = await searchParams;
    return <AdminLoginForm error={params?.err === "1"} />;
  }

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
            Acesso restrito por ADMIN_EMAILS + senha — apenas você vê isso.
          </p>
        </div>
        <form action={adminLogoutAction} style={{ marginLeft: "auto", alignSelf: "flex-start" }}>
          <button
            type="submit"
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
            title="Encerrar sessão admin"
          >
            Sair do admin
          </button>
        </form>
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
          <div className="app-glass" style={{ overflowX: "auto", padding: 0 }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13.5,
              background: "transparent",
              border: "0",
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
