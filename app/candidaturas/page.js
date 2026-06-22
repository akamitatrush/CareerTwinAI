import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import KanbanClient from "./KanbanClient";

export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "SAVED", label: "Salvas" },
  { key: "APPLIED", label: "Aplicadas" },
  { key: "SCREENING", label: "Triagem" },
  { key: "INTERVIEW", label: "Entrevista" },
  { key: "OFFER", label: "Oferta" },
  { key: "REJECTED", label: "Recusadas" },
];

export default async function CandidaturasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");
  const items = await prisma.application.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  return (
    <main className="wrap" style={{ paddingTop: 24 }}>
      <header className="topbar-inner" style={{ marginBottom: 24 }}>
        <Link href="/meu-gemeo" style={{ textDecoration: "none" }}>
          <div className="brand">
            <div className="brand-mark">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#B9D90C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6" />
                <path d="M14.5 13.5l2 2 4-4.5" />
              </svg>
            </div>
            <div>
              <div className="brand-name">Minhas candidaturas</div>
              <div className="brand-sub">funil + tracking</div>
            </div>
          </div>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/meu-gemeo" className="tool-btn" style={{ textDecoration: "none" }}>
            ← Voltar pro gêmeo
          </Link>
        </div>
      </header>

      <FunnelStats items={items} />
      <KanbanClient initialItems={items} columns={COLUMNS} />
    </main>
  );
}

function FunnelStats({ items }) {
  const counts = items.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});
  const total = items.length;
  const aplicadas = (counts.APPLIED || 0) + (counts.SCREENING || 0) + (counts.INTERVIEW || 0) + (counts.OFFER || 0) + (counts.REJECTED || 0);
  const entrevistas = (counts.INTERVIEW || 0) + (counts.OFFER || 0);
  const ofertas = counts.OFFER || 0;
  const taxa = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <section className="sec" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "baseline" }}>
        <Stat n={total} label="total" />
        <Stat n={aplicadas} label="aplicadas" sub={`${taxa(aplicadas, total)}% das salvas`} />
        <Stat n={entrevistas} label="entrevistas" sub={`${taxa(entrevistas, aplicadas)}% das aplicadas`} />
        <Stat n={ofertas} label="ofertas" sub={`${taxa(ofertas, entrevistas)}% das entrevistas`} />
      </div>
    </section>
  );
}

function Stat({ n, label, sub }) {
  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, fontFamily: "Bricolage Grotesque, sans-serif" }}>{n}</div>
      <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4, color: "var(--text-muted)" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
