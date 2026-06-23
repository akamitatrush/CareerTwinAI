/**
 * Mediana REAL de contratados — calcula a partir de Outcomes persistidos.
 *
 * Por que existe: a UI do dashboard mostra "voce esta a X pontos da mediana
 * de quem foi contratado pro cargo-alvo". Antes era stub fixo (HIRED_MEDIAN=78
 * em median-stub.js — vaporware). Agora ha dataset proprietario via Outcome:
 * cada user reporta status 30/60/90 dias apos primeiro snapshot, capturando
 * scoreAtTime no momento. Quando temos >=50 outcomes HIRED+HIRED_DIFFERENT,
 * a mediana stub vira mediana real.
 *
 * Threshold 50: ponto de balanceamento entre "rapido pra ativar" e "amostra
 * minimamente significativa". Estatisticamente, IC 95% pra mediana exige ~30
 * obs (rule of thumb); subimos pra 50 pra deixar margem contra outliers em
 * dataset jovem. Pode ser ajustado via MIN_OUTCOMES_FOR_REAL — qualquer
 * mudanca invalida cache automaticamente (proxima chamada recalcula).
 *
 * Cache em memoria 1h: evita martelar DB. Outcomes mudam devagar (~50/mes em
 * volume estavel), entao cache de 1h e seguro. Em ambiente serverless (Vercel)
 * cada lambda mantem seu proprio cache — desperdicio leve, mas zero risco de
 * staleness cross-instance. Trade-off aceitavel pra simplicidade.
 *
 * PRIVACIDADE: nenhuma PII exposta. So agrega scoreAtTime (int 0-100).
 * Resultado e cacheavel publicamente (response cache headers no GET /api/metrics/median).
 */

import { prisma } from "@/lib/db";

const STUB_VALUE = 78;
export const MIN_OUTCOMES_FOR_REAL = 50;
const CACHE_TTL_MS = 60 * 60 * 1000;

// Backward-compat com lib/metrics/median-stub.js. Componentes legados que
// importam HIRED_MEDIAN continuam funcionando — mas devem migrar pra
// getRealMedian() pra obter o dado real quando disponivel.
export const HIRED_MEDIAN = STUB_VALUE;

let cache = { value: null, computedAt: 0 };

/**
 * Reseta o cache. Usado em testes pra isolar runs. Nao usar em prod.
 */
export function _resetCache() {
  cache = { value: null, computedAt: 0 };
}

/**
 * Calcula mediana real do scoreAtTime de outcomes HIRED + HIRED_DIFFERENT.
 *
 * @returns {Promise<{
 *   value: number,
 *   isStub: boolean,
 *   sampleSize: number,
 *   thresholdToReal: number
 * }>}
 *
 * Quando sampleSize < MIN_OUTCOMES_FOR_REAL: retorna stub com isStub=true.
 * Quando >= threshold: retorna mediana calculada com isStub=false.
 */
export async function getRealMedian() {
  // Cache hit dentro de TTL — devolve sem tocar DB.
  if (cache.value && Date.now() - cache.computedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  let hireds;
  try {
    hireds = await prisma.outcome.findMany({
      where: {
        kind: { in: ["HIRED", "HIRED_DIFFERENT"] },
        scoreAtTime: { not: null },
      },
      select: { scoreAtTime: true },
    });
  } catch (e) {
    // DB falhou: NAO derruba o dashboard. Devolve stub com flag indicativa.
    // Log pra observabilidade. Sem cache (proxima request tenta de novo).
    console.error("getRealMedian: query falhou", e?.message);
    return {
      value: STUB_VALUE,
      isStub: true,
      sampleSize: 0,
      thresholdToReal: MIN_OUTCOMES_FOR_REAL,
    };
  }

  if (hireds.length < MIN_OUTCOMES_FOR_REAL) {
    const result = {
      value: STUB_VALUE,
      isStub: true,
      sampleSize: hireds.length,
      thresholdToReal: MIN_OUTCOMES_FOR_REAL,
    };
    cache = { value: result, computedAt: Date.now() };
    return result;
  }

  // Mediana real. Filtra null/NaN defensivamente (a query ja faz, mas defesa
  // em profundidade evita NaN injetando no sort).
  const sorted = hireds
    .map((h) => h.scoreAtTime)
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);

  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const median =
    n % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];

  const result = {
    value: median,
    isStub: false,
    sampleSize: n,
    thresholdToReal: MIN_OUTCOMES_FOR_REAL,
  };
  cache = { value: result, computedAt: Date.now() };
  return result;
}
