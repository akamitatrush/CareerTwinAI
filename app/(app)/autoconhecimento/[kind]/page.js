import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getByKind, kindFromSlug } from "@/lib/assessments/definitions";
import { AssessmentIcon } from "../icons";
import AssessmentClient from "./AssessmentClient";

// Render dinamico: auth() le cookies + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { kind: slug } = await params;
  const kind = kindFromSlug(slug);
  const def = kind ? getByKind(kind) : null;
  return {
    title: def ? `${def.title} — CareerTwin AI` : "Autoconhecimento — CareerTwin AI",
  };
}

export default async function AssessmentPage({ params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const { kind: slug } = await params;
  const kind = kindFromSlug(slug);
  // Allow-list: slug que nao bate com enum vira 404. Nunca trustamos path do
  // cliente pra montar resposta especifica.
  if (!kind) notFound();
  const def = getByKind(kind);
  if (!def) notFound();

  // Pega o ultimo resultado deste tipo (se houver) pra mostrar como
  // "ja feito" + opcao de refazer. IDOR-safe: where escopa por userId.
  let latest = null;
  try {
    latest = await prisma.assessmentResult.findFirst({
      where: { userId: session.user.id, kind },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        kind: true,
        scoresJson: true,
        completedAt: true,
      },
    });
  } catch {
    latest = null;
  }

  // Mandamos apenas o que o cliente precisa renderizar — sem userId, sem
  // detalhes internos. computeScore() roda no servidor; o client so manda
  // responses. Inclui agora `palette`, `iconKind`, `howTo` e os campos de
  // narrativa/grupos pra o resultado ficar rico sem precisar de outra request.
  const definition = {
    kind: def.kind,
    title: def.title,
    intro: def.intro,
    type: def.type,
    palette: def.palette || "indigo",
    iconKind: def.iconKind || null,
    howTo: Array.isArray(def.howTo) ? def.howTo : [],
    ...(def.type === "likert"
      ? {
          scale: def.scale,
          questions: def.questions.map((q) => ({ id: q.id, text: q.text })),
          quadrantLabels: def.quadrantLabels,
        }
      : {}),
    ...(def.type === "multiselect"
      ? {
          options: def.options,
          maxSelections: def.maxSelections,
        }
      : {}),
    ...(def.type === "openText"
      ? {
          questions: def.questions.map((q) => ({
            id: q.id,
            text: q.text,
            hint: q.hint || "",
          })),
        }
      : {}),
  };

  const palette = definition.palette;
  return (
    <main className="app-container" id="main-content">
      <Link href="/autoconhecimento" className="ct-self-back">
        ← Voltar para autoconhecimento
      </Link>

      <header className={`ct-self-kind-hero ct-self-kind-hero-${palette}`}>
        <div
          className={`ct-self-kind-icon ct-self-kind-icon-${palette}`}
          aria-hidden="true"
        >
          <AssessmentIcon kind={definition.iconKind} size={36} />
        </div>
        <div className="ct-self-kind-hero-body">
          {/* Arwen v4 — H1 unificado em ct-page-header-title (canonico). */}
          <h1 className="ct-page-header-title">{def.title}</h1>
          <p className="ct-self-kind-sub">{def.intro}</p>
        </div>
      </header>

      {definition.howTo.length > 0 && (
        <section className="ct-self-howto" aria-label="Como usar essa reflexao">
          <h2 className="ct-self-howto-title">Como usar essa reflexão</h2>
          <ol className="ct-self-howto-list">
            {definition.howTo.map((tip, i) => (
              <li key={i}>
                <span className="ct-self-howto-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <AssessmentClient definition={definition} initialResult={latest} />

      <aside className="ct-self-disclaimer" role="note">
        <strong>Lembrete:</strong> reflexão informativa, não diagnóstico
        clínico. Não substitui MBTI/DISC oficial nem consulta com psicólogo.
      </aside>
    </main>
  );
}
