import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApplicationCreateBody } from "@/lib/validators";
import { grantAchievement } from "@/lib/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para ver suas candidaturas. Acesse /entrar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const items = await prisma.application.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para criar uma candidatura. Acesse /entrar.", code: "UNAUTHORIZED" },
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
  const parsed = ApplicationCreateBody.safeParse(body);
  if (!parsed.success) {
    const titulo = typeof body?.titulo === "string" ? body.titulo.trim() : "";
    const empresa = typeof body?.empresa === "string" ? body.empresa.trim() : "";
    if (!titulo || !empresa) {
      return NextResponse.json(
        { error: "Título e empresa são obrigatórios para criar uma candidatura.", code: "FIELDS_REQUIRED" },
        { status: 400 }
      );
    }
    if (body?.url && typeof body.url === "string" && body.url.length > 0) {
      return NextResponse.json(
        { error: "A URL da vaga parece inválida. Cole o link completo (com https://).", code: "INVALID_URL" },
        { status: 400 }
      );
    }
    if (body?.status) {
      return NextResponse.json(
        {
          error: "Esse status não existe. Escolha entre: Salva, Aplicada, Triagem, Entrevista, Oferta, Recusada, Desistida.",
          code: "INVALID_STATUS",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Algum campo está em formato inválido. Confira os dados da candidatura.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Dedup oportunista por (userId + titulo + empresa).
  const existing = await prisma.application.findFirst({
    where: {
      userId: session.user.id,
      titulo: data.titulo,
      empresa: data.empresa,
    },
  });
  if (existing) {
    return NextResponse.json({ item: existing, duplicated: true });
  }

  const item = await prisma.application.create({
    data: {
      userId: session.user.id,
      titulo: data.titulo,
      empresa: data.empresa,
      local: data.local || null,
      url: data.url || null,
      salario: data.salario || null,
      source: data.source || null,
      notes: data.notes || null,
      status: data.status,
      events: {
        create: {
          toStatus: data.status,
          note: "Criada",
        },
      },
    },
  });

  // Achievement: FIRST_APPLICATION. Conta total apos o create e concede se
  // for a primeira. Idempotente — segundo cai em alreadyEarned. Falha
  // silenciosa nao derruba o POST.
  try {
    const total = await prisma.application.count({
      where: { userId: session.user.id },
    });
    if (total === 1) {
      await grantAchievement(session.user.id, "FIRST_APPLICATION", {
        applicationId: item.id,
      });
    }
  } catch (e) {
    console.error("applications: achievement falhou", e?.message);
  }

  return NextResponse.json({ item });
}
