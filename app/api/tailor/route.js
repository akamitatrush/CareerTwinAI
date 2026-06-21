import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptTailor } from "@/lib/prompts";
import { TailorBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota efemera (tool): cv vem no body, nao persiste. TODO Fase 4: rate limit.
export async function POST(req) {
  let parsed;
  try {
    parsed = TailorBody.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { role, cv, vaga } = parsed.data;

  try {
    const data = await completeJSON(promptTailor(role, cv, vaga));
    return NextResponse.json(data);
  } catch (e) {
    console.error("tailor: LLM falhou", e?.message);
    return NextResponse.json({ error: "Falha ao adaptar o currículo." }, { status: 502 });
  }
}
