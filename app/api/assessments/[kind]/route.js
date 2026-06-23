import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getByKind,
  kindFromSlug,
  ALLOWED_KINDS,
} from "@/lib/assessments/definitions";

// Render dinamico: auth() le cookies + Prisma. Sem cache estatico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aceita kind tanto como slug (disc_lite) quanto como enum (DISC_LITE) pra
// flexibilidade do caller. Tudo passa pelo allow-list — nao confiamos no
// path do cliente pra montar query.
function normalizeKind(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 30) return null;
  const upper = raw.toUpperCase();
  if (ALLOWED_KINDS.includes(upper)) return upper;
  return kindFromSlug(raw);
}

export async function GET(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await ctx.params;
  const kind = normalizeKind(params?.kind);
  if (!kind) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  try {
    // IDOR-safe: where escopa por userId da sessao. Pegamos o resultado mais
    // recente daquele tipo. Se nao houver, latest = null.
    const latest = await prisma.assessmentResult.findFirst({
      where: { userId: session.user.id, kind },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        kind: true,
        scoresJson: true,
        insights: true,
        completedAt: true,
      },
    });
    return NextResponse.json({ latest });
  } catch {
    // Detalhe do erro fica no log do servidor (Sentry), nunca vaza pro cliente.
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await ctx.params;
  const kind = normalizeKind(params?.kind);
  if (!kind) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  // Validacao defensiva do body: limite duro pra evitar abuso/DoS.
  // computeScore() de cada tipo faz validacao especifica do shape.
  let body;
  try {
    const text = await req.text();
    if (text.length > 50_000) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const def = getByKind(kind);
  if (!def) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  let scores;
  try {
    scores = def.computeScore(body.responses);
  } catch {
    // computeScore lanca "responses_invalid" pra shape errado — cliente
    // recebe 400 generico, sem expor a estrutura interna esperada.
    return NextResponse.json({ error: "responses_invalid" }, { status: 400 });
  }

  try {
    // userId SEMPRE vem da sessao (nao do body). Sem IDOR — o dono fica
    // amarrado no insert.
    const result = await prisma.assessmentResult.create({
      data: {
        userId: session.user.id,
        kind,
        scoresJson: scores,
      },
      select: {
        id: true,
        kind: true,
        scoresJson: true,
        insights: true,
        completedAt: true,
      },
    });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
