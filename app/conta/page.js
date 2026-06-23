import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

// Mensagem genérica em pt-BR (não reflete erro do banco).
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

  // Tudo escopado por userId vindo da sessão (sem IDOR).
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
        select: { targetRole: true },
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

  return (
    <main className="wrap" style={{ maxWidth: 880, paddingTop: 24 }}>
      <Header email={user.email || session.user.email} />

      <h1 className="hero" style={{ fontSize: 32 }}>
        Sua conta.
      </h1>
      <p className="hero-lede">
        Tudo o que define seu gêmeo num só lugar: identidade, cargo-alvo,
        preferências de notificação e controle de dados (LGPD).
      </p>

      {erro && (
        <div className="err" style={{ marginTop: 16 }}>
          Não foi possível salvar agora. Tente novamente em instantes.
        </div>
      )}

      {/* ============================================================
          1. Header card — identidade
          ============================================================ */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">01</span>
          <h2 className="sec-title">Identidade</h2>
          <p className="sec-sub">
            Seu nome aparece no gêmeo, no email semanal e em comunicações.
            Email é fixo — para trocar, fale com o suporte.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt="Avatar"
              width={64}
              height={64}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--rule)",
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "var(--accent-text)",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 28,
                flex: "none",
              }}
            >
              {getInitial(user.name, user.email)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 15 }}>
                {user.email || "—"}
              </span>
              {user.emailVerified && (
                <span
                  className="chip tgt"
                  title="Email confirmado por magic link"
                >
                  verificado
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                marginTop: 6,
              }}
            >
              Conta criada em {formatDatePtBr(user.createdAt)}
            </div>
          </div>
        </div>

        <form
          action={updateNameAction}
          style={{ display: "grid", gap: 8, maxWidth: 480 }}
        >
          <label
            htmlFor="name"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={80}
            required
            defaultValue={user.name || ""}
            placeholder="Como você quer ser chamado"
            style={{
              padding: "12px 14px",
              borderRadius: 4,
              border: "1px solid var(--rule)",
              background: "var(--surface)",
              fontFamily: "Inter, sans-serif",
              fontSize: 14.5,
            }}
          />
          <div>
            <button className="btn btn-primary" type="submit">
              Salvar nome
            </button>
          </div>
        </form>
      </div>

      {/* ============================================================
          2. Cargo-alvo padrão
          ============================================================ */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">02</span>
          <h2 className="sec-title">Cargo-alvo padrão</h2>
          <p className="sec-sub">
            Este é o cargo usado no email semanal de oportunidades. Pode mudar
            a qualquer momento.
          </p>
        </div>

        <form
          action={updateTargetRoleAction}
          style={{ display: "grid", gap: 8, maxWidth: 480 }}
        >
          <label
            htmlFor="targetRole"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Cargo-alvo
          </label>
          <input
            id="targetRole"
            name="targetRole"
            type="text"
            maxLength={80}
            defaultValue={profile?.targetRole || ""}
            placeholder="Ex.: Engenheira de Software Sênior"
            style={{
              padding: "12px 14px",
              borderRadius: 4,
              border: "1px solid var(--rule)",
              background: "var(--surface)",
              fontFamily: "Inter, sans-serif",
              fontSize: 14.5,
            }}
          />
          <div>
            <button className="btn btn-primary" type="submit">
              Salvar cargo-alvo
            </button>
          </div>
        </form>
      </div>

      {/* ============================================================
          3. Stats em mosaico
          ============================================================ */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">03</span>
          <h2 className="sec-title">Seu gêmeo em números</h2>
          <p className="sec-sub">
            Resumo do que você acumulou até agora. Cada diagnóstico vira um
            snapshot fotografado no tempo.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
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
      </div>

      {/* ============================================================
          4. Preferências de notificação
          ============================================================ */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">04</span>
          <h2 className="sec-title">Notificações</h2>
          <p className="sec-sub">
            Toda segunda 9h BRT enviamos vagas novas que dão match com seu
            perfil. Pode desligar quando quiser.
          </p>
        </div>

        <form
          action={toggleDigestAction}
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
        >
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={user.digestEnabled}
              style={{ width: 16, height: 16 }}
            />
            <span>Receber digest semanal por email</span>
          </label>
          <button className="tool-btn" type="submit">
            Salvar preferência
          </button>
        </form>
      </div>

      {/* ============================================================
          5. Privacidade & LGPD
          ============================================================ */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">05</span>
          <h2 className="sec-title">Privacidade & LGPD</h2>
          <p className="sec-sub">
            Exportar é JSON portável. Apagar é cascade real — não fica nada em
            sombra.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a className="btn btn-primary" href="/api/me/export">
            Baixar meus dados
          </a>
          <Link className="btn btn-ghost" href="/meus-dados">
            Apagar tudo definitivamente
          </Link>
        </div>
      </div>

      {/* ============================================================
          6. Sair
          ============================================================ */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">06</span>
          <h2 className="sec-title">Sessão</h2>
          <p className="sec-sub">
            Encerra esta sessão neste navegador. Para entrar de novo,
            é só pedir um novo magic link.
          </p>
        </div>
        <form action={logoutAction}>
          <button className="btn btn-ghost" type="submit">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}

// --------------------------------------------------------------------------
// Componentes auxiliares
// --------------------------------------------------------------------------
function Header({ email }) {
  return (
    <div className="topbar-inner" style={{ marginBottom: 24 }}>
      <Link href="/meu-gemeo" style={{ textDecoration: "none" }}>
        <div className="brand">
          <div className="brand-mark">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B9D90C"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6" />
              <path d="M14.5 13.5l2 2 4-4.5" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Conta</div>
            <div className="brand-sub">{email}</div>
          </div>
        </div>
      </Link>
      <div style={{ display: "flex", gap: 8 }}>
        <Link
          href="/meu-gemeo"
          className="tool-btn"
          style={{ textDecoration: "none" }}
        >
          ← Meu gêmeo
        </Link>
      </div>
    </div>
  );
}

function StatCard({ n, label, sub }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: 6,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 36,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-.02em",
          color: "var(--ink)",
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          marginTop: 8,
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "var(--ink-faint)",
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
