// lib/api-handler.js
// Helper pra evitar que rotas API retornem HTML quando algo throw inesperado.
//
// Sintoma sem isso: frontend pega "Unexpected token '<', '<!DOCTYPE ...'"
// quando o servidor 500 — Next.js retorna HTML error page e o client tenta
// parsear como JSON.
//
// Uso:
//   export const POST = withApiGuard(async (req) => { ... });
//
// Captura erros comuns:
//  - P2021: tabela nao existe (migration nao aplicada)
//  - P2002: unique constraint (idempotencia)
//  - P1001/P1008/P1017: DB nao acessivel / timeout
//  - Module errors: import quebrado, dep faltando

import { NextResponse } from "next/server";

function errorPayload(e) {
  const code = e?.code;
  // Prisma errors documentados em https://www.prisma.io/docs/reference/api-reference/error-reference
  if (code === "P2021") {
    return {
      status: 503,
      body: {
        error:
          "Banco de dados sem alguma tabela necessária — pode ser migration pendente. Tente em alguns minutos; se persistir, contate suporte.",
        code: "DB_TABLE_MISSING",
      },
    };
  }
  if (code === "P2022" || code === "P2025") {
    return {
      status: 503,
      body: {
        error: "Schema do banco está desincronizado com o código. Migration pendente.",
        code: "DB_SCHEMA_DRIFT",
      },
    };
  }
  if (code === "P1001" || code === "P1008" || code === "P1017") {
    return {
      status: 503,
      body: {
        error: "Não consegui conectar no banco agora. Tente em alguns segundos.",
        code: "DB_UNAVAILABLE",
      },
    };
  }
  // Outros erros — genérico mas sempre JSON.
  return {
    status: 500,
    body: {
      error:
        "Encontramos um problema no servidor. Tente de novo — se persistir, recarregue a página.",
      code: "SERVER_ERROR",
    },
  };
}

/**
 * Envolve um handler API com try/catch global pra GARANTIR JSON response
 * mesmo em erros inesperados (Prisma drift, import error, etc).
 */
export function withApiGuard(handler) {
  return async function guarded(req, ctx) {
    try {
      return await handler(req, ctx);
    } catch (e) {
      console.error(`[api-guard] ${req.method} ${req.url}:`, e?.message, e?.code);
      const { status, body } = errorPayload(e);
      return NextResponse.json(body, { status });
    }
  };
}
