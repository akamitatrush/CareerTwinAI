import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportUserData } from "@/lib/data-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para exportar seus dados. Acesse /entrar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const data = await exportUserData(session.user.id);
    const body = JSON.stringify(data, null, 2);
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
