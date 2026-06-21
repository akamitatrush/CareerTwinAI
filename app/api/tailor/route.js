import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeJSON } from "@/lib/llm";
import { promptTailor } from "@/lib/prompts";
import { TailorBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
