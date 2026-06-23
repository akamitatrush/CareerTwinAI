import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Forca render dinamico — depende de auth() (cookies) e Prisma.
export const dynamic = "force-dynamic";
export const metadata = { title: "Sua conta — CareerTwin AI" };

// --------------------------------------------------------------------------
// Schemas Zod .strict() — recusam campos extras (anti mass-assignment).
// Sem userId no schema: o id vem SEMPRE de auth() no servidor.
// --------------------------------------------------------------------------
const NameSchema = z
  .object({ name: z.string().trim().min(1).max(80) })
  .strict();

const TargetRoleSchema = z
  .object({ targetRole: z.string().trim().max(80) })
  .strict();

const DigestSchema = z
  .object({ enabled: z.union([z.literal("on"), z.literal("")]).optional() })
  .strict();

// Mensagem generica em pt-BR (nao reflete erro do banco).
function genericError(path = "/conta") {
  redirect(`${path}?erro=1`);
}

// --------------------------------------------------------------------------
// Server actions
// --------------------------------------------------------------------------
async function updateNameAction(formData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const parsed = NameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) genericError();

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name },
    });
  } catch {
    genericError();
  }
  revalidatePath("/conta");
}

async function updateTargetRoleAction(formData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const parsed = TargetRoleSchema.safeParse({
    targetRole: formData.get("targetRole") ?? "",
  });
  if (!parsed.success) genericError();

  const role = parsed.data.targetRole;
  try {
    await prisma.profile.upsert({
      where: { userId: session.user.id },
      update: { targetRole: role || null },
      create: { userId: session.user.id, targetRole: role || null },
    });
  } catch {
    genericError();
  }
  revalidatePath("/conta");
}

async function toggleDigestAction(formData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const parsed = DigestSchema.safeParse({
    enabled: formData.get("enabled") ?? "",
  });
  if (!parsed.success) genericError();

  const enabled = parsed.data.enabled === "on";
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { digestEnabled: enabled },
    });
  } catch {
    genericError();
  }
  revalidatePath("/conta");
}

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function getInitial(name, email) {
  const src = (name || email || "").trim();
  if (!src) return "?";
  return src.charAt(0).toUpperCase();
}

