import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptInterviewQuestion, promptInterviewEval } from "@/lib/prompts";
import { InterviewBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota efemera (tool): nao persiste nada e nao acessa dados de outro usuario.
// TODO Fase 4: rate limit por IP/sessao.
export async function POST(req) {
  let parsed;
  try {
    parsed = InterviewBody.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const body = parsed.data;

  try {
    if (body.action === "question") {
      const data = await completeJSON(
        promptInterviewQuestion(body.role, body.gaps, body.asked)
      );
      return NextResponse.json(data);
    }
    const data = await completeJSON(
      promptInterviewEval(body.role, body.pergunta, body.resposta)
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error("interview: LLM falhou", e?.message);
    return NextResponse.json({ error: "Falha no simulador." }, { status: 502 });
  }
}
