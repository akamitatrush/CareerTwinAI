import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptInterviewQuestion, promptInterviewEval } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    if (body.action === "question") {
      const data = await completeJSON(
        promptInterviewQuestion(body.role, body.gaps || [], body.asked || [])
      );
      return NextResponse.json(data);
    }
    if (body.action === "evaluate") {
      if (!body.resposta || body.resposta.trim().length < 10) {
        return NextResponse.json({ error: "Resposta muito curta para avaliar." }, { status: 400 });
      }
      const data = await completeJSON(
        promptInterviewEval(body.role, body.pergunta, body.resposta)
      );
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Falha no simulador." }, { status: 500 });
  }
}
