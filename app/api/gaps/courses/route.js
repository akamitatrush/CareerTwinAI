import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { suggestCoursesForGaps } from "@/lib/knowledge/course-retrieval";

// Endpoint deterministico — sem LLM, sem Prisma. Mas usa session + recebe input
// do usuario, entao mesmo assim aplica auth + validacao + rate limit.
//
// Nao precisa de IDOR check: nao acessamos nenhum recurso por id; o usuario
// passa skills livres no body e a gente sugere cursos do catalogo curado.
// (Skills nao sao recurso privado.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aceita o shape do Gap do Prisma (habilidade) e dois aliases comuns. Tetos
// rigidos pra evitar DoS no normalize() (regex Unicode em strings gigantes
// custa CPU). 50 gaps cobre qualquer caso real (snapshots tem max ~10).
const GapSchema = z
  .object({
    habilidade: z.string().min(1).max(120).optional(),
    skill: z.string().min(1).max(120).optional(),
    name: z.string().min(1).max(120).optional(),
  })
  .refine(
    (g) => Boolean(g.habilidade || g.skill || g.name),
    { message: "gap precisa ter habilidade, skill ou name" }
  );

const BodySchema = z
  .object({
    gaps: z.array(GapSchema).min(1).max(50),
  })
  .strict();

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Limite generoso: lookup local barato, mas mesmo assim tem teto pra evitar
  // abuso. Usuario autenticado: 60/min e mais que suficiente pra UI.
  const limit = guardLLM(req, {
    name: "gaps-courses",
    userId: session.user.id,
    perMinuteUser: 60,
    perMinuteAnon: 10,
  });
  if (!limit.ok) return tooMany(limit);

  let raw;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_gaps" }, { status: 400 });
  }

  try {
    const suggestions = suggestCoursesForGaps(parsed.data.gaps);
    return NextResponse.json({ suggestions });
  } catch (err) {
    // Mensagem generica pro cliente; detalhe so no servidor (sem PII — gaps
    // contem skill, nao dado pessoal).
    console.error("gaps/courses erro:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
