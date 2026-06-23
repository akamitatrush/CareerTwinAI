import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptLinkedinParse } from "@/lib/prompts";
import { LinkedinParseBody, LinkedinShape } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = await guardLLM(req, { name: "linkedin", userId, perMinuteAnon: 2, perMinuteUser: 8 });
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
  const parsed = LinkedinParseBody.safeParse(body);
  if (!parsed.success) {
    const text = typeof body?.text === "string" ? body.text : "";
    if (text.trim().length < 120) {
      return NextResponse.json(
        {
          error: "Cole pelo menos as seções Sobre + Experiência do seu LinkedIn (mínimo ~120 caracteres).",
          code: "LINKEDIN_TOO_SHORT",
        },
        { status: 400 }
      );
    }
    if (text.length > 60_000) {
      return NextResponse.json(
        {
          error: "O texto colado é grande demais. Cole apenas as seções Sobre, Experiência, Formação e Skills.",
          code: "LINKEDIN_TOO_LONG",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "O conteúdo colado está em formato inválido. Tente de novo.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const { text } = parsed.data;

  let result;
  try {
    const raw = await completeJSON(promptLinkedinParse(text), {
      route: "linkedin.parse",
      userId,
    });
    const valid = LinkedinShape.safeParse(raw);
    if (!valid.success) {
      console.error("linkedin: shape invalido", valid.error?.issues?.slice(0, 3));
      return NextResponse.json(
        {
          error: "Não consegui estruturar seu LinkedIn. Cole novamente apenas as seções Sobre, Experiência, Formação e Skills.",
          code: "LLM_INVALID",
        },
        { status: 502 }
      );
    }
    result = valid.data;
  } catch (e) {
    console.error("linkedin: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu processar o LinkedIn agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }

  // Modo logado: persiste em Profile + Consent (LGPD).
  if (userId) {
    try {
      await prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          nome: result.perfil.nome || null,
          cargoAtual: result.perfil.cargo_atual || null,
          senioridade: result.perfil.senioridade || null,
          skills: result.perfil.skills || [],
          linkedinRaw: text,
          linkedinJson: result.perfil,
        },
        update: {
          nome: result.perfil.nome || undefined,
          cargoAtual: result.perfil.cargo_atual || undefined,
          senioridade: result.perfil.senioridade || undefined,
          skills: result.perfil.skills?.length ? result.perfil.skills : undefined,
          linkedinRaw: text,
          linkedinJson: result.perfil,
        },
      });
      const payloadHash = createHash("sha256").update(text).digest("hex");
      await prisma.$transaction([
        prisma.dataSource.create({
          data: {
            userId,
            kind: "LINKEDIN_PASTE",
            label: `LinkedIn colado (${(text.length / 1024).toFixed(1)} KB)`,
            sizeBytes: Buffer.byteLength(text, "utf8"),
          },
        }),
        prisma.consent.create({
          data: { userId, source: "LINKEDIN_PASTE", payloadHash },
        }),
      ]);
    } catch (e) {
      console.error("linkedin: persistencia falhou", e?.message);
    }
  }

  return NextResponse.json({
    cv: result.cv_consolidado,
    perfil: result.perfil,
  });
}
