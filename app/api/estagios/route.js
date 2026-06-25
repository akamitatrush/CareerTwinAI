// GET /api/estagios — busca estagios via providers Adzuna+Jooble filtrados por
// tipo "internship". Persona alvo: 18-25, estudante universitario.
//
// Query params:
//   ?uf=SP            — filtro por estado (sigla 2 letras, opcional)
//   &area=ti          — area normalizada (ti/marketing/financas/etc., opcional)
//   &query=frontend   — texto livre, busca no titulo/descricao (opcional)
//   &limit=30         — limite de resultados (1-100, default 30)
//
// Resposta:
//   200: { items: Estagio[], cached: boolean, total: number }
//   401: nao autenticado
//   429: rate-limit excedido
//
// Auth obrigatorio (defense-in-depth). Middleware ja bloqueia, mas re-check
// no handler protege contra bypass por config drift.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { fetchEstagios } from "@/lib/estagios";
import { withApiGuard } from "@/lib/api-handler";
import { cacheGet } from "@/lib/jobs/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// fetch externo + parse + filtros locais; 30s da folga em cold start.
export const maxDuration = 30;

async function handler(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Defense-in-depth: rota esta em PROTECTED_PREFIXES (config drift seria
  // catastrofico — exige session aqui mesmo se middleware falhar).
  if (!userId) {
    return NextResponse.json(
      { error: "Faca login pra ver estagios.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Rate-limit: anon 20/min, user 60/min. Mais permissivo que /api/concursos
  // (10/30) porque a UI de estagios usa GET com filtros — usuario filtrando
  // varias UFs em sequencia nao deveria atingir limite trivialmente.
  const limit = await guardLLM(req, {
    name: "estagios",
    userId,
    perMinuteAnon: 20,
    perMinuteUser: 60,
  });
  if (!limit.ok) return tooMany(limit);

  const url = new URL(req.url);
  const params = url.searchParams;

  // Sanitiza inputs. fetchEstagios re-valida defensivamente, mas filtramos
  // aqui pra evitar work desnecessario (e tamanhos absurdos no cache key).
  const ufRaw = (params.get("uf") || "").trim().toUpperCase();
  const uf = /^[A-Z]{2}$/.test(ufRaw) ? ufRaw : "";

  const areaRaw = (params.get("area") || "").trim().toLowerCase();
  // Whitelist de areas conhecidas — outros valores caem em "" (sem filtro).
  const VALID_AREAS = ["ti", "marketing", "vendas", "financas", "rh", "juridico", "engenharia", "saude", "design"];
  const area = VALID_AREAS.includes(areaRaw) ? areaRaw : "";

  const queryRaw = (params.get("query") || "").trim();
  // Limita query pra 120 chars (consistente com /api/concursos).
  const query = queryRaw ? queryRaw.slice(0, 120) : "";

  const limitRaw = parseInt(params.get("limit") || "30", 10);
  const limitNum = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, limitRaw))
    : 30;

  // Detecta cache hit ANTES da chamada (espia cache com mesma key de fetchEstagios).
  // Vale pra telemetry — nao muda decisao. Key precisa bater com a do provider.
  const cacheKey = `estagios:v1:${query}:${uf}:${area}:${limitNum}`;
  const cachedBefore = await cacheGet(cacheKey);
  const cached = cachedBefore !== null && cachedBefore !== undefined;

  const items = await fetchEstagios({ query, uf, area, limit: limitNum });

  return NextResponse.json({
    items,
    cached,
    total: items.length,
  });
}

export const GET = withApiGuard(handler);
