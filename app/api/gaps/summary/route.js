import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { extractSkills } from "@/lib/skills-taxonomy";

// KPI strip da pagina /gaps: vagas analisadas, skills (total/have),
// gaps de alta prioridade e aderencia media. Determinitistico (sem LLM).
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

    const userSkills = (profile.skills || []).map((s) => String(s).toLowerCase());

    // Pool grande pra agregacao estatistica (limit 200). Em fixtures cai pra ~poucas
    // vagas e o flag isIllustrative deixa o front avisar que e ilustrativo.
    let jobsPayload = { jobs: [], sources: [] };
    try {
      jobsPayload = await searchJobs({ role: profile.targetRole, location: "Brasil", limit: 200 });
    } catch (e) {
      console.error("gaps/summary jobs falhou:", e?.message);
    }

    const totalJobs = jobsPayload.jobs.length;

    // Conta skills extraidas de titulo + descricao de cada vaga.
    const allRequiredSkills = new Map();
    jobsPayload.jobs.forEach((j) => {
      const jobSkills = extractSkills(`${j.titulo || ""} ${j.descricao || ""}`);
      jobSkills.forEach((sk) => {
        const key = String(sk).toLowerCase();
        if (!allRequiredSkills.has(key)) allRequiredSkills.set(key, { count: 0 });
        allRequiredSkills.get(key).count++;
      });
    });

    // Top 18 mais pedidas (espelha o widget de requirements).
    const topRequired = Array.from(allRequiredSkills.entries())
      .map(([skill, data]) => ({
        skill,
        count: data.count,
        freq: totalJobs > 0 ? Math.round((data.count / totalJobs) * 100) : 0,
        userHas: userSkills.includes(skill),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 18);

    const skillsHave = topRequired.filter((s) => s.userHas).length;
    // "High priority" = skill que aparece em 70%+ das vagas e o usuario NAO tem.
    const highPriorityGaps = topRequired.filter((s) => !s.userHas && s.freq >= 70).length;

    // Aderencia media ponderada por frequencia: skills muito pedidas pesam mais.
    const totalWeight = topRequired.reduce((sum, s) => sum + s.freq, 0);
    const matchedWeight = topRequired
      .filter((s) => s.userHas)
      .reduce((sum, s) => sum + s.freq, 0);
    const adherence = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    return NextResponse.json({
      totalJobs,
      skillsRequired: topRequired.length,
      skillsHave,
      highPriorityGaps,
      adherence,
      isIllustrative:
        jobsPayload.sources.includes("fixtures") && jobsPayload.sources.length === 1,
    });
  } catch (err) {
    console.error("gaps/summary erro:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
