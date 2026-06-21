import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptOpp } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { role, perfil, gaps } = await req.json();
    if (!role || !perfil) {
      return NextResponse.json({ error: "Dados insuficientes para gerar oportunidades." }, { status: 400 });
    }
    const opp = await completeJSON(promptOpp(role, perfil, gaps || []));
    return NextResponse.json(opp);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Falha ao gerar oportunidades." }, { status: 500 });
  }
}
