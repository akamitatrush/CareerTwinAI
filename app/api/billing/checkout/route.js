// POST /api/billing/checkout
// Body: { planId: "pro_monthly" | "pro_yearly" | "team_monthly" }
// Resposta: { url } pra redirect ao Stripe Checkout (Stripe-hosted).
//
// SEGURANCA:
// - userId vem de auth(), JAMAIS do body — sem isso seria IDOR (qualquer um
//   compraria pra outro).
// - planId validado contra PLANS (whitelist). "free" rejeitado explicitamente.
// - Stripe customer criado/recuperado server-side e amarrado a session.user.id
//   via metadata. Webhook usa esse metadata pra reconciliar.
// - 503 se billing nao configurado (build sem Stripe nao quebra).
// - Rate-limit (3/min/user) defende contra spam de Stripe sessions (custo $,
//   ruido no painel). Anon bloqueado (401 antes do limit).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/billing/stripe";
import { getPlan } from "@/lib/billing/plans";
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
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: "Voce precisa estar logado pra assinar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const userId = session.user.id;
  const userEmail = session.user.email;

  const limit = await guardLLM(req, {
    name: "billing.checkout",
    userId,
    perMinuteAnon: 0,
    perMinuteUser: 3,
  });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Nao consegui entender o que foi enviado.", code: "BAD_JSON" },
      { status: 400 }
    );
  }

  // Whitelist: getPlan retorna free por default — bloqueia explicitamente.
  const planIdRaw = typeof body?.planId === "string" ? body.planId : "";
  if (!planIdRaw || planIdRaw === "free") {
    return NextResponse.json(
      { error: "Plano invalido.", code: "INVALID_PLAN" },
      { status: 400 }
    );
  }
  const plan = getPlan(planIdRaw);
  if (plan.id === "free" || !plan.stripePriceId) {
    return NextResponse.json(
      { error: "Plano invalido.", code: "INVALID_PLAN" },
      { status: 400 }
    );
  }

  // Cria ou recupera Stripe customer, sempre amarrado ao userId.
  let customerId = null;
  try {
    const existingSub = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });
    customerId = existingSub?.stripeCustomerId || null;

    if (!customerId) {
      const customer = await stripe().customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;
      // Pre-cria/upserta Subscription marcando customer — webhook
      // checkout.session.completed completa com subscriptionId + status.
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customerId,
          planId: "free",
          status: "INCOMPLETE",
        },
        update: {
          stripeCustomerId: customerId,
        },
      });
    }
  } catch (e) {
    console.error("checkout: customer setup falhou:", e?.message);
    return NextResponse.json(
      { error: "Nao consegui iniciar o checkout. Tente em alguns segundos.", code: "CUSTOMER_FAILED" },
      { status: 500 }
    );
  }

  // origin derivado da request (defesa contra deploy com URL trocada).
  const origin = new URL(req.url).origin;

  try {
    const checkoutSession = await stripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/conta/billing?success=1`,
      cancel_url: `${origin}/precos?canceled=1`,
      allow_promotion_codes: true,
      // metadata serve pra reconciliacao no webhook checkout.session.completed.
      // Nao confie nele se for sensivel — mas userId vem do auth() acima.
      metadata: { userId, planId: plan.id },
      subscription_data: {
        metadata: { userId, planId: plan.id },
      },
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("checkout: stripe falhou:", e?.message);
    return NextResponse.json(
      { error: "Nao consegui iniciar o checkout agora.", code: "CHECKOUT_FAILED" },
      { status: 500 }
    );
  }
}

export const POST = withApiGuard(postHandler);
