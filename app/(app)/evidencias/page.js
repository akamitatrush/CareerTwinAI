import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import EvidenceForm from "./EvidenceForm";
import EvidenceItem from "./EvidenceItem";

// Render dinamico: auth() (cookies) + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";
export const metadata = { title: "Evidências de competência — CareerTwin AI" };

// Labels em pt-BR pros enums do schema. Manter sincronizado com o select
// no EvidenceForm.js (mesmas chaves) e com a UI dos cards (label visivel).
export const KIND_LABEL = {
  PROJECT: "Projeto",
  CASE: "Case",
  PUBLICATION: "Publicação",
  CERTIFICATION: "Certificação",
  AWARD: "Prêmio",
  CONTRIBUTION: "Contribuição",
};

// Server component que lê do banco direto (mesmo padrao de /cvs-adaptados,
// /candidaturas). IDOR-safe: where escopa por userId da sessao.
export default async function EvidenciasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const items = await prisma.evidence.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="app-container" id="main-content">
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">Evidências de competência</h1>
          <p className="ct-gaps-sub">
            Demonstre suas skills com casos, projetos e métricas reais.
            Recrutador acredita em <strong>evidência específica</strong>, não em
            declaração genérica.
          </p>
        </div>
      </div>

      <EvidenceForm />

      <div style={{ marginTop: 28 }}>
        {items.length === 0 ? (
          <div className="ct-dash-empty">
            <h2>Nenhuma evidência ainda</h2>
            <p>
              Adicione projetos, cases, publicações e certificações pra
              fortalecer seu perfil. Quanto mais específico (com métrica +
              skill + período), mais convincente.
            </p>
          </div>
        ) : (
          <div className="ct-evidence-list">
            {items.map((e) => (
              <EvidenceItem
                key={e.id}
                evidence={e}
                kindLabel={KIND_LABEL[e.kind] || e.kind}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
