import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeJSON } from "@/lib/llm";
import { promptTailor } from "@/lib/prompts";
import { TailorBody } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = guardLLM(req, { name: "tailor", userId, perMinuteAnon: 3, perMinuteUser: 10 });
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
  const parsed = TailorBody.safeParse(body);
  if (!parsed.success) {
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    const cv = typeof body?.cv === "string" ? body.cv : "";
    if (!role) {
      return NextResponse.json(
        { error: "Diga qual cargo você quer (campo cargo-alvo).", code: "ROLE_REQUIRED" },
        { status: 400 }
      );
    }
    if (cv.trim().length < 60) {
      return NextResponse.json(
        {
          error: "Seu currículo está muito curto. Cole pelo menos um parágrafo com experiências e habilidades.",
          code: "CV_TOO_SHORT",
        },
        { status: 400 }
      );
    }
    if (!body?.vaga || typeof body.vaga !== "object") {
      return NextResponse.json(
        { error: "Selecione uma vaga para adaptar o currículo.", code: "JOB_REQUIRED" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Algum dado está faltando ou em formato inválido. Confira cargo, currículo e vaga.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const { role, cv, vaga } = parsed.data;

  try {
    const data = await completeJSON(promptTailor(role, cv, vaga), { route: "tailor", userId });
    return NextResponse.json(data);
  } catch (e) {
    console.error("tailor: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu adaptar o currículo agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }
}
