import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { guardLLM, checkLimit, tooMany, _resetMemBuckets } from "@/lib/rate-limit";

// Helper pra montar Request-like com headers Web Standard (Next 13+).
function makeReq(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name.toLowerCase()] || null,
    },
  };
}

describe("rate-limit (fallback in-memory)", () => {
  beforeEach(() => {
    // Garante que nao ha Upstash setado — testes rodam contra Map em-memoria.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetMemBuckets();
  });

  it("guardLLM passa primeiras N reqs e barra a N+1", async () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4" });
    const opts = { name: "test", userId: null, perMinuteAnon: 3, perMinuteUser: 30 };

    const r1 = await guardLLM(req, opts);
    const r2 = await guardLLM(req, opts);
    const r3 = await guardLLM(req, opts);
    const r4 = await guardLLM(req, opts);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
    expect(r4.ok).toBe(false); // estouro
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });

  it("user logado tem bucket separado de IP", async () => {
    const req1 = makeReq({ "x-forwarded-for": "1.2.3.4" });
    const req2 = makeReq({ "x-forwarded-for": "1.2.3.4" });
    // 3 reqs como anon ate estourar
    const anonOpts = { name: "test", userId: null, perMinuteAnon: 3, perMinuteUser: 30 };
    await guardLLM(req1, anonOpts);
    await guardLLM(req1, anonOpts);
    await guardLLM(req1, anonOpts);
    const anonBlocked = await guardLLM(req1, anonOpts);
    expect(anonBlocked.ok).toBe(false);

    // Mesma "request" (mesmo IP), mas agora logado: bucket diferente.
    const userOpts = { name: "test", userId: "u-alice", perMinuteAnon: 3, perMinuteUser: 5 };
    const r = await guardLLM(req2, userOpts);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4); // 5 - 1
  });

  it("isolamento por name (rotas diferentes nao compartilham bucket)", async () => {
    const req = makeReq({ "x-forwarded-for": "5.6.7.8" });
    const optsA = { name: "analyze", userId: null, perMinuteAnon: 2 };
    const optsB = { name: "tailor", userId: null, perMinuteAnon: 2 };

    await guardLLM(req, optsA);
    await guardLLM(req, optsA);
    const aBlocked = await guardLLM(req, optsA);
    expect(aBlocked.ok).toBe(false);

    // Rota diferente, mesmo IP: bucket isolado.
    const b1 = await guardLLM(req, optsB);
    expect(b1.ok).toBe(true);
  });

  it("isolamento por userId", async () => {
    const req = makeReq({ "x-forwarded-for": "9.9.9.9" });
    const optsA = { name: "chat", userId: "user-a", perMinuteUser: 2 };
    const optsB = { name: "chat", userId: "user-b", perMinuteUser: 2 };

    await guardLLM(req, optsA);
    await guardLLM(req, optsA);
    const aBlocked = await guardLLM(req, optsA);
    expect(aBlocked.ok).toBe(false);

    // user-b com mesmo IP — bucket separado.
    const b = await guardLLM(req, optsB);
    expect(b.ok).toBe(true);
  });

  it("tooMany monta resposta 429 com Retry-After", () => {
    const res = tooMany({ retryAfter: 30 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("checkLimit (key explicita) funciona standalone", async () => {
    const r1 = await checkLimit({ name: "manual", userId: "u1", perMinute: 2 });
    const r2 = await checkLimit({ name: "manual", userId: "u1", perMinute: 2 });
    const r3 = await checkLimit({ name: "manual", userId: "u1", perMinute: 2 });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(false);
  });

  it("anon sem header X-Forwarded-For cai em 'anon'", async () => {
    const req = makeReq({}); // sem headers
    const opts = { name: "noip", userId: null, perMinuteAnon: 1 };
    const r1 = await guardLLM(req, opts);
    const r2 = await guardLLM(req, opts);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false); // mesma chave "anon", saturou
  });

  it("retryAfter sempre >= 1 segundo quando bloqueado", async () => {
    const req = makeReq({ "x-forwarded-for": "8.8.8.8" });
    const opts = { name: "rtry", userId: null, perMinuteAnon: 1 };
    await guardLLM(req, opts);
    const r = await guardLLM(req, opts);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("rate-limit contract", () => {
  it("guardLLM e async (retorna Promise)", () => {
    const req = makeReq({ "x-forwarded-for": "1.1.1.1" });
    const ret = guardLLM(req, { name: "test", userId: null });
    expect(ret).toBeInstanceOf(Promise);
  });

  it("checkLimit e async (retorna Promise)", () => {
    const ret = checkLimit({ name: "test", userId: "u1", perMinute: 5 });
    expect(ret).toBeInstanceOf(Promise);
  });
});
