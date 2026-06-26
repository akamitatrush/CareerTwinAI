// GET /api/concursos — busca concursos públicos do agregador pciconcursos.
//
// Query params:
//   ?uf=SP          — filtro por estado (sigla 2 letras, opcional)
//   &nivel=superior — fundamental|medio|superior (opcional)
//   &area=enferm    — texto livre, busca em cargo+órgão (opcional)
//   &limit=20       — limite de resultados (1-100, default 30)
//
// Resposta:
//   200: { items: Concurso[], cached: boolean }
//   429: rate-limit excedido (resposta padronizada)
//
// Auth: aceita anônimo (modo "experimentar" do CareerTwin). Rate-limit
// agressivo pra anon (10/min) protege contra scraping abusivo via nossa API.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { fetchConcursos } from "@/lib/concursos";
import { withApiGuard } from "@/lib/api-handler";
import { cacheGet } from "@/lib/jobs/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Scraping + parse — 10s timeout interno + folga pra cold start.
export const maxDuration = 30;

async function handler(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Rate-limit: anon 10/min, user 30/min. Não usa LLM, mas a tooling do
  // guardLLM bate bem aqui (token bucket + Redis + audit em hit).
  const limit = await guardLLM(req, {
    name: "concursos",
    userId,
    perMinuteAnon: 10,
    perMinuteUser: 30,
  });
  if (!limit.ok) return tooMany(limit);

  const url = new URL(req.url);
  const params = url.searchParams;

  // Sanitiza inputs. fetchConcursos já valida internamente, mas damos um
  // primeiro filtro aqui pra evitar work desnecessário.
  const ufRaw = (params.get("uf") || "").trim().toUpperCase();
  const uf = /^[A-Z]{2}$/.test(ufRaw) ? ufRaw : undefined;

  const nivelRaw = (params.get("nivel") || "").trim().toLowerCase();
  const nivel = ["fundamental", "medio", "superior"].includes(nivelRaw)
    ? nivelRaw
    : undefined;

  const areaRaw = (params.get("area") || "").trim();
  // Limita area pra 120 chars (evita query absurdamente longa).
  const area = areaRaw ? areaRaw.slice(0, 120) : undefined;

  const limitRaw = parseInt(params.get("limit") || "30", 10);
  const limitNum = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, limitRaw))
    : 30;

  // Detecta cache hit ANTES da chamada (espia cache com mesma key calculada
  // em fetchConcursos). Vale só pra response telemetry — não muda decisão.
  const cacheKey = `concursos:${uf || "all"}:${nivel || "all"}:${(area || "all").toLowerCase()}`;
  const cachedBefore = await cacheGet(cacheKey);
  const cached = cachedBefore !== null && cachedBefore !== undefined;

  const items = await fetchConcursos({ uf, nivel, area, limit: limitNum });

  return NextResponse.json({
    items,
    cached,
  });
}

export const GET = withApiGuard(handler);
