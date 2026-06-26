import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetryableError } from "@/lib/retry";

describe("isRetryableError — classifica erros transitorios", () => {
  it("retorna true pra 429/503/500 na mensagem", () => {
    expect(isRetryableError(new Error("API 429: rate limit"))).toBe(true);
    expect(isRetryableError(new Error("Voyage 503: unavailable"))).toBe(true);
    expect(isRetryableError(new Error("upstream 500"))).toBe(true);
  });

  it("retorna true pra timeout/abort/ECONNRESET", () => {
    expect(isRetryableError(new Error("request timeout"))).toBe(true);
    expect(isRetryableError(new Error("aborted"))).toBe(true);
    expect(isRetryableError(new Error("read ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("connect ETIMEDOUT"))).toBe(true);
  });

  it("retorna false pra 4xx de cliente (400, 401, 403, 404, 422)", () => {
    expect(isRetryableError(new Error("API 400: bad request"))).toBe(false);
    expect(isRetryableError(new Error("API 401: unauthorized"))).toBe(false);
    expect(isRetryableError(new Error("API 403: forbidden"))).toBe(false);
    expect(isRetryableError(new Error("API 404: not found"))).toBe(false);
    expect(isRetryableError(new Error("API 422: invalid"))).toBe(false);
  });

  it("retorna false pra erro generico sem padrao retriable", () => {
    expect(isRetryableError(new Error("parse error"))).toBe(false);
    expect(isRetryableError(new Error("undefined is not a function"))).toBe(false);
  });

  it("retorna false pra null/undefined", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe("withRetry — execucao com backoff", () => {
  it("retorna o resultado se a 1a tentativa passa (sem retry)", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const r = await withRetry(fn);
    expect(r).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retenta ate maxAttempts em erro retriable", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("API 429");
      return "ok";
    });
    const r = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(r).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("propaga erro apos esgotar maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("API 503"));
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 })).rejects.toThrow(/503/);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falha imediato em erro nao-retriable (sem tentar de novo)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("API 401: unauthorized"));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(/401/);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("respeita shouldRetry custom", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("custom"));
    const shouldRetry = vi.fn(() => false);
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, shouldRetry })).rejects.toThrow();
    expect(fn).toHaveBeenCalledOnce();
    expect(shouldRetry).toHaveBeenCalled();
  });

  it("aplica backoff entre tentativas (delay > 0)", async () => {
    const ts = [];
    let calls = 0;
    const fn = vi.fn(async () => {
      ts.push(Date.now());
      calls++;
      if (calls < 3) throw new Error("API 429");
      return "ok";
    });
    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 50, maxDelayMs: 1000 });
    expect(ts.length).toBe(3);
    // Cada gap deve ser pelo menos o baseDelayMs (sem jitter negativo).
    // Nao testamos crescimento estrito porque o jitter (0-200ms) pode mascarar
    // o crescimento em magnitudes baixas — propriedade testada e o piso.
    expect(ts[1] - ts[0]).toBeGreaterThanOrEqual(45); // ~50ms - tolerancia
    expect(ts[2] - ts[1]).toBeGreaterThanOrEqual(95); // base*2 = ~100ms
  });

  it("respeita maxDelayMs como teto", async () => {
    const ts = [];
    let calls = 0;
    const fn = vi.fn(async () => {
      ts.push(Date.now());
      calls++;
      if (calls < 4) throw new Error("API 503");
      return "ok";
    });
    // base muito alto, mas teto baixo — todos os gaps devem ficar perto do teto.
    await withRetry(fn, { maxAttempts: 4, baseDelayMs: 10_000, maxDelayMs: 50 });
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i] - ts[i - 1]).toBeLessThan(300); // tolerancia generosa
    }
  });
});
