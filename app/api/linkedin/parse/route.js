import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { promptLinkedinParse } from "@/lib/prompts";
import { LinkedinParseBody, LinkedinShape } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { trackTokenUsage, checkDailyBudget, getUserPlan } from "@/lib/billing/enforce";
import { audit } from "@/lib/audit";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = await guardLLM(req, { name: "linkedin", userId, perMinuteAnon: 2, perMinuteUser: 8 });
  if (!limit.ok) return tooMany(limit);

  // Wave 11: cost amplification defense. Sem feature counter mensal, mas tem
  // cap diario USD aggregate. Anon nao tem userId => budget retorna ok=true
  // (rate-limit acima ja cobre anonimos).
  let userPlan = null;
  if (userId) {
    userPlan = (await getUserPlan(userId)).id;
    const budget = await checkDailyBudget(userId, userPlan);
    if (!budget.ok) {
      await audit({
        userId,
        action: "SECURITY_BUDGET_EXCEEDED",
        target: `User:${userId}`,
        req,
        meta: { feature: "linkedin", used: budget.used, cap: budget.cap },
      });
      return NextResponse.json(
        {
          error: "Você atingiu o limite diário de uso de IA. Volte amanhã ou faça upgrade.",
          code: "BUDGET_EXCEEDED",
          used: budget.used,
          cap: budget.cap,
          upgradeUrl: "/precos",
        },
        { status: 402 }
      );
    }
  }

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
  let llmUsage = null;
  try {
    const { result: raw, usage } = await completeJSONWithUsage(promptLinkedinParse(text), {
      route: "linkedin.parse",
      userId,
    });
    llmUsage = usage;
    const valid = LinkedinShape.safeParse(raw);
    if (!valid.success) {
      console.error("linkedin: shape invalido", valid.error?.issues?.slice(0, 3));
      // Tokens ja gastos — track antes de retornar 502.
      if (userId && llmUsage) await trackTokenUsage(userId, "linkedin", llmUsage);
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

  // Token tracking + post-budget audit (Wave 11). Falha silenciosa.
  if (userId && llmUsage) {
    await trackTokenUsage(userId, "linkedin", llmUsage);
    try {
      const budgetAfter = await checkDailyBudget(userId, userPlan);
      if (!budgetAfter.ok) {
        await audit({
          userId,
          action: "SECURITY_BUDGET_EXCEEDED",
          target: `User:${userId}`,
          req,
          meta: {
            feature: "linkedin",
            used: budgetAfter.used,
            cap: budgetAfter.cap,
            phase: "post-llm",
          },
        });
      }
    } catch (e) {
      console.error("linkedin: post-budget check falhou", e?.message);
    }
  }

  // Modo logado: persiste em Profile + Consent (LGPD).
  // TTL 90 dias: rawCvExpiresAt cobre TANTO rawCv quanto linkedinRaw — cron
  // redact-cv apaga ambos quando expira. Sem isso, linkedinRaw fica indefinido
  // (LGPD violation — security reaudit 2026-06-23 issue #1).
  if (userId) {
    try {
      const ttlExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
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
          rawCvExpiresAt: ttlExpiresAt,
          rawCvRedactedAt: null,
        },
        update: {
          nome: result.perfil.nome || undefined,
          cargoAtual: result.perfil.cargo_atual || undefined,
          senioridade: result.perfil.senioridade || undefined,
          skills: result.perfil.skills?.length ? result.perfil.skills : undefined,
          linkedinRaw: text,
          linkedinJson: result.perfil,
          rawCvExpiresAt: ttlExpiresAt,
          rawCvRedactedAt: null,
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

export const POST = withApiGuard(handler);
