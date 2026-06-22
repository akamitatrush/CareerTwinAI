import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptDiag } from "@/lib/prompts";
import { computeOverall } from "@/lib/score";
import { AnalyzeBody, DiagShape } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  // Sessao opcional: logado → persiste com escopo de dono; anonimo → efemero.
  // Nao ha IDOR aqui: persistencia so acontece quando userId vem de auth().
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = guardLLM(req, { name: "analyze", userId, perMinuteAnon: 3, perMinuteUser: 10 });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Não consegui entender o que foi enviado. Tente de novo.", code: "BAD_JSON" },
      { status: 400 }
    );
  }
  const parsed = AnalyzeBody.safeParse(body);
  if (!parsed.success) {
    // Mensagem específica por campo, sem expor o schema todo.
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    const cv = typeof body?.cv === "string" ? body.cv : "";
    if (!role) {
      return NextResponse.json(
        { error: "Diga qual cargo você quer (campo cargo-alvo).", code: "ROLE_REQUIRED" },
        { status: 400 }
      );
    }
    if (cv.trim().length < 60) {
      return NextResponse.json(
        {
          error: "Seu currículo está muito curto. Cole pelo menos um parágrafo com experiências e habilidades.",
          code: "CV_TOO_SHORT",
        },
        { status: 400 }
      );
    }
    if (cv.length > 40_000) {
      return NextResponse.json(
        {
          error: "Seu currículo passou do limite de 40 mil caracteres. Resuma para os trechos mais relevantes.",
          code: "CV_TOO_LONG",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Faltam dados ou algum campo está em formato inválido. Confira currículo e cargo-alvo.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const { cv, role } = parsed.data;

  let diag;
  try {
    const raw = await completeJSON(promptDiag(role.trim(), cv.trim()), { route: "analyze", userId });
    const valid = DiagShape.safeParse(raw);
    if (!valid.success) {
      console.error("analyze: LLM shape inválido");
      return NextResponse.json(
        {
          error: "A IA devolveu uma resposta em formato inesperado. Tente novamente em alguns segundos.",
          code: "LLM_INVALID",
        },
        { status: 502 }
      );
    }
    diag = valid.data;
  } catch (e) {
    // Não vazar detalhes ao cliente.
    console.error("analyze: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu analisar agora. Tente novamente em alguns segundos — se persistir, o currículo pode estar muito longo ou em formato estranho.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }

  // Score determinístico — calculado aqui, não na IA.
  const overall = computeOverall(diag.sub_scores);

  // Modo efemero (anonimo): nao persiste, retorna direto.
  if (!userId) {
    return NextResponse.json({
      snapshotId: null,
      perfil: diag.perfil,
      sub_scores: diag.sub_scores,
      gaps: diag.gaps,
      overall,
      efemero: true,
    });
  }

  // Persistência: profile vigente sobrescrito; snapshot imutável.
  // Tudo escopado por userId vindo da sessão (sem IDOR).
  try {
    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        nome: diag.perfil.nome || null,
        cargoAtual: diag.perfil.cargo_atual || null,
        senioridade: diag.perfil.senioridade || null,
        targetRole: role,
        skills: diag.perfil.skills || [],
        rawCv: cv,
        perfilJson: diag.perfil,
      },
      update: {
        nome: diag.perfil.nome || null,
        cargoAtual: diag.perfil.cargo_atual || null,
        senioridade: diag.perfil.senioridade || null,
        targetRole: role,
        skills: diag.perfil.skills || [],
        rawCv: cv,
        perfilJson: diag.perfil,
      },
    });

    const snapshot = await prisma.scoreSnapshot.create({
      data: {
        userId,
        role,
        overall,
        subScores: diag.sub_scores,
        perfilJson: diag.perfil,
        gaps: {
          create: (diag.gaps || []).map((g) => ({
            habilidade: g.habilidade,
            frequencia: g.frequencia || null,
            porque: g.porque || null,
            microacao: g.microacao || null,
            impactoDimensao: g.impacto?.dimensao || null,
            impactoPontos: g.impacto?.pontos ?? null,
          })),
        },
      },
      include: { gaps: true },
    });

    // Rastro LGPD: registra fonte + consentimento (payloadHash prova consent
    // sem reter o bruto se o usuario revogar/apagar).
    const payloadHash = createHash("sha256").update(cv).digest("hex");
    const cvLabel = `Curriculo colado (${(cv.length / 1024).toFixed(1)} KB)`;
    await prisma.$transaction([
      prisma.dataSource.create({
        data: {
          userId,
          kind: "CV_PASTE",
          label: cvLabel,
          sizeBytes: Buffer.byteLength(cv, "utf8"),
        },
      }),
      prisma.consent.create({
        data: { userId, source: "CV_PASTE", payloadHash },
      }),
    ]);

    return NextResponse.json({
      snapshotId: snapshot.id,
      perfil: diag.perfil,
      sub_scores: diag.sub_scores,
      gaps: diag.gaps,
      overall,
    });
  } catch (e) {
    console.error("analyze: persistencia falhou", e?.message);
    return NextResponse.json(
      {
        error: "Tudo certo com a análise, mas não consegui salvar agora. Atualize a página e tente de novo.",
        code: "PERSIST_FAILED",
      },
      { status: 500 }
    );
  }
}