function formatDatePtBr(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------
export default async function ContaPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");
  const userId = session.user.id;

  // Tudo escopado por userId vindo da sessao (sem IDOR).
  const [user, profile, snapshotsCount, applicationsCount, latestSnapshot] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          digestEnabled: true,
        },
      }),
      prisma.profile.findUnique({
        where: { userId },
        select: { targetRole: true, nome: true },
      }),
      prisma.scoreSnapshot.count({ where: { userId } }),
      prisma.application.count({ where: { userId } }),
      prisma.scoreSnapshot.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { overall: true, createdAt: true },
      }),
    ]);

  if (!user) redirect("/entrar");

  const erro = searchParams?.erro === "1";
  const displayName = profile?.nome || user.name || "";
  const initial = getInitial(displayName, user.email);

  return (
    <div className="app-container">
      {/* Header simples */}
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">Sua conta</h1>
          <p className="ct-gaps-sub">
            Gerencie seu perfil, preferências e dados.
          </p>
        </div>
      </div>

      {erro && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--attention-soft)",
            border: "1px solid var(--attention-tint)",
            color: "var(--attention-deep)",
            fontSize: 13,
          }}
        >
          Não foi possível salvar agora. Tente novamente em instantes.
        </div>
      )}

      <div
        className="ct-conta-cards"
        style={{ marginTop: 20 }}
      >
        {/* ============================================================
            1. Perfil — identidade + nome editavel
            ============================================================ */}
        <section className="ct-conta-card" aria-labelledby="conta-perfil">
          <div className="ct-conta-card-head">
            <div>
              <h2 id="conta-perfil" className="ct-conta-card-title">
                Perfil
              </h2>
              <p className="ct-conta-card-sub">
                Como você aparece no gêmeo e nos emails.
              </p>
            </div>
          </div>

          <div className="ct-profile-top" style={{ borderBottom: 0, paddingBottom: 0 }}>
            <div className="ct-profile-avatar" aria-hidden="true">
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ct-profile-name">
                {displayName || "Sem nome ainda"}
              </div>
              <div className="ct-conta-readonly">
                <span style={{ fontSize: 13 }}>{user.email || "—"}</span>
                {user.emailVerified && (
                  <span className="ct-conta-badge">verificado</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text-soft)",
                  marginTop: 6,
                }}
              >
                Conta criada em {formatDatePtBr(user.createdAt)}
              </div>
            </div>
          </div>

          <form
            action={updateNameAction}
            style={{ display: "grid", gap: 8, marginTop: 18, maxWidth: 480 }}
          >
            <label htmlFor="name" className="ct-conta-label">
              Como você se chama?
            </label>
            <input
              id="name"
              name="name"
              type="text"
              maxLength={80}
              required
              defaultValue={user.name || ""}
              placeholder="Como você quer ser chamado"
              className="ct-conta-input"
            />
            <div>
              <button className="ct-conta-btn primary" type="submit">
                Salvar nome
              </button>
            </div>
          </form>
        </section>

        {/* ============================================================
            2. Cargo-alvo
            ============================================================ */}
        <section className="ct-conta-card" aria-labelledby="conta-cargo">
          <div className="ct-conta-card-head">
            <div>
              <h2 id="conta-cargo" className="ct-conta-card-title">
                Cargo-alvo
              </h2>
              <p className="ct-conta-card-sub">
                É o cargo usado pra calcular score, gerar plano e mandar digest.
              </p>
            </div>
          </div>

          <form
            action={updateTargetRoleAction}
            style={{ display: "grid", gap: 8, maxWidth: 480 }}
          >
            <label htmlFor="targetRole" className="ct-conta-label">
              Cargo-alvo
            </label>
            <input
              id="targetRole"
              name="targetRole"
              type="text"
              maxLength={80}
              defaultValue={profile?.targetRole || ""}
              placeholder="Ex: Product Manager de IA"
              className="ct-conta-input"
            />
            <div>
              <button className="ct-conta-btn primary" type="submit">
                Salvar cargo-alvo
              </button>
            </div>
          </form>
        </section>

        {/* ============================================================
            3. Stats em mosaico
            ============================================================ */}
        <section className="ct-conta-card" aria-labelledby="conta-stats">
          <div className="ct-conta-card-head">
            <div>
              <h2 id="conta-stats" className="ct-conta-card-title">
                Seu gêmeo em números
              </h2>
              <p className="ct-conta-card-sub">
                Resumo do que você acumulou até agora.
              </p>
            </div>
          </div>

          <div className="ct-conta-stats">
            <StatCard
              n={snapshotsCount}
              label="diagnósticos salvos"
              sub={snapshotsCount === 0 ? "ainda nenhum" : null}
            />
            <StatCard
              n={applicationsCount}
              label="candidaturas no funil"
              sub={applicationsCount === 0 ? "funil vazio" : null}
            />
            <StatCard
              n={latestSnapshot?.overall ?? "—"}
              label="último score"
              sub={
                latestSnapshot
                  ? `em ${formatDatePtBr(latestSnapshot.createdAt)}`
                  : "sem diagnóstico"
              }
            />
          </div>
        </section>

        {/* ============================================================
            4. Preferencias de notificacao
            ============================================================ */}
        <section className="ct-conta-card" aria-labelledby="conta-notif">
          <div className="ct-conta-card-head">
            <div>
              <h2 id="conta-notif" className="ct-conta-card-title">
                Preferências de notificação
              </h2>
              <p className="ct-conta-card-sub">
                Briefings por email: <b>diários</b> (terça a domingo, 8h BRT)
                com 3 vagas novas + 1 ação concreta, e <b>retrospectiva semanal</b>{" "}
                às segundas 9h BRT. Um toggle só, desliga ambos quando quiser.
              </p>
            </div>
          </div>

          <form
            action={toggleDigestAction}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label
              className="ct-conta-toggle"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={user.digestEnabled}
                style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: 13.5, color: "var(--text)" }}>
                Receber briefings e digest por email
              </span>
            </label>
            <button className="ct-conta-btn" type="submit">
              Salvar preferência
            </button>
          </form>
        </section>

        {/* ============================================================
            5. Privacidade & dados
            ============================================================ */}
        <section className="ct-conta-card" aria-labelledby="conta-lgpd">
          <div className="ct-conta-card-head">
            <div>
              <h2 id="conta-lgpd" className="ct-conta-card-title">
                Privacidade & dados
              </h2>
              <p className="ct-conta-card-sub">
                Você controla. A gente só guarda o que precisa pra funcionar.
              </p>
            </div>
          </div>

          <div className="ct-conta-btn-row">
            <a
              className="ct-conta-btn primary"
              href="/api/me/export"
              download
            >
              Baixar meus dados
            </a>
            <Link className="ct-conta-btn danger" href="/meus-dados">
              Apagar tudo definitivamente
            </Link>
          </div>

          <p className="ct-conta-foot">
            LGPD por construção. Exportar é JSON portável. Apagar é cascade —
            não fica nada em sombra.
          </p>
        </section>

        {/* ============================================================
            6. Sessao
            ============================================================ */}
        <section className="ct-conta-card" aria-labelledby="conta-sessao">
          <div className="ct-conta-card-head">
            <div>
              <h2 id="conta-sessao" className="ct-conta-card-title">
                Sessão
              </h2>
              <p className="ct-conta-card-sub">
                Encerra esta sessão neste navegador. Para voltar, é só pedir um
                novo magic link.
              </p>
            </div>
          </div>

          <form action={logoutAction}>
            <button className="ct-conta-btn" type="submit">
              Sair
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Componentes auxiliares (inline, sem export)
// --------------------------------------------------------------------------
function StatCard({ n, label, sub }) {
  return (
    <div className="ct-kpi-card">
      <div className="ct-kpi-value ct-kpi-primary">{n}</div>
      <div className="ct-kpi-label">{label}</div>
      {sub && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-faint)",
            marginTop: 4,
            fontWeight: 600,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
