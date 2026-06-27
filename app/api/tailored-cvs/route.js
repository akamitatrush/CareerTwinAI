import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista os ultimos 20 CVs adaptados do user (mais recente primeiro).
// IDOR-safe: where escopa por userId da sessao. afterText/beforeText/bullets
// ficam de fora do payload pra economizar bytes — UI mostra so titulo+empresa+data
// na lista; detalhe completo via GET /api/tailored-cvs/[id].
async function getHandler(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = await guardLLM(req, {
    name: "tailored-cvs.list",
    userId: session.user.id,
    perMinuteAnon: 0,
    perMinuteUser: 30,
  });
  if (!limit.ok) return tooMany(limit);

  try {
    const items = await prisma.tailoredCv.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        applicationId: true,
        vagaTitulo: true,
        vagaEmpresa: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("tailored-cvs list: falhou", err?.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export const GET = withApiGuard(getHandler);
