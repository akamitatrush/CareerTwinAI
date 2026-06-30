import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { computeAdherenceTop } from "@/lib/scoring/adherence";

// KPI strip da pagina /gaps: vagas analisadas, skills (total/have),
// gaps de alta prioridade e aderencia top-18. Deterministico (sem LLM).
//
// Refactor 2026-06-29 (auditoria Gandalf): logica de agregacao e calculo de
// aderencia delegada a lib/scoring/adherence.js (computeAdherenceTop).
// Antes era duplicada aqui e em 3 outros sites.
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
      // Sem cargo-alvo definido nao da pra agregar mercado — UI mostra empty state.
      return NextResponse.json({ error: "no_target_role" }, { status: 400 });
    }

    // Pool grande pra agregacao estatistica (limit 200). Fixtures so se
    // nenhum provider real responder (vide lib/jobs/index.js pos-auditoria).
    let jobsPayload = { jobs: [], sources: [] };
    try {
      jobsPayload = await searchJobs({ role: profile.targetRole, location: "Brasil", limit: 200 });
    } catch (e) {
      console.error("gaps/summary jobs falhou:", e?.message);
    }

    const totalJobs = jobsPayload.jobs.length;
    const top = computeAdherenceTop(profile.skills, jobsPayload.jobs);

    const illustrativeRatio = typeof jobsPayload.illustrativeRatio === "number"
      ? jobsPayload.illustrativeRatio
      : (jobsPayload.sources.includes("fixtures") && jobsPayload.sources.length === 1 ? 1 : 0);

    return NextResponse.json({
      totalJobs,
      realCount: jobsPayload.realCount ?? totalJobs,
      skillsRequired: top.skillsRequired,
      skillsHave: top.skillsHave,
      highPriorityGaps: top.highPriorityGaps,
      adherence: top.adherence,
      illustrativeRatio,
      isIllustrative: illustrativeRatio >= 0.5,
    });
  } catch (err) {
    console.error("gaps/summary erro:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
