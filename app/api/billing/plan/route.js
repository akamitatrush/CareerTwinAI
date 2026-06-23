// GET /api/billing/plan
// Retorna plano atual + uso do mes/dia do user logado.
// Escopo de dono enforcado por auth() — sem IDOR.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPlan, periodKey, dayKey } from "@/lib/billing/enforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  const plan = await getUserPlan(userId);
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      trialEndsAt: true,
      planId: true,
    },
  });

  const monthKey = periodKey();
  const todayKey = dayKey();

  const meters = await prisma.usageMeter.findMany({
    where: {
      userId,
      OR: [{ periodKey: monthKey }, { periodKey: todayKey }],
    },
    select: { feature: true, count: true, periodKey: true },
  });

  const usage = {};
  for (const m of meters) {
    if (!usage[m.feature]) usage[m.feature] = {};
    usage[m.feature][m.periodKey] = m.count;
  }

  // limits com Infinity nao serializa em JSON — converte pra null pro client.
  const limitsOut = {};
  for (const [k, v] of Object.entries(plan.limits || {})) {
    limitsOut[k] = v === Infinity ? null : v;
  }

  return NextResponse.json({
    plan: {
      id: plan.id,
      name: plan.name,
      priceBRL: plan.priceBRL,
      interval: plan.interval || null,
      limits: limitsOut,
      features: plan.features,
    },
    subscription: sub,
    usage,
    period: { month: monthKey, day: todayKey },
  });
}
