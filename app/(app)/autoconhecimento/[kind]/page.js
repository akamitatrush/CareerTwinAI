import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getByKind, kindFromSlug } from "@/lib/assessments/definitions";
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
  // responses.
  const definition = {
    kind: def.kind,
    title: def.title,
    intro: def.intro,
    type: def.type,
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

  return (
    <main className="app-container" id="main-content">
      <div className="ct-gaps-header">
        <div>
          <Link href="/autoconhecimento" className="ct-assessment-back">
            ← Voltar para autoconhecimento
          </Link>
          <h1 className="ct-gaps-title" style={{ marginTop: 8 }}>
            {def.title}
          </h1>
          <p className="ct-gaps-sub">{def.intro}</p>
        </div>
      </div>

      <AssessmentClient definition={definition} initialResult={latest} />

      <div className="ct-assessment-disclaimer" role="note">
        <strong>Lembrete:</strong> esse assessment é informativo. O resultado não é
        diagnóstico clínico, não substitui MBTI/DISC oficial nem consulta com
        psicólogo. Use como reflexão, não como rótulo.
      </div>
    </main>
  );
}
