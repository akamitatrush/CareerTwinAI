import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { computeAdherenceTop } from "@/lib/scoring/adherence";

// Lista detalhada de skills do mercado: nome, contagem, percentual e
// status (have/missing). Usa o mesmo pool da rota /api/gaps/summary.
//
// Refactor 2026-06-29 (auditoria Gandalf): logica delegada a
// lib/scoring/adherence.js (computeAdherenceTop). UI continua consumindo
// o shape `requirements[{ name, count, pct, status }]` original.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile?.targetRole) {
      return NextResponse.json({ error: "no_target_role" }, { status: 400 });
    }

    let jobsPayload = { jobs: [], sources: [] };
    try {
      jobsPayload = await searchJobs({ role: profile.targetRole, location: "Brasil", limit: 200 });
    } catch (e) {
      console.error("gaps/requirements jobs falhou:", e?.message);
    }

    const top = computeAdherenceTop(profile.skills, jobsPayload.jobs);
    const requirements = top.requirements;
    const haveSkills = (profile.skills || []).map((s) => String(s).toLowerCase());
    const missing = requirements.filter((r) => r.status === "missing").slice(0, 8);

    const illustrativeRatio = typeof jobsPayload.illustrativeRatio === "number"
      ? jobsPayload.illustrativeRatio
      : (jobsPayload.sources.includes("fixtures") && jobsPayload.sources.length === 1 ? 1 : 0);

    return NextResponse.json({
      requirements,
      haveSkills,
      missing,
      totalJobs: jobsPayload.jobs.length,
      realCount: jobsPayload.realCount ?? jobsPayload.jobs.length,
      illustrativeRatio,
      isIllustrative: illustrativeRatio >= 0.5,
    });
  } catch (err) {
    console.error("gaps/requirements erro:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
