import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
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

// Tamanho do lote paralelo. 10 e um meio termo entre throughput e nao saturar
// pool do Prisma/cota de email do Resend. Em pratica: 200 users / 10 = 20
// rodadas; cada rodada custa ~2-3s (LLM-bound). Total: ~40-60s vs ~500s antes.
const BATCH_SIZE = 10;

// Constant-time compare via crypto nativo. Antes tinhamos safeCompare custom
// que reimplementava timing-safe mal (length check fora do loop vazava length).
function safeCompare(a, b) {
  if (!a || !b) return false;
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) {
    // timingSafeEqual exige mesmo length — fazer pad inline vaza length, entao
    // simulamos comparando com um buffer do mesmo tamanho que A (zerado).
    // Sempre retorna false, mas tempo gasto e consistente.
    timingSafeEqual(A, Buffer.alloc(A.length));
    return false;
  }
  return timingSafeEqual(A, B);
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

  // OTIMIZACAO: deduplica searchJobs por role. Antes, 200 users com mesmo
  // targetRole disparava 200 chamadas pra searchJobs (cada uma ~2s). Agora
  // resolvemos uma vez por role unico. Em pratica reduz tempo total e custo
  // de API externa (Adzuna/Jooble tem quota por mes).
  const uniqueRoles = Array.from(
    new Set(users.map((u) => u.profile?.targetRole).filter(Boolean))
  );
  const jobsByRole = new Map();
  await Promise.allSettled(
    uniqueRoles.map(async (role) => {
      try {
        const r = await searchJobs({ role, location: "Brasil", limit: 12 });
        jobsByRole.set(role, r?.jobs || []);
      } catch (e) {
        console.error(`digest: searchJobs("${role}") falhou:`, e?.message);
        jobsByRole.set(role, []);
      }
    })
  );

  let sent = 0;
  let skipped = 0;
  const errors = [];

  async function processUser(u) {
    const role = u.profile?.targetRole;
    const skills = u.profile?.skills || [];
    if (!role) {
      skipped++;
      return;
    }
    const jobs = jobsByRole.get(role) || [];
    if (jobs.length === 0) {
      skipped++;
      return;
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
      return;
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
  }

  // Batched paralelo. Antes era serial — 200 users * 2.5s/user = 500s,
  // estouro do timeout do Vercel Cron (60s Hobby, 300s Pro). Agora:
  // 200/10 lotes * ~3s/lote = ~60s no pior caso, dentro do limite.
  // Promise.allSettled garante que 1 user com erro nao derruba o lote.
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((u) => processUser(u)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "rejected") {
        errors.push({
          userId: batch[j].id,
          err: r.reason?.message?.slice(0, 200) || "erro",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: users.length,
    uniqueRoles: uniqueRoles.length,
    sent,
    skipped,
    failed: errors.length,
    errors: errors.slice(0, 10),
  });
}
