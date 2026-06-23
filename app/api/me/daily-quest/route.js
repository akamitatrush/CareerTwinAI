// GET /api/me/daily-quest — retorna a quest do dia do user logado. Lazy create:
// se ainda nao existe (userId, questDate=hoje), gera baseado no estado e persiste.
// Idempotente: dois GETs no mesmo dia retornam a MESMA quest (unique constraint
// + upsert padrao via "find-then-create-on-miss" em transaction).
//
// Seguranca (skill seguranca-careertwin):
//  - auth() obrigatorio. 401 generico.
//  - IDOR-safe: userId vem SEMPRE da sessao, NUNCA do client.
//  - Sem input do usuario aqui — nada pra validar com Zod (GET puro).
//  - Rate-limit: 30/min (volume tipico: 1 visita/dia ao dashboard).
//  - Template hardcoded em /lib/daily-quest-templates (sem LLM) — sem
//    superficie de prompt injection.
//
// Por que questDate como DATE (sem hora):
//  - Unique constraint (userId, questDate) so funciona se o "dia" for
//    truncado. Usar timestamp full quebra o uniqueness (ms diferentes = duas
//    quests no mesmo dia). Usamos UTC midnight pra evitar drift de timezone
//    afetar quem o que e "hoje".

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import {
  pickKindForUser,
  pickTemplate,
  QUEST_KINDS,
} from "@/lib/daily-quest-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trunca uma data pro inicio do dia em UTC. Importante: questDate e DATE no
// banco, sem hora — qualquer hora-diferente quebraria a unique constraint
// (Postgres DATE compara so YYYY-MM-DD, mas Prisma envia timestamp e o cast
// considera o lado UTC). Padronizar UTC evita ambiguidade.
function todayUtc() {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Você precisa estar logado para ver sua missão do dia.",
        code: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  // Rate-limit modesto. GET barato (DB-only, sem LLM), mas evita abuso de
  // poll. perMinuteUser=30 cobre re-renders normais e dev/HMR.
  const limit = await guardLLM(req, {
    name: "daily-quest-get",
    userId: session.user.id,
    perMinuteAnon: 5,
    perMinuteUser: 30,
  });
  if (!limit.ok) return tooMany(limit);

  const userId = session.user.id;
  const questDate = todayUtc();

  try {
    // 1) Tenta achar a quest do dia. Escopo de dono enforcado no where.
    const existing = await prisma.dailyQuest.findUnique({
      where: { userId_questDate: { userId, questDate } },
    });
    if (existing) {
      return NextResponse.json({ quest: serialize(existing) });
    }

    // 2) Cria nova baseada no estado do user. Queries paralelas pra montar
    // o snapshot sem PII raw — so flags e o ultimo score.
    const [profile, evidenceCount, assessmentCount, latestSnapshot, recentDone] =
      await Promise.all([
        prisma.profile.findUnique({
          where: { userId },
          select: {
            rawCv: true,
            linkedinJson: true,
          },
        }),
        prisma.evidence.count({ where: { userId } }),
        prisma.assessmentResult.count({ where: { userId } }),
        prisma.scoreSnapshot.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { overall: true },
        }),
        prisma.dailyQuest.findMany({
          where: { userId, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 7,
          select: { kind: true },
        }),
      ]);

    const state = {
      hasCv: !!profile?.rawCv,
      hasLinkedin: !!profile?.linkedinJson,
      hasEvidence: evidenceCount > 0,
      hasAssessment: assessmentCount > 0,
      latestScore: latestSnapshot?.overall ?? null,
      completedQuests: recentDone,
    };

    const kind = pickKindForUser(state);
    // Defesa-em-profundidade: pickKindForUser ja garante allow-list, mas
    // confirmamos pra nao deixar enum invalido chegar ao Prisma.
    if (!QUEST_KINDS.includes(kind)) {
      console.error("daily-quest: kind invalido apos pickKindForUser", kind);
      return NextResponse.json(
        {
          error: "Não consegui montar a missão de hoje. Tenta de novo daqui a pouco.",
          code: "QUEST_BUILD_FAILED",
        },
        { status: 500 },
      );
    }
    const template = pickTemplate(kind);
    if (!template) {
      console.error("daily-quest: pickTemplate retornou null pra kind", kind);
      return NextResponse.json(
        {
          error: "Não consegui montar a missão de hoje. Tenta de novo daqui a pouco.",
          code: "QUEST_BUILD_FAILED",
        },
        { status: 500 },
      );
    }

    // 3) Cria. Race condition: se dois GETs simultaneos chegarem (ex: 2 tabs),
    // o segundo create bate na unique constraint (P2002). Captura e re-fetch.
    try {
      const created = await prisma.dailyQuest.create({
        data: {
          userId,
          questDate,
          kind,
          title: template.title,
          description: template.description,
          estimatedMinutes: template.estimatedMinutes,
          rewardPoints: template.rewardPoints,
        },
      });
      return NextResponse.json({ quest: serialize(created) });
    } catch (e) {
      if (e?.code === "P2002") {
        // Race: outro request criou no meio. Re-busca e retorna a vencedora.
        const winner = await prisma.dailyQuest.findUnique({
          where: { userId_questDate: { userId, questDate } },
        });
        if (winner) return NextResponse.json({ quest: serialize(winner) });
      }
      throw e;
    }
  } catch (e) {
    console.error("daily-quest GET falhou:", e?.message);
    return NextResponse.json(
      {
        error: "Não consegui carregar a missão de hoje. Tenta de novo em alguns segundos.",
        code: "PERSIST_FAILED",
      },
      { status: 500 },
    );
  }
}

// Serializa pra resposta. completedAt vira ISO string (consistente com JSON).
// Omitimos userId — cliente nao precisa, e ja foi escopado pela sessao.
function serialize(q) {
  return {
    id: q.id,
    questDate: q.questDate instanceof Date ? q.questDate.toISOString() : q.questDate,
    kind: q.kind,
    title: q.title,
    description: q.description,
    estimatedMinutes: q.estimatedMinutes,
    rewardPoints: q.rewardPoints,
    completedAt: q.completedAt
      ? q.completedAt instanceof Date
        ? q.completedAt.toISOString()
        : q.completedAt
      : null,
  };
}
