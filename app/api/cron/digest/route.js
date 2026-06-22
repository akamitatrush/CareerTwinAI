import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchJobs } from "@/lib/jobs";
import { extractSkills, matchScore } from "@/lib/skills-taxonomy";
import { sendDigestEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron protegido por CRON_SECRET (header `x-cron-secret`).
// Configurar em Vercel: Project Settings → Cron Jobs → /api/cron/digest a cada
// segunda 09:00 BRT, com header x-cron-secret=<secret>.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_MATCH = 60;
const MAX_VAGAS_DIGEST = 5;

function safeCompare(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function POST(req) {
  return handle(req);
}
export async function GET(req) {
  // Vercel Cron faz GET. Aceitamos os dois.
  return handle(req);
}

async function handle(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Cron de digest não configurado no servidor.", code: "CRON_NOT_CONFIGURED" },
      { status: 500 }
    );
  }
  // Secret SOMENTE via header — query string vaza em logs/referer/cache.
  const got = req.headers.get("x-cron-secret") || "";
  if (!safeCompare(got, expected)) {
    return NextResponse.json(
      { error: "Acesso negado a este cron job.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  // Usuarios com digest ligado, com perfil + targetRole, e que nao receberam
  // digest nos ultimos 7 dias.
  const users = await prisma.user.findMany({
    where: {
      digestEnabled: true,
      email: { not: null },
      profile: { targetRole: { not: null } },
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: cutoff } }],
    },
    select: {
      id: true,
      email: true,
      profile: {
        select: { targetRole: true, skills: true, nome: true },
      },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const u of users) {
    try {
      const role = u.profile?.targetRole;
      const skills = u.profile?.skills || [];
      if (!role) {
        skipped++;
        continue;
      }
      const { jobs } = await searchJobs({ role, location: "Brasil", limit: 12 });
      if (!jobs || jobs.length === 0) {
        skipped++;
        continue;
      }
      // Enriquece com match score e filtra fixtures.
      const top = jobs
        .filter((j) => j.source !== "fixtures")
        .map((j) => {
          const jobSkills = extractSkills(`${j.titulo} ${j.descricao}`);
          const { match } = matchScore({ profileSkills: skills, jobSkills });
          return { ...j, match };
        })
        .filter((j) => j.match >= MIN_MATCH)
        .sort((a, b) => b.match - a.match)
        .slice(0, MAX_VAGAS_DIGEST);

      if (top.length === 0) {
        skipped++;
        continue;
      }

      await sendDigestEmail({
        to: u.email,
        nome: u.profile?.nome,
        role,
        vagas: top,
      });
      await prisma.user.update({
        where: { id: u.id },
        data: { lastDigestAt: new Date() },
      });
      sent++;
    } catch (e) {
      errors.push({ userId: u.id, err: e?.message || "erro" });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: users.length,
    sent,
    skipped,
    errors: errors.slice(0, 10),
  });
}
