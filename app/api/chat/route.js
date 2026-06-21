import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeJSON } from "@/lib/llm";
import { promptChat } from "@/lib/prompts";
import { ChatBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
