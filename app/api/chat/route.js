import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeJSON } from "@/lib/llm";
import { promptChat } from "@/lib/prompts";
import { ChatBody } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = guardLLM(req, { name: "chat", userId, perMinuteAnon: 5, perMinuteUser: 30 });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Não consegui entender o que foi enviado. Tente de novo.", code: "BAD_JSON" },
      { status: 400 }
    );
  }
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) {
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!role) {
      return NextResponse.json(
        { error: "Diga qual cargo você quer (campo cargo-alvo) antes de conversar.", code: "ROLE_REQUIRED" },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { error: "Escreva uma mensagem antes de enviar.", code: "MESSAGE_REQUIRED" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Mensagem inválida ou longa demais. Tente reduzir o histórico.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const { role, perfil, gaps, history, message } = parsed.data;

  try {
    const data = await completeJSON(
      promptChat(role, perfil, gaps, history, message),
      { route: "chat", userId }
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error("chat: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu responder agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }
}
