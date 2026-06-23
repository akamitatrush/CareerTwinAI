import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { extractSkills } from "@/lib/skills-taxonomy";

// Lista detalhada de skills do mercado: nome, contagem, percentual e
// status (have/missing). Usa o mesmo pool da rota /api/gaps/summary.
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

    const userSkills = new Set(
      (profile.skills || []).map((s) => String(s).toLowerCase())
    );

    let jobsPayload = { jobs: [], sources: [] };
    try {
      jobsPayload = await searchJobs({ role: profile.targetRole, location: "Brasil", limit: 200 });
    } catch (e) {
      console.error("gaps/requirements jobs falhou:", e?.message);
    }

    // Defensivo: evita divisao por zero quando nao retornou vaga nenhuma.
    const totalJobs = jobsPayload.jobs.length || 1;
    const skillMap = new Map();
    jobsPayload.jobs.forEach((j) => {
      const skills = extractSkills(`${j.titulo || ""} ${j.descricao || ""}`);
      skills.forEach((sk) => {
        const key = String(sk).toLowerCase();
        if (!skillMap.has(key)) skillMap.set(key, 0);
        skillMap.set(key, skillMap.get(key) + 1);
      });
    });

    const requirements = Array.from(skillMap.entries())
      .map(([skill, count]) => ({
        name: skill,
        count,
        pct: Math.round((count / totalJobs) * 100),
        status: userSkills.has(skill) ? "have" : "missing",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 18);

    const haveSkills = Array.from(userSkills);
    const missing = requirements.filter((r) => r.status === "missing").slice(0, 8);

    return NextResponse.json({
      requirements,
      haveSkills,
      missing,
      totalJobs: jobsPayload.jobs.length,
      isIllustrative:
        jobsPayload.sources.includes("fixtures") && jobsPayload.sources.length === 1,
    });
  } catch (err) {
    console.error("gaps/requirements erro:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
