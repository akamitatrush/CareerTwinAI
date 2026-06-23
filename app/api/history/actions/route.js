import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/history/actions
// Timeline de "acoes do usuario" — unifica 4 fontes em ordem decrescente de data:
//   - Gap.completedAt          (microacao concluida)
//   - PlanItem.completedAt     (item do plano concluido)
//   - ApplicationEvent         (mudanca no funil de candidaturas)
//   - ScoreSnapshot.createdAt  (refez diagnostico — marco)
//
// Seguranca / IDOR: o brief alertou pro risco do nested where do Prisma
// (where: { snapshot: { userId } }). Em vez de confiar nisso, fazemos em
// 2 passos explicitos: primeiro carregamos os snapshotIds do user, depois
// filtramos Gap/PlanItem com snapshotId IN (...). Isso deixa o escopo de
// dono visivel no codigo e elimina qualquer ambiguidade de relacao Prisma.
// Application/ApplicationEvent seguem o mesmo principio (filtramos por
// userId direto na Application, ou via applicationId IN).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Voce precisa estar logado.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  try {
    // Passo 0: ids dos snapshots do user (escopo de dono explicito).
    const userSnapshots = await prisma.scoreSnapshot.findMany({
      where: { userId },
      select: { id: true, role: true, overall: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const snapshotIds = userSnapshots.map((s) => s.id);
    const snapshotRoleById = new Map(userSnapshots.map((s) => [s.id, s.role]));

    // 1. Gaps completados — filtra por snapshotId IN (...) (sem nested where).
    const completedGaps = snapshotIds.length
      ? await prisma.gap.findMany({
          where: {
            snapshotId: { in: snapshotIds },
            completedAt: { not: null },
          },
          orderBy: { completedAt: "desc" },
          take: 30,
        })
      : [];

    // 2. PlanItems concluidos — mesma estrategia.
    const completedPlan = snapshotIds.length
      ? await prisma.planItem.findMany({
          where: {
            snapshotId: { in: snapshotIds },
            completedAt: { not: null },
          },
          orderBy: { completedAt: "desc" },
          take: 30,
        })
      : [];

    // 3. ApplicationEvents do user — passo equivalente p/ Application.
    const userApps = await prisma.application.findMany({
      where: { userId },
      select: { id: true, titulo: true, empresa: true },
      take: 200,
    });
    const appIds = userApps.map((a) => a.id);
    const appById = new Map(userApps.map((a) => [a.id, a]));

    const appEvents = appIds.length
      ? await prisma.applicationEvent.findMany({
          where: { applicationId: { in: appIds } },
          orderBy: { occurredAt: "desc" },
          take: 30,
        })
      : [];

    // Une e formata pra timeline. .filter(date) protege contra null no completedAt
    // (defensivo: se a query mudou, nao quebra a UI).
    const timeline = [
      ...completedGaps.map((g) => ({
        type: "gap_completed",
        date: g.completedAt,
        title: `Concluiu microacao: ${g.habilidade}`,
        detail: g.microacao || "",
        tag: "Skill",
      })),
      ...completedPlan.map((p) => ({
        type: "plan_completed",
        date: p.completedAt,
        title: `Completou acao do plano: ${p.titulo}`,
        detail: p.impacto || "",
        tag: `Semana ${p.semana}`,
      })),
      ...appEvents.map((e) => {
        const app = appById.get(e.applicationId);
        const titulo = app?.titulo || "Candidatura";
        const empresa = app?.empresa || "";
        const status = e.toStatus || e.fromStatus || "atualizada";
        return {
          type: "application_event",
          date: e.occurredAt,
          title: `${titulo} — ${status}`,
          detail: empresa,
          tag: "Candidatura",
        };
      }),
      ...userSnapshots.map((s) => ({
        type: "diagnosis",
        date: s.createdAt,
        title: `Novo diagnostico (${s.role})`,
        detail: `Score: ${s.overall}`,
        tag: "Diagnostico",
      })),
    ]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 40);

    return NextResponse.json({ timeline });
  } catch (err) {
    console.error("[api/history/actions] erro:", err?.message || err);
    return NextResponse.json(
      { error: "Erro interno.", code: "INTERNAL" },
      { status: 500 }
    );
  }
}
