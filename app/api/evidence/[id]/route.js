import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EvidencePatchBody } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2-step IDOR check: busca por id, depois confere userId. Se nao bate, 404
// (nunca 403) pra nao vazar existencia de ids alheios. Mesmo padrao usado
// em /api/tailored-cvs/[id] e /api/applications/[id].

function invalidId(id) {
  return !id || typeof id !== "string" || id.length > 50;
}

export async function GET(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await ctx.params;
  const id = params?.id;
  if (invalidId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const item = await prisma.evidence.findUnique({ where: { id } });
    if (!item || item.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Omite userId da resposta — dado de dono ja confirmado, cliente nao precisa.
    const { userId: _omit, ...safe } = item;
    return NextResponse.json({ item: safe });
  } catch (err) {
    console.error("evidence get falhou:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function PATCH(req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await ctx.params;
  const id = params?.id;
  if (invalidId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const parsed = EvidencePatchBody.safeParse(body);
  if (!parsed.success) {
    if (body?.url && typeof body.url === "string" && body.url.length > 0) {
      return NextResponse.json(
        { error: "URL inválida. Cole o link completo (com https://).", code: "INVALID_URL" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Nada para atualizar ou campo inválido.", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  // Step 1: confirma posse antes de mexer.
  const existing = await prisma.evidence.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Monta updates so com o que veio. nullish (null|undefined) trata "limpar"
  // (null) vs "manter" (undefined ausente) com semantica distinta.
  const d = parsed.data;
  const updates = {};
  if (d.kind !== undefined) updates.kind = d.kind;
  if (d.title !== undefined) updates.title = d.title.trim();
  if (d.description !== undefined) updates.description = d.description.trim();
  if (d.skills !== undefined) updates.skills = d.skills.map((s) => s.trim()).filter(Boolean);
  if (d.metricLabel !== undefined) updates.metricLabel = d.metricLabel?.trim() || null;
  if (d.metricValue !== undefined) updates.metricValue = d.metricValue?.trim() || null;
  if (d.url !== undefined) updates.url = d.url?.trim() || null;
  if (d.whenLabel !== undefined) updates.whenLabel = d.whenLabel?.trim() || null;

  try {
    const item = await prisma.evidence.update({ where: { id }, data: updates });
    const { userId: _omit, ...safe } = item;
    return NextResponse.json({ item: safe });
  } catch (err) {
    console.error("evidence patch falhou:", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await ctx.params;
  const id = params?.id;
  if (invalidId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // deleteMany com (id + userId) e single-step IDOR-safe: o registro so e
  // apagado se userId bate. count === 0 => nao existe OU nao e seu => 404.
  const deleted = await prisma.evidence.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
