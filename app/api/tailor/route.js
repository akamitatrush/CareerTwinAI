import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { promptTailor } from "@/lib/prompts";
import { TailorBody } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { enforceUsage, trackTokenUsage, checkDailyBudget } from "@/lib/billing/enforce";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = await guardLLM(req, { name: "tailor", userId, perMinuteAnon: 3, perMinuteUser: 10 });
  if (!limit.ok) return tooMany(limit);

  // Enforcement do plano apenas pra logados (anonimos sao rate-limited acima).
  // enforceUsage AGORA INCREMENTA ATOMICAMENTE — nao chamar trackUsage depois.
  let userPlan = null;
  if (userId) {
    const lim = await enforceUsage(userId, "tailor");
    if (!lim.ok) {
      return NextResponse.json(
        {
          error: "Voce atingiu o limite do plano Free (1 CV adaptado/mes). Faca upgrade pra Pro.",
          code: "LIMIT_REACHED",
          feature: "tailor",
          plan: lim.plan,
          limit: lim.limit,
          upgradeUrl: "/precos",
        },
        { status: 402 }
      );
    }
    userPlan = lim.plan;
    // Pre-check de budget diario (cost amplification defense — Wave 11).
    const budget = await checkDailyBudget(userId, userPlan);
    if (!budget.ok) {
      await audit({
        userId,
        action: "SECURITY_BUDGET_EXCEEDED",
        target: `User:${userId}`,
        req,
        meta: { feature: "tailor", used: budget.used, cap: budget.cap },
      });
      return NextResponse.json(
        {
          error: "Voce atingiu o limite diario de uso de IA. Volte amanha ou faca upgrade.",
          code: "BUDGET_EXCEEDED",
          used: budget.used,
          cap: budget.cap,
          upgradeUrl: "/precos",
        },
        { status: 402 }
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Não consegui entender o que foi enviado. Tente de novo.", code: "BAD_JSON" },
      { status: 400 }
    );
  }
  const parsed = TailorBody.safeParse(body);
  if (!parsed.success) {
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
    if (!body?.vaga || typeof body.vaga !== "object") {
      return NextResponse.json(
        { error: "Selecione uma vaga para adaptar o currículo.", code: "JOB_REQUIRED" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Algum dado está faltando ou em formato inválido. Confira cargo, currículo e vaga.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const { role, cv, vaga, applicationId, vagaTitulo, vagaEmpresa } = parsed.data;

  try {
    const { result: data, usage: llmUsage } = await completeJSONWithUsage(
      promptTailor(role, cv, vaga),
      { route: "tailor", userId }
    );

    // Tokens cobrados pelo provider — track imediatamente, antes do persist.
    // Garantia: mesmo se persist abaixo falhar, o uso conta pro budget diario.
    if (userId && llmUsage) {
      await trackTokenUsage(userId, "tailor", llmUsage);
      try {
        const budgetAfter = await checkDailyBudget(userId, userPlan);
        if (!budgetAfter.ok) {
          await audit({
            userId,
            action: "SECURITY_BUDGET_EXCEEDED",
            target: `User:${userId}`,
            req,
            meta: {
              feature: "tailor",
              used: budgetAfter.used,
              cap: budgetAfter.cap,
              phase: "post-llm",
            },
          });
        }
      } catch (e) {
        console.error("tailor: post-budget check falhou", e?.message);
      }
    }

    // Persiste no historico se o user estiver logado. User anonimo NAO gera
    // TailoredCv (sem userId nao tem dono — fail closed; resposta volta igual).
    // Falha de persistencia nao derruba a resposta: o LLM ja gastou tokens e
    // o texto adaptado e o que o usuario veio buscar.
    let tailoredCvId = null;
    if (userId) {
      try {
        // Se vaga tem titulo/empresa, usa; senao cai no que veio explicito ou no role.
        const vagaTit =
          vagaTitulo ||
          (typeof vaga?.titulo === "string" && vaga.titulo.slice(0, 200)) ||
          role ||
          "—";
        const vagaEmp =
          vagaEmpresa ||
          (typeof vaga?.empresa === "string" && vaga.empresa.slice(0, 200)) ||
          null;

        // Reconstroi um texto "after" auditavel a partir do shape do LLM
        // (resumo_adaptado + bullets). Salva tambem os bullets crus em JSON
        // pra que a UI futura possa renderizar/destacar tipo=nova vs reorganizacao.
        const bulletsArr = Array.isArray(data?.bullets) ? data.bullets : null;
        const afterText = [
          typeof data?.resumo_adaptado === "string" ? data.resumo_adaptado.trim() : "",
          bulletsArr
            ? bulletsArr
                .map((b) => (typeof b?.texto === "string" ? `• ${b.texto}` : ""))
                .filter(Boolean)
                .join("\n")
            : "",
          typeof data?.observacao === "string" ? `\n${data.observacao}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 40_000);

        // Se applicationId foi enviado, valida que a Application pertence ao
        // usuario (sem isso, qualquer um anexaria seu CV a vaga de outro user).
        let safeAppId = null;
        if (applicationId) {
          const app = await prisma.application.findUnique({
            where: { id: applicationId },
            select: { userId: true },
          });
          if (app && app.userId === userId) safeAppId = applicationId;
        }

        const created = await prisma.tailoredCv.create({
          data: {
            userId,
            applicationId: safeAppId,
            vagaTitulo: String(vagaTit).slice(0, 200),
            vagaEmpresa: vagaEmp ? String(vagaEmp).slice(0, 200) : null,
            beforeText: cv,
            afterText: afterText || JSON.stringify(data).slice(0, 40_000),
            bullets: bulletsArr || null,
          },
          select: { id: true },
        });
        tailoredCvId = created.id;
      } catch (e) {
        // Log sem PII (so .message). Nao derruba resposta.
        console.error("tailor: persist falhou", e?.message);
      }
      // Uso ja foi contabilizado atomicamente em enforceUsage no inicio do POST
      // (fix TOCTOU). NAO chamar trackUsage aqui senao duplica.
    }

    return NextResponse.json({ ...data, tailoredCvId });
  } catch (e) {
    console.error("tailor: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu adaptar o currículo agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }
}
