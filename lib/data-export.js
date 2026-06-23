import { prisma } from "@/lib/db";

// Serializa TUDO que pertence a um usuario para download (LGPD: portabilidade).
// Tudo escopado por userId (sem IDOR). NAO inclui hashes/senhas (n/a) nem
// dados de outros usuarios. Inclui rawCv porque e dado do proprio dono.
//
// Billing: incluimos Subscription (sem dados sensiveis de cartao — Stripe nao
// envia), UsageMeter (uso historico) e BillingEvent SANITIZADO (so o tipo e
// timestamp, sem o payload completo que pode conter ids internos da Stripe
// que nao agregam pro user).
export async function exportUserData(userId) {
  if (!userId) throw new Error("userId required");

  const [
    user,
    profile,
    snapshots,
    consents,
    dataSources,
    tailoredCvs,
    assessments,
    evidence,
    subscription,
    usageMeters,
    billingEventsRaw,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { gaps: true, planItems: true },
    }),
    prisma.consent.findMany({ where: { userId }, orderBy: { grantedAt: "asc" } }),
    prisma.dataSource.findMany({ where: { userId }, orderBy: { ingestedAt: "asc" } }),
    prisma.tailoredCv.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.assessmentResult.findMany({ where: { userId }, orderBy: { completedAt: "asc" } }),
    prisma.evidence.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        planId: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.usageMeter.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { feature: true, count: true, periodKey: true, createdAt: true, updatedAt: true },
    }),
    prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { processedAt: "asc" },
      select: { stripeEventId: true, type: true, processedAt: true },
    }),
  ]);

  // BillingEvent sanitizado: payload completo nao agrega pro user (sao ids
  // internos da Stripe). Mantemos so o que e auditavel/util.
  const billingEvents = billingEventsRaw.map((b) => ({
    stripeEventId: b.stripeEventId,
    type: b.type,
    processedAt: b.processedAt,
  }));

  return {
    exportedAt: new Date().toISOString(),
    version: "2",
    user,
    profile,
    snapshots,
    consents,
    dataSources,
    tailoredCvs,
    assessments,
    evidence,
    subscription,
    usageMeters,
    billingEvents,
  };
}

export async function eraseUserData(userId) {
  if (!userId) throw new Error("userId required");
  // Cascade em todas as relacoes apaga: Account, Session, Profile, ScoreSnapshot
  // (-> Gap, PlanItem), Consent, DataSource. Auth.js tambem ira invalidar a sessao.
  await prisma.user.delete({ where: { id: userId } });
}
