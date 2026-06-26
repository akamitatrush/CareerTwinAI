import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EvidenceCreateBody } from "@/lib/validators";
import { grantAchievement } from "@/lib/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — lista evidencias do usuario logado, mais recentes primeiro.
// IDOR-safe: escopo de userId DENTRO do where (nao confia em nada do cliente).
// take=200 protege contra resposta gigante; o user tipico tem 5-20 evidencias.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para ver suas evidências.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const items = await prisma.evidence.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

// POST — cria evidencia nova.
// Validacao estrita por Zod (rejeita campos extras tipo userId — cliente nao
// define dono). userId SEMPRE da sessao, nunca do body. Limite por user evita
// abuso de armazenamento (50 evidencias e mais que suficiente; perfil real fica
// na faixa de 5-20).
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para adicionar evidências.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
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

  const parsed = EvidenceCreateBody.safeParse(body);
  if (!parsed.success) {
    // Mensagens guiadas pros erros mais comuns do form, sem vazar internals.
    if (body?.url && typeof body.url === "string" && body.url.length > 0) {
      return NextResponse.json(
        { error: "URL inválida. Cole o link completo (com https://).", code: "INVALID_URL" },
        { status: 400 }
      );
    }
    if (!body?.title || (typeof body.title === "string" && body.title.trim().length < 3)) {
      return NextResponse.json(
        { error: "Título precisa ter pelo menos 3 caracteres.", code: "TITLE_TOO_SHORT" },
        { status: 400 }
      );
    }
    if (!body?.description || (typeof body.description === "string" && body.description.trim().length < 20)) {
      return NextResponse.json(
        { error: "Descrição precisa ter pelo menos 20 caracteres — conte o contexto, sua ação e o resultado.", code: "DESC_TOO_SHORT" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Algum campo está em formato inválido. Confira os dados.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Limite de evidencias por user. Sem isso, abre porta pra abuso de storage.
  const count = await prisma.evidence.count({ where: { userId: session.user.id } });
  if (count >= 50) {
    return NextResponse.json(
      { error: "Você atingiu o limite de 50 evidências. Apague alguma antes de adicionar nova.", code: "LIMIT_REACHED" },
      { status: 400 }
    );
  }

  const item = await prisma.evidence.create({
    data: {
      userId: session.user.id,
      kind: data.kind,
      title: data.title.trim(),
      description: data.description.trim(),
      skills: (data.skills || []).map((s) => s.trim()).filter(Boolean),
      metricLabel: data.metricLabel?.trim() || null,
      metricValue: data.metricValue?.trim() || null,
      url: data.url?.trim() || null,
      whenLabel: data.whenLabel?.trim() || null,
    },
  });

  // Achievement: FIRST_EVIDENCE concedido na primeira evidence documentada.
  // count ja existe acima (linha 82) mas estava pre-create; usamos count+1
  // (apos o create) pra decidir. Idempotente via unique constraint.
  try {
    if (count === 0) {
      await grantAchievement(session.user.id, "FIRST_EVIDENCE", {
        evidenceId: item.id,
      });
    }
  } catch (e) {
    console.error("evidence: achievement falhou", e?.message);
  }

  return NextResponse.json({ item });
}
