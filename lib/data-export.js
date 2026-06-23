import { prisma } from "@/lib/db";

// Serializa TUDO que pertence a um usuario para download (LGPD: portabilidade).
// Tudo escopado por userId (sem IDOR). NAO inclui hashes/senhas (n/a) nem
// dados de outros usuarios. Inclui rawCv porque e dado do proprio dono.
export async function exportUserData(userId) {
  if (!userId) throw new Error("userId required");

  const [user, profile, snapshots, consents, dataSources, tailoredCvs, assessments, evidence] =
    await Promise.all([
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
    ]);

  return {
    exportedAt: new Date().toISOString(),
    version: "1",
    user,
    profile,
    snapshots,
    consents,
    dataSources,
    tailoredCvs,
    assessments,
    evidence,
  };
}

export async function eraseUserData(userId) {
  if (!userId) throw new Error("userId required");
  // Cascade em todas as relacoes apaga: Account, Session, Profile, ScoreSnapshot
  // (-> Gap, PlanItem), Consent, DataSource. Auth.js tambem ira invalidar a sessao.
  await prisma.user.delete({ where: { id: userId } });
}
