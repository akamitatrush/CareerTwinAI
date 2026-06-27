import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportUserData } from "@/lib/data-export";
import { audit } from "@/lib/audit";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para exportar seus dados. Acesse /entrar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Export agrega dados de varias tabelas — caro e raro. Limite agressivo
  // (2/min) defende contra DoS via loop. Anon nao chega aqui (401 acima).
  const limit = await guardLLM(req, {
    name: "me.export",
    userId: session.user.id,
    perMinuteAnon: 0,
    perMinuteUser: 2,
  });
  if (!limit.ok) return tooMany(limit);

  try {
    const data = await exportUserData(session.user.id);
    const body = JSON.stringify(data, null, 2);
    // Audit LGPD: download de dados pessoais e evento auditavel (acesso). Meta
    // captura tamanho aproximado pra correlacionar com BillingEvent/troubleshoot.
    await audit({
      userId: session.user.id,
      action: "DATA_EXPORTED",
      target: `User:${session.user.id}`,
      req,
      meta: { bytes: Buffer.byteLength(body, "utf8") },
    });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="careertwin-export-${session.user.id}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("export: falhou", e?.message);
    return NextResponse.json(
      {
        error: "Não consegui montar a exportação dos seus dados agora. Tente novamente em alguns segundos.",
        code: "EXPORT_FAILED",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiGuard(getHandler);
