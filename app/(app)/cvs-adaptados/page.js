import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CvDetailClient from "./CvDetailClient";

// Render dinamico: auth() le cookies + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";
export const metadata = { title: "CVs adaptados — CareerTwin AI" };

// Server component que lê do banco direto (mais rapido que via API HTTP num
// server component — sem URL absoluta chata em dev/preview/prod).
//
// IDOR-safe: where escopa por userId da sessao. Lemos afterText/bullets
// (diferente do /api/tailored-cvs list, que omite por economia de bytes)
// porque o card mostra preview de 200 chars. beforeText fica de fora — so o
// detalhe (via /api/tailored-cvs/[id]) traz isso.
export default async function CvsAdaptadosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const items = await prisma.tailoredCv.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      applicationId: true,
      vagaTitulo: true,
      vagaEmpresa: true,
      createdAt: true,
      afterText: true,
      bullets: true,
    },
  });

  return (
    <main className="app-container" id="main-content">
      {/* Refresh visual (Sam) — gradient cyan + glass + hover scale.
          Sem tocar globals.css. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tailor-card-glass {
              transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
              box-shadow: var(--shadow-md);
            }
            .tailor-card-glass:hover {
              transform: scale(1.01);
              box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-cyan-glow);
              border-color: var(--accent-cyan-glow);
            }
            .tailor-card-glass .ct-tailor-btn-view {
              background: linear-gradient(140deg, var(--accent-cyan) 0%, var(--accent-cyan-deep) 100%);
              color: var(--accent-on-cyan, #08313F);
              border: 1px solid transparent;
              box-shadow: var(--shadow-md);
              transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
            }
            .tailor-card-glass .ct-tailor-btn-view:hover {
              transform: translateY(-1px);
              box-shadow: var(--shadow-lg), 0 0 0 3px var(--accent-cyan-glow);
              filter: brightness(1.04);
            }
            .tailor-card-glass .ct-tailor-btn-view:focus-visible {
              outline: none;
              box-shadow: var(--shadow-md), 0 0 0 3px var(--accent-cyan-glow);
            }
            @media (prefers-reduced-motion: reduce) {
              .tailor-card-glass,
              .tailor-card-glass:hover,
              .tailor-card-glass .ct-tailor-btn-view,
              .tailor-card-glass .ct-tailor-btn-view:hover {
                transition: none;
                transform: none;
              }
            }
          `,
        }}
      />
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">CVs adaptados</h1>
          <p className="ct-gaps-sub">
            Cada vez que você usa &ldquo;Adaptar currículo&rdquo; numa vaga, o
            resultado fica salvo aqui pra você comparar e reaproveitar.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ct-dash-empty">
          <h2>Nenhum CV adaptado ainda</h2>
          <p>
            Vá em <Link href="/oportunidades">Radar de vagas</Link>, escolha
            uma vaga e clique em &ldquo;Adaptar currículo →&rdquo;. O CV
            adaptado vai aparecer aqui.
          </p>
        </div>
      ) : (
        <div className="ct-tailor-list">
          {items.map((cv) => (
            <CvCard key={cv.id} cv={cv} />
          ))}
        </div>
      )}
    </main>
  );
}

function CvCard({ cv }) {
  const dateStr = new Date(cv.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  // Preview: primeiros 200 chars do afterText, sem quebras de linha
  // (deixa visual compacto no card).
  const fullText = cv.afterText || "";
  const preview = fullText.slice(0, 200).replace(/\n+/g, " ");
  const truncated = fullText.length > 200;
  return (
    <div className="ct-tailor-card app-glass tailor-card-glass">
      <div className="ct-tailor-card-head">
        <div>
          <h3 className="ct-tailor-card-title">{cv.vagaTitulo}</h3>
          {cv.vagaEmpresa && (
            <p className="ct-tailor-card-empresa">{cv.vagaEmpresa}</p>
          )}
        </div>
        <span className="ct-tailor-card-date">{dateStr}</span>
      </div>
      <p className="ct-tailor-card-preview">
        {preview}
        {truncated ? "…" : ""}
      </p>
      <div className="ct-tailor-card-foot">
        <CvDetailClient cvId={cv.id} />
        <Link
          href={`/cvs-adaptados/${cv.id}`}
          className="ct-tailor-btn-view"
          style={{ marginLeft: 8 }}
        >
          Ver diff
        </Link>
      </div>
    </div>
  );
}
