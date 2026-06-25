import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin-access";

// GET /api/admin/usage — visao de uso do produto. Owner-only (gated por
// OWNER_EMAILS). Retorna contagens + atividade recente dos ultimos 14 dias.
//
// Privacidade:
//  - Lista emails completos, nomes, ultima atividade — owner ja autorizou
//    esses users via OWNER_EMAILS, entao nao ha violacao de privacidade.
//    Outros emails (publico em geral) sao contados em agregado, sem PII.
//  - Sem expor IP raw (so hash sha256 ja salvo em AuditLog).
//
// Acesso: apenas user autenticado E presente em OWNER_EMAILS env var.
// 403 pra qualquer outro caso.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_DAYS = 14;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - WINDOW_MS);

  try {
    // Contagens agregadas (sem expor PII).
    const [
      totalUsers,
      profileCount,
      snapshotCount,
      recentSnapshots,
      recentSessions,
      tailoredCount,
      applicationsCount,
      gapsCompletedCount,
      ownerActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.profile.count(),
      prisma.scoreSnapshot.count(),
      prisma.scoreSnapshot.count({ where: { createdAt: { gte: since } } }),
      prisma.session.count({ where: { expires: { gte: new Date() } } }),
      prisma.tailoredCv.count(),
      prisma.application.count(),
      prisma.gap.count({ where: { completedAt: { not: null } } }),

      // Atividade detalhada dos owners autorizados (emails em OWNER_EMAILS).
      // So expomos emails/dados de quem ja foi explicitamente autorizado.
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          profile: {
            select: {
              targetRole: true,
              welcomedAt: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              snapshots: true,
              tailoredCvs: true,
              applications: true,
            },
          },
          snapshots: {
            select: { createdAt: true, overall: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50, // teto de seguranca
      }),
    ]);

    // Filtra so os owners (e marca o resto como "publico" agregado).
    const ownerEmails = String(process.env.OWNER_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const owners = ownerActivity
      .filter((u) => u.email && ownerEmails.includes(u.email.toLowerCase().trim()))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name || null,
        createdAt: u.createdAt?.toISOString() || null,
        welcomedAt: u.profile?.welcomedAt?.toISOString() || null,
        targetRole: u.profile?.targetRole || null,
        snapshotsCount: u._count?.snapshots || 0,
        tailoredCount: u._count?.tailoredCvs || 0,
        applicationsCount: u._count?.applications || 0,
        lastSnapshotAt: u.snapshots[0]?.createdAt?.toISOString() || null,
        lastScore: u.snapshots[0]?.overall ?? null,
        lastProfileUpdate: u.profile?.updatedAt?.toISOString() || null,
      }));

    const publicUserCount = totalUsers - owners.length;

    return NextResponse.json({
      windowDays: WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        profiles: profileCount,
        snapshots: snapshotCount,
        activeSessions: recentSessions,
        tailoredCvs: tailoredCount,
        applications: applicationsCount,
        gapsCompleted: gapsCompletedCount,
        publicUsers: publicUserCount,
        ownerUsers: owners.length,
      },
      recent: {
        snapshotsLast14Days: recentSnapshots,
      },
      owners,
    });
  } catch (e) {
    console.error("admin/usage erro:", e?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
