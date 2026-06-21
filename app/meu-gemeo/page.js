import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Report from "@/components/Report";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function MeuGemeoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");
  const userId = session.user.id;

  // Tudo escopado por userId vindo da sessao (sem IDOR).
  const [profile, snapshots] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { gaps: true, planItems: { orderBy: { semana: "asc" } } },
      take: 20,
    }),
  ]);

  const latest = snapshots[0];

  if (!latest) {
    return (
      <main className="wrap" style={{ maxWidth: 720, paddingTop: 32 }}>
        <Header email={session.user.email} />
        <h1 className="hero" style={{ fontSize: 36 }}>Seu gêmeo, ainda em branco</h1>
        <p className="hero-lede">
          Cole seu currículo na página inicial e gere o primeiro diagnóstico. A partir
          do segundo, você terá histórico de score.
        </p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
          Construir meu gêmeo →
        </Link>
        <Footer onLogout={logoutAction} />
      </main>
    );
  }

  // Reconstrucao do shape esperado pelo componente Report:
  const diag = {
    perfil: latest.perfilJson || profile?.perfilJson || {},
    sub_scores: latest.subScores || {},
    gaps: (latest.gaps || []).map((g) => ({
      habilidade: g.habilidade,
      frequencia: g.frequencia || "",
      porque: g.porque || "",
      microacao: g.microacao || "",
      impacto: {
        dimensao: g.impactoDimensao || "relevancia_habilidades",
        pontos: g.impactoPontos ?? 4,
      },
    })),
    overall: latest.overall,
  };

  // Plano persistido (de PlanItem): nao trazemos vagas (vagas sao Fase 2).
  const planoBySemana = new Map();
  for (const item of latest.planItems) {
    if (!planoBySemana.has(item.semana)) {
      planoBySemana.set(item.semana, { semana: item.semana, foco: item.foco || "", acoes: [] });
    }
    planoBySemana.get(item.semana).acoes.push({
      titulo: item.titulo,
      impacto: item.impacto || "",
      esforco: item.esforco || "Médio",
    });
  }
  const opp = {
    vagas: [],
    plano: Array.from(planoBySemana.values()).sort((a, b) => a.semana - b.semana),
  };

  return (
    <main className="wrap" style={{ paddingTop: 24 }}>
      <Header email={session.user.email} />
      <ScoreHistory snapshots={snapshots} />
      <Report
        diag={diag}
        opp={opp}
        role={latest.role}
        cv={profile?.rawCv || ""}
        footerNote={
          <>
            <b>Persistido em {new Date(latest.createdAt).toLocaleString("pt-BR")}.</b>{" "}
            Cada novo diagnóstico cria um snapshot — o histórico fica em cima.{" "}
            <Link href="/meus-dados">Meus dados / LGPD</Link>.
          </>
        }
      />
      <Footer onLogout={logoutAction} />
    </main>
  );
}

function Header({ email }) {
  return (
    <div className="topbar-inner" style={{ marginBottom: 24 }}>
      <Link href="/" style={{ textDecoration: "none" }}>
        <div className="brand">
          <div className="brand-mark">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#B9D90C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6" />
              <path d="M14.5 13.5l2 2 4-4.5" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Meu gêmeo</div>
            <div className="brand-sub">{email}</div>
          </div>
        </div>
      </Link>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/meus-dados" className="tool-btn" style={{ textDecoration: "none" }}>Meus dados</Link>
        <Link href="/" className="tool-btn" style={{ textDecoration: "none" }}>Novo diagnóstico</Link>
      </div>
    </div>
  );
}

function Footer({ onLogout }) {
  return (
    <form action={onLogout} style={{ marginTop: 48, opacity: 0.7 }}>
      <button className="btn btn-ghost" type="submit">Sair</button>
    </form>
  );
}

function ScoreHistory({ snapshots }) {
  if (snapshots.length < 2) return null;
  const max = Math.max(...snapshots.map((s) => s.overall), 100);
  return (
    <div className="sec" style={{ marginBottom: 32 }}>
      <div className="sec-head">
        <span className="sec-no">⌀</span>
        <h2 className="sec-title">Histórico do seu score</h2>
        <p className="sec-sub">Cada bolinha é um diagnóstico salvo. O número evolui conforme você refaz com um currículo mais recente.</p>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        {[...snapshots].reverse().map((s) => {
          const h = Math.max(8, Math.round((s.overall / max) * 80));
          return (
            <div key={s.id} title={new Date(s.createdAt).toLocaleString("pt-BR") + " · " + s.role} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{s.overall}</div>
              <div style={{ width: 14, height: h, background: "#B9D90C", borderRadius: 4 }} />
              <div style={{ fontSize: 10, opacity: 0.5 }}>{new Date(s.createdAt).toLocaleDateString("pt-BR")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
