import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { promptChat } from "@/lib/prompts";
import { ChatBody } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { trackTokenUsage, checkDailyBudget, getUserPlan } from "@/lib/billing/enforce";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json(
      { error: "Voce precisa estar logado pra conversar com seu gemeo.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const limit = await guardLLM(req, { name: "chat", userId, perMinuteAnon: 5, perMinuteUser: 30 });
  if (!limit.ok) return tooMany(limit);

  // Chat nao tem enforceUsage (sem limite mensal por feature — coberto por
  // rate-limit acima). Mas tem cap diario de custo USD (defesa anti
  // cost-amplification): se user passou do budget agregado, bloqueia antes
  // do LLM. Reaproveita o plano em trackTokenUsage depois.
  const userPlan = (await getUserPlan(userId)).id;
  const budget = await checkDailyBudget(userId, userPlan);
  if (!budget.ok) {
    await audit({
      userId,
      action: "SECURITY_BUDGET_EXCEEDED",
      target: `User:${userId}`,
      req,
      meta: { feature: "chat", used: budget.used, cap: budget.cap },
    });
    return NextResponse.json(
      {
        error: "Voce atingiu o limite diario de uso de IA. Volte amanha ou faca upgrade.",
        code: "BUDGET_EXCEEDED",
        used: budget.used,
        cap: budget.cap,
        upgradeUrl: "/precos",
      },
      { status: 402 }
    );
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
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) {
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!role) {
      return NextResponse.json(
        { error: "Diga qual cargo você quer (campo cargo-alvo) antes de conversar.", code: "ROLE_REQUIRED" },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { error: "Escreva uma mensagem antes de enviar.", code: "MESSAGE_REQUIRED" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Mensagem inválida ou longa demais. Tente reduzir o histórico.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const { role, history, message } = parsed.data;

  // Ownership: perfil e gaps NAO vem mais do body — sao buscados do DB pela
  // session do usuario. Evita social-engineering (user falar pra IA que ele
  // e CTO da Google pra induzir resposta sob essa premissa). IDOR-safe:
  // findUnique escopado por userId, ScoreSnapshot escopado idem.
  const [profile, latestSnapshot] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: {
        perfilJson: true,
        targetRole: true,
        nome: true,
        cargoAtual: true,
        senioridade: true,
        skills: true,
      },
    }),
    prisma.scoreSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { gaps: { select: { habilidade: true } } },
    }),
  ]);

  // perfilJson = forma completa salva no ultimo diagnostico (LLM extraiu).
  // Sem ele, monta a partir dos campos estruturados do onboarding. Usuario
  // novo (sem ambos) recebe objeto minimo — prompt trata graciosamente.
  const perfil = profile?.perfilJson || {
    nome: profile?.nome || "",
    cargo_atual: profile?.cargoAtual || "",
    senioridade: profile?.senioridade || "",
    skills: Array.isArray(profile?.skills) ? profile.skills.slice(0, 20) : [],
  };
  const gaps = (latestSnapshot?.gaps || [])
    .map((g) => g.habilidade)
    .filter(Boolean)
    .slice(0, 20);

  try {
    const { result: data, usage } = await completeJSONWithUsage(
      promptChat(role, perfil, gaps, history, message),
      { route: "chat", userId }
    );
    // Token tracking (Wave 11). Falha silenciosa.
    if (usage) {
      await trackTokenUsage(userId, "chat", usage);
      try {
        const budgetAfter = await checkDailyBudget(userId, userPlan);
        if (!budgetAfter.ok) {
          await audit({
            userId,
            action: "SECURITY_BUDGET_EXCEEDED",
            target: `User:${userId}`,
            req,
            meta: {
              feature: "chat",
              used: budgetAfter.used,
              cap: budgetAfter.cap,
              phase: "post-llm",
            },
          });
        }
      } catch (e) {
        console.error("chat: post-budget check falhou", e?.message);
      }
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("chat: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu responder agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }
}
