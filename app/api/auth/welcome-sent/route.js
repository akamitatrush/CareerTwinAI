// POST /api/auth/welcome-sent
//
// Chamado pelo cliente apos o WelcomeModal montar (1x por sessao). Dispara
// sendWelcomeEmail em fire-and-forget e retorna { ok: true } imediatamente
// — o user nao espera o email pra continuar usando o produto.
//
// Auth obrigatoria: pega userId de auth(), NUNCA do body. Defense em camadas
// contra spam/IDOR.
//
// Rate limit: 10 req/min por user. Defesa contra abuse (cliente bugado em
// loop) — o sendWelcomeEmail ja eh idempotente (User.welcomeEmailSentAt),
// mas evitamos hits inuteis em Prisma + Resend.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 req/min por user.
  const limit = await guardLLM(req, {
    name: "welcome-sent",
    userId: session.user.id,
    perMinuteUser: 10,
    perMinuteAnon: 5,
  });
  if (!limit.ok) return tooMany(limit);

  // Fire-and-forget: nao bloqueia o cliente esperando Resend responder. O
  // sendWelcomeEmail e fail-safe (nunca throw), mas catch redundante por
  // garantia. Em pior caso (DB derrubado), nao quebramos o endpoint.
  sendWelcomeEmail(session.user.id).catch((e) => {
    console.error("[welcome-sent] sendWelcomeEmail rejeitou:", e?.message);
  });

  return NextResponse.json({ ok: true });
}
