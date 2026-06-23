// POST /api/billing/portal
// Resposta: { url } pro Stripe Customer Portal (Stripe-hosted).
//
// SEGURANCA: customerId resolvido pela Subscription do user logado.
// Sem session => 401. Sem customer (free user) => 404. Defesa contra
// vazamento de portal de outro user via parametro forjado.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
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

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
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
