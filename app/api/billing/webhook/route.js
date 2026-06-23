// POST /api/billing/webhook
// Stripe envia eventos aqui. HMAC via STRIPE_WEBHOOK_SECRET (constructEvent
// faz a verificacao com o raw body). Idempotente via BillingEvent.stripeEventId
// UNIQUE — segundo processamento pega P2002 e responde 200 sem reaplicar.
//
// SEGURANCA:
// - constructEvent valida assinatura HMAC; sem ele, qualquer um envia eventos
//   forjados (subscription ACTIVE pra qualquer userId).
// - rawBody via req.text() — Next App Router NAO pre-parsa, mantem raw bytes.
// - BillingEvent.payload guarda o data.object (Stripe nao envia PII de outros
//   users, somente do customer dono — sao dados que o user ja autorizou).
// - Handler isolado por tipo. Falha de handler => 500 => Stripe retry.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/billing/stripe";
import { PLANS } from "@/lib/billing/plans";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_MAP = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  paused: "PAUSED",
  unpaid: "PAST_DUE",
};

function resolvePlanIdFromPrice(priceId) {
  if (!priceId) return null;
  for (const [k, p] of Object.entries(PLANS)) {
    if (p.stripePriceId && p.stripePriceId === priceId) return k;
  }
  return null;
}

export async function POST(req) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 }
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("webhook: STRIPE_WEBHOOK_SECRET nao configurada");
    return NextResponse.json({ error: "config_missing" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "no_signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    // Nao logar payload (PII potencial) — so o motivo. Audit do tentativa
    // de webhook forjado e critico (forense/alerting).
    console.error("webhook: signature invalida:", e?.message);
    await audit({
      action: "SECURITY_INVALID_WEBHOOK",
      req,
      meta: { reason: "stripe_signature_invalid", error: e?.message },
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Idempotencia: stripeEventId UNIQUE. Insert primeiro pra "reservar" o evento;
  // se duplicado (P2002) retornamos 200 sem aplicar efeito de novo.
  const userIdFromMeta =
    (event.data?.object?.metadata && event.data.object.metadata.userId) || null;
  try {
    await prisma.billingEvent.create({
      data: {
        userId: userIdFromMeta,
        stripeEventId: event.id,
        type: event.type,
        payload: event.data.object,
      },
    });
  } catch (e) {
    if (e?.code === "P2002") {
      console.log("webhook: evento ja processado:", event.id);
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("webhook: log falhou:", e?.message);
    return NextResponse.json({ error: "log_failed" }, { status: 500 });
  }

  // Handlers por tipo. Stripe retry em 500 (atualiza estado eventualmente).
  // Apos cada handler bem-sucedido, registramos AuditLog com action mapeada.
  // Meta sanitizado: so id da subscription/invoice (sem dados de cartao etc).
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        await audit({
          userId: userIdFromMeta,
          action: "BILLING_SUBSCRIPTION_CREATED",
          target: `Subscription:${event.data.object?.subscription || "?"}`,
          req,
          meta: { stripeEventId: event.id, type: event.type },
        });
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpserted(event.data.object);
        // Em created/updated tipamos como CREATED. CANCELED tem evento dedicado.
        if (event.type === "customer.subscription.created") {
          await audit({
            userId: userIdFromMeta,
            action: "BILLING_SUBSCRIPTION_CREATED",
            target: `Subscription:${event.data.object?.id || "?"}`,
            req,
            meta: { stripeEventId: event.id, type: event.type },
          });
        }
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        await audit({
          userId: userIdFromMeta,
          action: "BILLING_SUBSCRIPTION_CANCELED",
          target: `Subscription:${event.data.object?.id || "?"}`,
          req,
          meta: { stripeEventId: event.id, type: event.type },
        });
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        await audit({
          userId: userIdFromMeta,
          action: "BILLING_PAYMENT_FAILED",
          target: `Invoice:${event.data.object?.id || "?"}`,
          req,
          meta: { stripeEventId: event.id, type: event.type },
        });
        break;
      default:
        // Nao processado, mas ja logado em BillingEvent.
        console.log("webhook: evento nao tratado:", event.type);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook: handler falhou:", event.type, e?.message);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId || null;
  if (!userId) {
    console.error("checkout.completed: sem userId no metadata");
    return;
  }
  const planId = session.metadata?.planId || "pro_monthly";
  // session.subscription pode ser id (string) ou objeto expandido.
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      planId,
      status: "ACTIVE",
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      planId,
      status: "ACTIVE",
    },
  });
}

async function handleSubscriptionUpserted(sub) {
  // Lookup pelo stripeSubscriptionId; cai pra metadata.userId se nao achar
  // (cenario raro: subscription criada sem pre-registro de customer).
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const planId = resolvePlanIdFromPrice(priceId) || sub.metadata?.planId || "pro_monthly";
  const status = STATUS_MAP[sub.status] || "INCOMPLETE";
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const cancelAtPeriodEnd = !!sub.cancel_at_period_end;

  // Tenta atualizar via stripeSubscriptionId (caminho normal).
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { userId: true },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        planId,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
      },
    });
    return;
  }

  // Fallback: subscription criada sem termos pre-registrado. Usa metadata.userId.
  const userId = sub.metadata?.userId || null;
  if (!userId) {
    console.error("subscription.updated: sem userId conhecido pra", sub.id);
    return;
  }
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id || null;
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      planId,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      planId,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd,
    },
  });
}

async function handleSubscriptionDeleted(sub) {
  // Marca CANCELED e volta planId pra free (Stripe ja cancelou, mas garantimos).
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { userId: true },
  });
  if (!existing) {
    console.log("subscription.deleted: subscription desconhecida:", sub.id);
    return;
  }
  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: "CANCELED",
      planId: "free",
      cancelAtPeriodEnd: false,
    },
  });
}

async function handlePaymentSucceeded(invoice) {
  // Stripe ja envia customer.subscription.updated em paralelo — log apenas.
  console.log("payment_succeeded:", invoice.id, invoice.amount_paid);
}

async function handlePaymentFailed(invoice) {
  // Subscription.updated com status past_due faz o downgrade real.
  console.log("payment_failed:", invoice.id);
}
