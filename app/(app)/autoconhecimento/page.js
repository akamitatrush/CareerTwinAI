import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ALL_ASSESSMENTS, slugFromKind } from "@/lib/assessments/definitions";

// Render dinamico: auth() le cookies + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";
export const metadata = { title: "Autoconhecimento — CareerTwin AI" };

// Card de cada assessment: titulo, descricao curta, status (nao feito / feito em X).
// Clicar abre /autoconhecimento/[slug] que renderiza o formulario do kind.
const CARDS = [
  {
    kind: "DISC_LITE",
    title: "Estilo comportamental",
    desc: "12 perguntas. ~3 minutos. Mapeia teu estilo em 4 quadrantes (D/I/S/C).",
    glyph: "S",
  },
  {
    kind: "VALORES",
    title: "Seus valores",
    desc: "Escolhe os 5 valores que mais te representam no trabalho. ~2 minutos.",
    glyph: "V",
  },
  {
    kind: "IKIGAI",
    title: "Ikigai — propósito",
    desc:
      "4 reflexões abertas: o que ama, o que faz bem, o que o mundo precisa, pelo que pagariam. ~10 minutos.",
    glyph: "K",
  },
];

export default async function AutoconhecimentoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // groupBy nos resultados pra trazer o "ultimo" de cada kind numa query so.
  // IDOR-safe: where escopado pelo user da sessao.
  let latest = [];
  try {
    latest = await prisma.assessmentResult.groupBy({
      by: ["kind"],
      where: { userId: session.user.id },
      _max: { completedAt: true },
    });
  } catch {
    // Se a tabela ainda nao existir (migration nao rodou em algum ambiente),
    // o card aparece como "nao feito" — sem derrubar a pagina.
    latest = [];
  }
  const doneMap = new Map(latest.map((l) => [l.kind, l._max?.completedAt]));

  return (
    <main className="app-container" id="main-content">
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">Autoconhecimento</h1>
          <p className="ct-gaps-sub">
            Três mini-assessments pra te ajudar a entender estilo, valores e propósito.{" "}
            <strong>Uso informacional</strong> — não são diagnósticos clínicos.
          </p>
        </div>
      </div>

      <div className="ct-assessment-list">
        {CARDS.map((card) => {
          const def = ALL_ASSESSMENTS.find((a) => a.kind === card.kind);
          const doneAt = doneMap.get(card.kind);
          const slug = slugFromKind(card.kind);
          return (
            <Link
              key={card.kind}
              href={`/autoconhecimento/${slug}`}
              className="ct-assessment-card"
            >
              <div className="ct-assessment-icon" aria-hidden="true">
                {card.glyph}
              </div>
              <div className="ct-assessment-body">
                <h3 className="ct-assessment-title">{def?.title || card.title}</h3>
                <p className="ct-assessment-desc">{card.desc}</p>
                <p
                  className={
                    "ct-assessment-status" + (doneAt ? " done" : "")
                  }
                >
                  {doneAt
                    ? `Concluído em ${new Date(doneAt).toLocaleDateString("pt-BR")} · refazer?`
                    : "Não feito ainda"}
                </p>
              </div>
              <span className="ct-assessment-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          );
        })}
      </div>

      <div className="ct-assessment-disclaimer" role="note">
        <strong>Importante:</strong> esses assessments são informativos. Não substituem
        avaliação psicológica profissional, teste de personalidade validado clinicamente
        (MBTI/DISC oficial) ou consulta com psicólogo. Use como ponto de partida pra
        reflexão, não como rótulo definitivo.
      </div>
    </main>
  );
}
