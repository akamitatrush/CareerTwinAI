import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { promptDiag } from "@/lib/prompts";
import { computeOverall } from "@/lib/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { cv, role } = await req.json();
    if (!cv || cv.trim().length < 60) {
      return NextResponse.json({ error: "Currículo muito curto para analisar." }, { status: 400 });
    }
    if (!role || !role.trim()) {
      return NextResponse.json({ error: "Cargo-alvo é obrigatório." }, { status: 400 });
    }
    const diag = await completeJSON(promptDiag(role.trim(), cv.trim()));
    diag.overall = computeOverall(diag.sub_scores); // score auditável, calculado no servidor
    return NextResponse.json(diag);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Falha na análise." }, { status: 500 });
  }
}
