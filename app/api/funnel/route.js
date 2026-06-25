// /api/funnel — POST upsert da semana corrente + GET historico das 12 ultimas.
//
// Inspirado no caso Jamar Martins. User auto-reporta numeros semanais e o
// servidor agrega/analisa. Sem LLM aqui — tudo deterministico em lib/funnel.js.
//
// Seguranca (OWASP A01/A03/A04):
//  - auth() obrigatorio em ambos os metodos. Sem session = 401 generico.
//  - Body Zod strict (rejeita campos extras tipo userId — anti-tampering).
//  - userId SEMPRE da sessao, nunca do body. Anti-IDOR by construction.
//  - Rate limit por userId pra defender contra spam (volume real: 1 update/semana,
//    teto generoso de 30/min pra POST e 60/min pra GET).
//  - weekStart calculado no SERVIDOR (startOfWeekUTC) — user nao consegue
//    forjar semana retroativa via timestamp arbitrario.
//  - notes truncado a 500 chars pelo Zod.
//
// Audit: nao adicionamos action customizada FUNNEL_UPDATED no enum porque o
// schema da tabela AuditLog/AuditAction tem lista fechada e modifica-lo
// fugiria do escopo declarado (so FunnelEntry + relation User). O log
// continua disponivel via console em erros.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import {
  analyzeBottleneck,
  aggregateLastNWeeks,
  startOfWeekUTC,
} from "@/lib/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Limites: maximos generosos pra usuario legitimo mas defendem contra valores
// absurdos (DoS de UI, anomalia analitica). Quem aplica >500 vagas/semana ou
// recebe >20 offers/semana provavelmente esta com problema diferente.
const FunnelInputSchema = z
  .object({
    applications: z.number().int().min(0).max(500),
    callbacks: z.number().int().min(0).max(200),
    hmConversations: z.number().int().min(0).max(100),
    finals: z.number().int().min(0).max(50),
    offers: z.number().int().min(0).max(20),
    notes: z.string().max(500).optional(),
  })
  .strict()
  .refine((d) => d.callbacks <= d.applications, {
    message: "callbacks nao pode ser maior que applications",
    path: ["callbacks"],
  })
  .refine((d) => d.hmConversations <= d.callbacks, {
    message: "hmConversations nao pode ser maior que callbacks",
    path: ["hmConversations"],
  })
  .refine((d) => d.finals <= d.hmConversations, {
    message: "finals nao pode ser maior que hmConversations",
    path: ["finals"],
  })
  .refine((d) => d.offers <= d.finals, {
    message: "offers nao pode ser maior que finals",
    path: ["offers"],
  });

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Voce precisa estar logado para registrar seus numeros.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  // Rate limit: 30/min e abundante (uso real: ~1/semana). Defende contra spam.
  const limit = await guardLLM(req, {
    name: "funnel-post",
    userId: session.user.id,
    perMinuteAnon: 1,
    perMinuteUser: 30,
  });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Nao consegui entender o que foi enviado. Tente de novo.",
        code: "BAD_JSON",
      },
      { status: 400 }
    );
  }

  const parsed = FunnelInputSchema.safeParse(body);
  if (!parsed.success) {
    // Mensagens guiadas pros casos mais comuns sem vazar internals.
    const first = parsed.error?.issues?.[0];
    if (first?.path?.[0] === "callbacks" && first.message?.includes("nao pode ser maior")) {
      return NextResponse.json(
        {
          error: "Callbacks nao pode ser maior que applications. Confira os numeros.",
          code: "INVALID_HIERARCHY",
        },
        { status: 400 }
      );
    }
    if (first?.path?.[0] === "hmConversations" && first.message?.includes("nao pode ser maior")) {
      return NextResponse.json(
        {
          error: "Conversas com HM nao podem ser maior que callbacks. Confira os numeros.",
          code: "INVALID_HIERARCHY",
        },
        { status: 400 }
      );
    }
    if (first?.path?.[0] === "finals" && first.message?.includes("nao pode ser maior")) {
      return NextResponse.json(
        {
          error: "Finals nao pode ser maior que conversas com HM. Confira os numeros.",
          code: "INVALID_HIERARCHY",
        },
        { status: 400 }
      );
    }
    if (first?.path?.[0] === "offers" && first.message?.includes("nao pode ser maior")) {
      return NextResponse.json(
        {
          error: "Offers nao pode ser maior que finals. Confira os numeros.",
          code: "INVALID_HIERARCHY",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Algum campo esta em formato invalido. Use numeros inteiros entre 0 e os limites de cada estagio.",
        code: "INVALID_INPUT",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  // weekStart canonical (segunda 00:00 UTC) — calculado no servidor pra evitar
  // que user forje semana retroativa via Date.now() do cliente.
  const weekStart = startOfWeekUTC(new Date());

  // Upsert atomico no unique (userId, weekStart). userId SEMPRE da sessao.
  let entry;
  try {
    entry = await prisma.funnelEntry.upsert({
      where: {
        userId_weekStart: {
          userId: session.user.id,
          weekStart,
        },
      },
      create: {
        userId: session.user.id,
        weekStart,
        applications: data.applications,
        callbacks: data.callbacks,
        hmConversations: data.hmConversations,
        finals: data.finals,
        offers: data.offers,
        notes: data.notes?.trim() || null,
      },
      update: {
        applications: data.applications,
        callbacks: data.callbacks,
        hmConversations: data.hmConversations,
        finals: data.finals,
        offers: data.offers,
        notes: data.notes?.trim() || null,
      },
    });
  } catch (e) {
    console.error("funnel upsert falhou:", e?.message);
    return NextResponse.json(
      {
        error: "Nao consegui salvar agora. Tente novamente em alguns segundos.",
        code: "PERSIST_FAILED",
      },
      { status: 500 }
    );
  }

  // Le ultimas 4 semanas pra agregar e analisar gargalo. Ordem desc — a recem
  // upsertada e a [0]. take=4 limita a janela de analise (4 semanas e o sweet
  // spot pra ter sample size sem misturar mudancas de estrategia antigas).
  const last4 = await prisma.funnelEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 4,
  });
  const aggregated = aggregateLastNWeeks(last4, 4);
  const analysis = analyzeBottleneck(aggregated);

  return NextResponse.json({ entry, aggregated, analysis });
}

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Voce precisa estar logado para ver seus numeros.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  const limit = await guardLLM(req, {
    name: "funnel-get",
    userId: session.user.id,
    perMinuteAnon: 5,
    perMinuteUser: 60,
  });
  if (!limit.ok) return tooMany(limit);

  // 12 semanas = 3 meses. Suficiente pra ver trend sem sobrecarregar UI.
  const entries = await prisma.funnelEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 12,
  });

  const aggregated = aggregateLastNWeeks(entries, 4);
  const analysis = analyzeBottleneck(aggregated);

  return NextResponse.json({ entries, aggregated, analysis });
}
