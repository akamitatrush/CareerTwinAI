import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptChat } from "@/lib/prompts";
import { ChatBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota efemera (tool): perfil/historico vem no body, nao persiste.
// TODO Fase 4: rate limit por sessao/IP.
export async function POST(req) {
  let parsed;
  try {
    parsed = ChatBody.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { role, perfil, gaps, history, message } = parsed.data;

  try {
    const data = await completeJSON(
      promptChat(role, perfil, gaps, history, message)
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error("chat: LLM falhou", e?.message);
    return NextResponse.json({ error: "Falha no chat." }, { status: 502 });
  }
}
