import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2-step IDOR check: busca por id, depois confere userId. Se nao bate, retorna
// 404 (nunca 403) pra nao vazar existencia de ids alheios.

export async function GET(req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const id = params?.id;
  if (!id || typeof id !== "string" || id.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const item = await prisma.tailoredCv.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        applicationId: true,
        vagaTitulo: true,
        vagaEmpresa: true,
        beforeText: true,
        afterText: true,
        bullets: true,
        createdAt: true,
      },
    });
    if (!item || item.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Remove userId do payload de saida — cliente nao precisa, e e dado de
    // dono que ja foi confirmado pela checagem acima.
    const { userId: _omit, ...safe } = item;
    return NextResponse.json({ item: safe });
  } catch (err) {
    console.error("tailored-cvs get: falhou", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const id = params?.id;
  if (!id || typeof id !== "string" || id.length > 50) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const existing = await prisma.tailoredCv.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.tailoredCv.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tailored-cvs delete: falhou", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
