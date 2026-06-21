import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptTailor } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { role, cv, vaga } = await req.json();
    if (!cv || !vaga) {
      return NextResponse.json({ error: "Dados insuficientes para adaptar o currículo." }, { status: 400 });
    }
    const data = await completeJSON(promptTailor(role, cv, vaga));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Falha ao adaptar o currículo." }, { status: 500 });
  }
}
