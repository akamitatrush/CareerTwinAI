// Integration tests da rota /api/chat com streaming (?stream=1).
//
// Cobertura:
//  - ?stream=1 retorna SSE (Content-Type text/event-stream)
//  - Sem ?stream OU stream=0 mantem JSON legacy (back-compat — covered em api-chat.test.js)
//  - SSE inclui {delta} chunks + {done, full} no final
//  - Erro mid-stream emite {error} mas mantem status 200 (stream ja iniciou)
//  - trackTokenUsage e chamado APOS stream com usage real
//  - Auth/validacao SAO IDENTICOS ao path JSON (mesma falha)
//
// Mocks: prisma, streamLLM (mocked pra emitir chunks controlados), auth,
// rate-limit, billing/enforce.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { findUnique: vi.fn() },
    scoreSnapshot: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/llm", () => ({
  completeJSON: vi.fn(),
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/llm-stream", () => ({
  streamLLM: vi.fn(),
}));
vi.mock("@/lib/prompts", () => ({
  promptChat: vi.fn(() => ({ system: "sys", user: "usr" })),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn(async () => ({ ok: true })),
  tooMany: vi.fn(() =>
    new Response(JSON.stringify({ error: "rate", code: "RATE_LIMITED" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    })
  ),
}));
vi.mock("@/lib/billing/enforce", () => ({
  trackTokenUsage: vi.fn(async () => undefined),
  checkDailyBudget: vi.fn(async () => ({ ok: true, used: 0, cap: 100 })),
  getUserPlan: vi.fn(async () => ({ id: "pro_monthly", name: "Pro" })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

import { prisma } from "@/lib/db";
import { streamLLM } from "@/lib/llm-stream";
import { completeJSONWithUsage } from "@/lib/llm";
import { auth } from "@/lib/auth";
import { guardLLM } from "@/lib/rate-limit";
import {
  trackTokenUsage,
  checkDailyBudget,
  getUserPlan,
} from "@/lib/billing/enforce";

let POST;

// Helper: faz mock do streamLLM que emite os chunks fornecidos. Recebe
// tambem usage final pra simular o que o provider reportaria.
function mockStreamLLM(chunks, usage = { tokensIn: 100, tokensOut: 30, costUsd: 0.000750 }) {
  async function* gen() {
    for (const c of chunks) yield c;
  }
  streamLLM.mockImplementation(() => ({
    stream: gen(),
    getUsage: () => usage,
  }));
}

// Helper: faz request com ?stream=1 (URL valida com query param).
function makeStreamReq(body) {
  return new Request("http://test.local/api/chat?stream=1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Le toda a SSE response e devolve array dos JSON-parsed eventos.
async function readSSE(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() || "";
    for (const b of blocks) {
      const line = b.split("\n").find((l) => l.startsWith("data: "));
      if (line) events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

beforeEach(async () => {
  vi.resetModules();
  prisma.profile.findUnique.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
  streamLLM.mockReset();
  completeJSONWithUsage.mockReset();
  auth.mockReset();
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  getUserPlan.mockReset();
  getUserPlan.mockResolvedValue({ id: "pro_monthly", name: "Pro" });

  const mod = await import("@/app/api/chat/route.js");
  POST = mod.POST;
});

describe("POST /api/chat?stream=1 — SSE response", () => {
  it("retorna Content-Type text/event-stream", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    mockStreamLLM(['{"resposta":"oi"}']);

    const res = await POST(makeStreamReq({ role: "Dev", message: "ola" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(res.headers.get("cache-control")).toMatch(/no-cache/);
  });

  it("emite chunks {delta} em sequencia e fecha com {done, full}", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    mockStreamLLM(['{"resposta":"', "olá ", "mundo", '"}']);

    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    const events = await readSSE(res);

    // Deltas vem na ordem, depois um done.
    const deltas = events.filter((e) => e.delta);
    expect(deltas.map((e) => e.delta)).toEqual(['{"resposta":"', "olá ", "mundo", '"}']);

    const done = events.find((e) => e.done);
    expect(done).toBeTruthy();
    expect(done.full).toBe('{"resposta":"olá mundo"}');
  });

  it("emite {error} quando streamLLM falha mid-stream (status segue 200)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);

    async function* failingGen() {
      yield '{"resposta":"comec';
      throw new Error("Anthropic 500: down");
    }
    streamLLM.mockReturnValue({
      stream: failingGen(),
      getUsage: () => ({ tokensIn: 50, tokensOut: 0, costUsd: 0 }),
    });

    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    expect(res.status).toBe(200); // HTTP ja foi 200 quando comecou a streamar
    const events = await readSSE(res);

    const errEv = events.find((e) => e.error);
    expect(errEv).toBeTruthy();
    expect(errEv.code).toBe("STREAM_FAILED");
    // Mensagem ao cliente eh generica (sem vazar "Anthropic 500: down")
    expect(errEv.error).not.toContain("down");
  });

  it("chama trackTokenUsage com usage do streamLLM apos stream", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    mockStreamLLM(['{"resposta":"oi"}'], {
      tokensIn: 200,
      tokensOut: 50,
      costUsd: 0.00135,
    });

    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    await readSSE(res); // consome o stream pra trigger finally

    expect(trackTokenUsage).toHaveBeenCalledWith("u1", "chat", {
      tokensIn: 200,
      tokensOut: 50,
      costUsd: 0.00135,
    });
  });

  it("nao chama completeJSONWithUsage (JSON path) quando stream=1", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    mockStreamLLM(['{"resposta":"x"}']);

    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    await readSSE(res);

    expect(streamLLM).toHaveBeenCalledTimes(1);
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat — backwards compat sem ?stream", () => {
  it("retorna JSON quando sem query param stream", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({
      result: { resposta: "ola" },
      usage: { tokensIn: 100, tokensOut: 30 },
    });

    const res = await POST(makeReq({ role: "Dev", message: "oi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    // Nao chama o streamLLM
    expect(streamLLM).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.resposta).toBe("ola");
  });

  it("retorna JSON quando ?stream=0 explicito (so '1' ativa)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({
      result: { resposta: "ok" },
      usage: { tokensIn: 100, tokensOut: 30 },
    });

    const req = new Request("http://test.local/api/chat?stream=0", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "Dev", message: "oi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(streamLLM).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat?stream=1 — auth + validacao IDENTICA ao path JSON", () => {
  it("401 sem session (mesmo erro do JSON path)", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    expect(res.status).toBe(401);
    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("400 INVALID_INPUT quando body tenta injetar perfil (anti-injection)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(
      makeStreamReq({
        role: "Dev",
        message: "oi",
        perfil: { nome: "CTO Google" },
      })
    );
    expect(res.status).toBe(400);
    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("429 quando rate-limit nega (nem chega a streamar)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    expect(res.status).toBe(429);
    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("402 quando budget diario excedido (pre-LLM)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    checkDailyBudget.mockResolvedValueOnce({ ok: false, used: 1.0, cap: 0.1 });
    const res = await POST(makeStreamReq({ role: "Dev", message: "oi" }));
    expect(res.status).toBe(402);
    expect(streamLLM).not.toHaveBeenCalled();
  });
});
