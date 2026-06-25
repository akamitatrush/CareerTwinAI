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

      <style>{`
        .ct-evidence-form.app-glass{ padding: 24px; }
        .ct-evidence-field input:focus,
        .ct-evidence-field textarea:focus,
        .ct-evidence-field select:focus{
          outline: none;
          border-color: var(--accent-cyan-deep);
          box-shadow: 0 0 0 3px var(--accent-cyan-glow);
        }
        .ct-evidence-btn-primary{
          background: linear-gradient(140deg, var(--accent-cyan) 0%, var(--accent-cyan-deep) 100%) !important;
          color: #08313F !important;
          border: 0 !important;
          font-weight: 700;
          box-shadow: 0 4px 14px -2px var(--accent-cyan-glow);
          transition: box-shadow .15s, transform .15s;
        }
        .ct-evidence-btn-primary:hover:not(:disabled){
          box-shadow: 0 6px 20px -2px var(--accent-cyan-glow), 0 0 0 3px var(--accent-cyan-glow);
          transform: translateY(-1px);
        }
        .ct-evidence-btn-primary:focus-visible{
          outline: none;
          box-shadow: 0 4px 14px -2px var(--accent-cyan-glow), 0 0 0 3px var(--accent-cyan-glow);
        }
        .ct-evidence-add-btn{
          border: 1.5px dashed color-mix(in srgb, var(--accent-cyan-deep) 55%, var(--border));
          transition: border-color .15s, box-shadow .15s, color .15s;
        }
        .ct-evidence-add-btn:hover{
          border-color: var(--accent-cyan-deep);
          color: var(--accent-cyan-deep);
          box-shadow: 0 0 0 3px var(--accent-cyan-glow);
        }
        .ct-dash-empty.app-glass{ padding: 28px; }
      `}</style>

      <div style={{ marginTop: 28 }}>
        {items.length === 0 ? (
          <div className="ct-dash-empty app-glass">
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
