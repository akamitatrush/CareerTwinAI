import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApplicationPatchBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mapa status → campo de timestamp que marca quando entrou nesse estagio.
const STATUS_DATE_FIELD = {
  APPLIED: "appliedAt",
  REJECTED: "rejectedAt",
  OFFER: "offerAt",
};

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para alterar uma candidatura. Acesse /entrar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const { id } = params;
  if (!id || id.length > 50) {
    return NextResponse.json(
      { error: "Identificador da candidatura inválido.", code: "INVALID_ID" },
      { status: 400 }
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
  const parsed = ApplicationPatchBody.safeParse(body);
  if (!parsed.success) {
    if (body?.status !== undefined) {
      return NextResponse.json(
        {
          error: "Esse status não existe. Escolha entre: Salva, Aplicada, Triagem, Entrevista, Oferta, Recusada, Desistida.",
          code: "INVALID_STATUS",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Nada para atualizar — envie um novo status ou anotação.", code: "EMPTY_UPDATE" },
      { status: 400 }
    );
  }

  // Verifica posse antes de qualquer alteracao (sem IDOR).
  const current = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!current) {
    return NextResponse.json(
      { error: "Não encontrei essa candidatura no seu funil.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const updates = {};
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.status && parsed.data.status !== current.status) {
    updates.status = parsed.data.status;
    const dateField = STATUS_DATE_FIELD[parsed.data.status];
    if (dateField && !current[dateField]) updates[dateField] = new Date();
  }

  const events =
    parsed.data.status && parsed.data.status !== current.status
      ? {
          create: {
            fromStatus: current.status,
            toStatus: parsed.data.status,
            note: parsed.data.notes || null,
          },
        }
      : undefined;

  const item = await prisma.application.update({
    where: { id },
    data: { ...updates, ...(events ? { events } : {}) },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para apagar uma candidatura. Acesse /entrar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const { id } = params;
  const deleted = await prisma.application.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Não encontrei essa candidatura no seu funil.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
