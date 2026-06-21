import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptChat } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { role, perfil, gaps, history, message } = await req.json();
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    }
    const data = await completeJSON(promptChat(role, perfil, gaps || [], history || [], message));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Falha no chat." }, { status: 500 });
  }
}
