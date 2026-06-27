// POST /api/billing/portal
// Resposta: { url } pro Stripe Customer Portal (Stripe-hosted).
//
// SEGURANCA: customerId resolvido pela Subscription do user logado.
// Sem session => 401. Sem customer (free user) => 404. Defesa contra
// vazamento de portal de outro user via parametro forjado.
// Rate-limit (5/min/user) defende contra spam de Stripe portal sessions
// (custo $, ruido no painel Stripe). Anon bloqueado (401 antes do limit).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/billing/stripe";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function postHandler(req) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamentos ainda nao estao configurados.", code: "BILLING_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Voce precisa estar logado.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  const limit = await guardLLM(req, {
    name: "billing.portal",
    userId,
    perMinuteAnon: 0,
    perMinuteUser: 5,
  });
  if (!limit.ok) return tooMany(limit);

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Voce ainda nao tem assinatura ativa.", code: "NO_CUSTOMER" },
      { status: 404 }
    );
  }

  const origin = new URL(req.url).origin;

  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/conta`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("portal: stripe falhou:", e?.message);
    return NextResponse.json(
      { error: "Nao consegui abrir o portal agora.", code: "PORTAL_FAILED" },
      { status: 500 }
    );
  }
}

export const POST = withApiGuard(postHandler);
