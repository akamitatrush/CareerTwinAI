import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeJSON } from "@/lib/llm";
import { promptInterviewQuestion, promptInterviewEval } from "@/lib/prompts";
import { InterviewBody } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { enforceUsage } from "@/lib/billing/enforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = await guardLLM(req, { name: "interview", userId, perMinuteAnon: 5, perMinuteUser: 20 });
  if (!limit.ok) return tooMany(limit);

  // Enforcement de plano (5 simulacoes/mes no Free). Conta cada chamada
  // (question OU evaluate) — pesa LLM em ambas. enforceUsage AGORA INCREMENTA
  // ATOMICAMENTE — nao chamar trackUsage depois.
  if (userId) {
    const lim = await enforceUsage(userId, "interview");
    if (!lim.ok) {
      return NextResponse.json(
        {
          error: "Voce atingiu o limite do plano Free (5 simulacoes/mes). Faca upgrade pra Pro.",
          code: "LIMIT_REACHED",
          feature: "interview",
          plan: lim.plan,
          limit: lim.limit,
          upgradeUrl: "/precos",
        },
        { status: 402 }
      );
    }
  }

  let raw;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Não consegui entender o que foi enviado. Tente de novo.", code: "BAD_JSON" },
      { status: 400 }
    );
  }
  const parsed = InterviewBody.safeParse(raw);
  if (!parsed.success) {
    if (raw?.action !== "question" && raw?.action !== "evaluate") {
      return NextResponse.json(
        { error: "Ação inválida no simulador. Recarregue a página e tente de novo.", code: "INVALID_ACTION" },
        { status: 400 }
      );
    }
    const role = typeof raw?.role === "string" ? raw.role.trim() : "";
    if (!role) {
      return NextResponse.json(
        { error: "Diga qual cargo você quer (campo cargo-alvo) antes de simular a entrevista.", code: "ROLE_REQUIRED" },
        { status: 400 }
      );
    }
    if (raw.action === "evaluate") {
      const pergunta = typeof raw?.pergunta === "string" ? raw.pergunta.trim() : "";
      const resposta = typeof raw?.resposta === "string" ? raw.resposta.trim() : "";
      if (!pergunta) {
        return NextResponse.json(
          { error: "Faltou a pergunta a ser avaliada.", code: "QUESTION_REQUIRED" },
          { status: 400 }
        );
      }
      if (!resposta) {
        return NextResponse.json(
          { error: "Escreva sua resposta antes de pedir a avaliação.", code: "ANSWER_REQUIRED" },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: "Algum dado da simulação está em formato inválido.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  try {
    if (body.action === "question") {
      const data = await completeJSON(
        await promptInterviewQuestion(body.role, body.gaps, body.asked),
        { route: "interview.question", userId }
      );
      // Uso ja foi contabilizado em enforceUsage acima (fix TOCTOU).
      return NextResponse.json(data);
    }
    const data = await completeJSON(
      promptInterviewEval(body.role, body.pergunta, body.resposta),
      { route: "interview.eval", userId }
    );
    // Uso ja foi contabilizado em enforceUsage acima (fix TOCTOU).
    return NextResponse.json(data);
  } catch (e) {
    console.error("interview: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu rodar o simulador agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }
}
