// Unit tests pra lib/llm-cache.js — foca em:
//  - cacheSet + cacheGet retornam mesmo valor (round-trip)
//  - Mem fallback funciona sem Redis (UPSTASH_* nao setado)
//  - TTL expira (simulado via mock de Date.now)
//  - Models diferentes geram keys diferentes (sem colisao)
//  - System/user diferentes geram keys diferentes
//  - Cache get retorna null em miss
//
// NAO toca Redis real (envs UPSTASH_* nao setadas no test env).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  // Limpa envs Redis pra forcar fallback em-memoria.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

describe("llm-cache: round-trip mem fallback", () => {
  it("cacheSet + cacheGet retornam mesmo objeto", async () => {
    const { cacheGet, cacheSet, cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();
    const params = { model: "claude-sonnet-4-6", system: "sys", user: "user input" };
    const value = { hello: "world", n: 42 };
    await cacheSet(params, value);
    const got = await cacheGet(params);
    expect(got).toEqual(value);
  });

  it("cacheGet retorna null em miss (chave nao existe)", async () => {
    const { cacheGet, cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();
    const got = await cacheGet({ model: "x", system: "y", user: "z" });
    expect(got).toBeNull();
  });

  it("aceita system undefined (rotas que so passam user)", async () => {
    const { cacheGet, cacheSet, cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();
    const params = { model: "claude-haiku-4-5-20251001", user: "so user" };
    const value = { ok: true };
    await cacheSet(params, value);
    expect(await cacheGet(params)).toEqual(value);
  });
});

describe("llm-cache: TTL expira", () => {
  it("retorna valor antes do TTL e null depois", async () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-01-01T00:00:00Z").getTime();
    vi.setSystemTime(t0);

    const { cacheGet, cacheSet, cacheClear, _internal } = await import("@/lib/llm-cache.js");
    cacheClear();
    const params = { model: "claude-sonnet-4-6", system: "s", user: "u" };
    await cacheSet(params, { v: 1 });

    // Antes do TTL: hit.
    expect(await cacheGet(params)).toEqual({ v: 1 });

    // Avanca alem do TTL (1h + 1ms).
    vi.setSystemTime(t0 + _internal.TTL_MS + 1);
    expect(await cacheGet(params)).toBeNull();
  });
});

describe("llm-cache: keys nao colidem", () => {
  it("models diferentes -> entries separados", async () => {
    const { cacheGet, cacheSet, cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();
    await cacheSet({ model: "sonnet", system: "s", user: "u" }, { a: 1 });
    await cacheSet({ model: "haiku", system: "s", user: "u" }, { a: 2 });
    expect(await cacheGet({ model: "sonnet", system: "s", user: "u" })).toEqual({ a: 1 });
    expect(await cacheGet({ model: "haiku", system: "s", user: "u" })).toEqual({ a: 2 });
  });

  it("user diferente -> entries separados", async () => {
    const { cacheGet, cacheSet, cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();
    await cacheSet({ model: "m", system: "s", user: "A" }, { x: "a" });
    await cacheSet({ model: "m", system: "s", user: "B" }, { x: "b" });
    expect(await cacheGet({ model: "m", system: "s", user: "A" })).toEqual({ x: "a" });
    expect(await cacheGet({ model: "m", system: "s", user: "B" })).toEqual({ x: "b" });
  });

  it("system diferente -> entries separados (mesmo user)", async () => {
    const { cacheGet, cacheSet, cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();
    await cacheSet({ model: "m", system: "X", user: "U" }, { p: 1 });
    await cacheSet({ model: "m", system: "Y", user: "U" }, { p: 2 });
    expect(await cacheGet({ model: "m", system: "X", user: "U" })).toEqual({ p: 1 });
    expect(await cacheGet({ model: "m", system: "Y", user: "U" })).toEqual({ p: 2 });
  });

  it("makeKey produz string deterministica com prefixo llm:", async () => {
    const { _internal } = await import("@/lib/llm-cache.js");
    const k1 = _internal.makeKey({ model: "m", system: "s", user: "u" });
    const k2 = _internal.makeKey({ model: "m", system: "s", user: "u" });
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^llm:[0-9a-f]{32}$/);
  });
});
