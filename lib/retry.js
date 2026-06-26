// lib/retry.js
// Retry com exponential backoff + jitter. Especificamente pra HTTP 429/5xx e
// erros transitorios de rede (timeout, abort, ECONNRESET, ETIMEDOUT).
//
// Por que jitter: thundering herd. Sem jitter, todos os retries de um spike
// de 429 batem no provider no MESMO instante e o sobrecarregam de novo.
//
// Por que apenas 429/5xx: 4xx (400, 401, 403, 404, 422) sao erros de cliente
// — retry nao ajuda e desperdica budget de chamada paga (LLM).
//
// Uso: const data = await withRetry(() => fetch(url).then(r => r.json()));
//
// Convencao do `fn`: se retornar Response, o caller verifica res.ok ele mesmo
// ANTES de retornar do callback. Pra acionar retry em 429/5xx via Response,
// throw um Error com a mensagem incluindo "429" ou "503" (ja e o padrao das
// integracoes existentes — vide lib/llm.js, lib/embeddings.js).

const RETRYABLE_PATTERN = /\b(408|425|429|5\d\d)\b|timeout|abort|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i;

export function isRetryableError(err) {
  if (!err) return false;
  // Aborto explicito do caller (ex: nao bate retry contra cancelamento de user).
  if (err.name === "AbortError" && err._userAborted === true) return false;
  const msg = String(err?.message || err);
  return RETRYABLE_PATTERN.test(msg);
}

/**
 * Executa `fn` com retry em erros transitorios.
 *
 * @param {() => Promise<T>} fn - operacao a tentar
 * @param {Object} [opts]
 * @param {number} [opts.maxAttempts=3] - tentativas totais (incluindo a 1a)
 * @param {number} [opts.baseDelayMs=400] - base do backoff (2^n * base)
 * @param {number} [opts.maxDelayMs=8000] - teto pra um delay individual
 * @param {(err: Error, attempt: number) => boolean} [opts.shouldRetry] - override
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 400,
    maxDelayMs = 8000,
    shouldRetry = isRetryableError,
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts) throw e;
      if (!shouldRetry(e, attempt)) throw e;
      const expo = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 200;
      const delay = Math.min(expo + jitter, maxDelayMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
