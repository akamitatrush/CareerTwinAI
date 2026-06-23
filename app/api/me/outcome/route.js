// POST /api/me/outcome — user reporta outcome de busca (self-reported OU via
// link de survey programado). Captura scoreAtTime + roleAtTime do ultimo
// ScoreSnapshot do user automaticamente (correlaciona score historico ->
// outcome). Audita OUTCOME_REPORTED com kind no meta (sem evidence raw — pode
// ter PII tipo nome de empresa que o user mencionou).
//
// GET /api/me/outcome — lista outcomes do user logado (debug/historico pessoal,
// LGPD: dados do proprio user). IDOR-safe: where escopado por session.user.id.
//
// Seguranca:
//  - auth() obrigatorio (sem session = 401 generico).
//  - Body Zod strict (OutcomeCreateBody) — rejeita userId/outros campos extras.
//  - Rate limit 5/min logado (volume baixo esperado).
//  - userId SEMPRE da sessao, nunca do body. Anti-IDOR by construction.
//  - evidence NAO vai pro audit meta (pode ter PII de empresa/cargo).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OutcomeCreateBody } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Você precisa estar logado para ver seus outcomes.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  // Limite defensivo (200) — usuario real tera 1-5 outcomes na vida.
  const items = await prisma.outcome.findMany({
    where: { userId: session.user.id },
    orderBy: { occurredAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      occurredAt: true,
      scoreAtTime: true,
      roleAtTime: true,
      monthsSearching: true,
      evidence: true,
      surveyKind: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Você precisa estar logado para reportar um resultado.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  // Rate limit defensivo. Outcome nao usa LLM mas usamos guardLLM por
  // conveniencia (mesma infra de bucket). Volume real: ~1 outcome/user/3-meses
  // — 5/min e muito acima do uso legitimo, defende contra spam de bot.
  const limit = await guardLLM(req, {
    name: "outcome",
    userId: session.user.id,
    perMinuteAnon: 1,
    perMinuteUser: 5,
  });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Não consegui entender o que foi enviado. Tente de novo.",
        code: "BAD_JSON",
      },
      { status: 400 }
    );
  }

  const parsed = OutcomeCreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Não consegui registrar — confira o tipo de resultado e os campos opcionais.",
        code: "INVALID_INPUT",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Captura scoreAtTime + roleAtTime do ULTIMO snapshot do user. Se nao tiver
  // snapshot, fica null (user reportou outcome sem ter feito diagnostico).
  // Escopo de dono enforcado no where — anti-IDOR.
  const latestSnapshot = await prisma.scoreSnapshot.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { overall: true, role: true },
  });

  try {
    const outcome = await prisma.outcome.create({
      data: {
        userId: session.user.id,
        kind: data.kind,
        scoreAtTime: latestSnapshot?.overall ?? null,
        roleAtTime: latestSnapshot?.role ?? null,
        monthsSearching: data.monthsSearching ?? null,
        evidence: data.evidence?.trim() || null,
        surveyKind: data.surveyKind || "SELF_REPORTED",
      },
      select: {
        id: true,
        kind: true,
        occurredAt: true,
        scoreAtTime: true,
        roleAtTime: true,
        surveyKind: true,
      },
    });

    // Audit: kind + surveyKind no meta (sem evidence raw — pode ter PII de
    // empresa/cargo na descricao do user). hadSnapshot indica se conseguimos
    // correlacionar com score.
    await audit({
      userId: session.user.id,
      action: "OUTCOME_REPORTED",
      target: `Outcome:${outcome.id}`,
      req,
      meta: {
        kind: outcome.kind,
        surveyKind: outcome.surveyKind,
        hadSnapshot: Boolean(latestSnapshot),
      },
    });

    return NextResponse.json({ outcome });
  } catch (e) {
    console.error("outcome create falhou:", e?.message);
    return NextResponse.json(
      {
        error: "Não consegui registrar agora. Tente novamente em alguns segundos.",
        code: "PERSIST_FAILED",
      },
      { status: 500 }
    );
  }
}
