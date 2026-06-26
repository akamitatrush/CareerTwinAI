// Integration tests da rota POST /api/analyze com streaming (?stream=1).
//
// Cobertura:
//  - ?stream=1 retorna SSE (Content-Type text/event-stream)
//  - Sem ?stream mantem JSON one-shot (back-compat coberto em api-analyze.test.js)
//  - SSE emite eventos {type:"step"} em ordem + {type:"result"} + {type:"done"}
//  - Erro mid-stream (LLM_FAILED, validacao) emite {type:"error", status, code}
//  - Status HTTP segue 200 quando stream ja foi aberto (SSE spec)
//  - LLM + searchJobs rodam em PARALELO (Promise.allSettled) — validamos
//    medindo timing das chamadas mockadas
//
// Mocks: identicos ao api-analyze.test.js pra herdar fixtures.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const mock = {
    profile: { upsert: vi.fn(), update: vi.fn() },
    scoreSnapshot: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    notification: { count: vi.fn() },
    consent: { create: vi.fn() },
    dataSource: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (cb) => {
    if (typeof cb === "function") return await cb(mock);
    return await Promise.all(cb);
  });
  return { prisma: mock };
});

vi.mock("@/lib/llm", () => ({
  completeJSON: vi.fn(),
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/prompts", () => ({
  promptDiag: vi.fn(async () => ({ system: "sys", user: "usr" })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/billing/enforce", () => ({
  enforceUsage: vi.fn(async () => ({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" })),
  trackTokenUsage: vi.fn(async () => undefined),
  checkDailyBudget: vi.fn(async () => ({ ok: true, used: 0, cap: 100 })),
}));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn(async () => ({ ok: true })),
  tooMany: vi.fn(() =>
    new Response(JSON.stringify({ error: "rate", code: "RATE_LIMITED" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    })
  ),
}));
vi.mock("@/lib/jobs", () => ({
  searchJobs: vi.fn(async () => ({ jobs: [], sources: [] })),
}));
vi.mock("@/lib/scoring/subscores", () => ({
  computeAllSubScores: vi.fn(() => ({
    overall: 72,
    sub_scores: {
      aderencia_vagas: { valor: 70, _meta: {} },
      relevancia_habilidades: { valor: 75, _meta: {} },
      otimizacao_perfil: { valor: 80, _meta: {} },
      experiencia_mercado: { valor: 65, _meta: {} },
    },
  })),
}));
vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(async () => undefined),
  NotificationTemplates: {
    scoreUpdated: () => ({ kind: "SCORE_UPDATED", title: "x", body: "y" }),
    welcome: () => ({ kind: "WELCOME", title: "x", body: "y" }),
  },
}));
vi.mock("@/lib/achievements", () => ({
  grantAchievement: vi.fn(async () => undefined),
}));

import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { auth } from "@/lib/auth";
import { enforceUsage, trackTokenUsage, checkDailyBudget } from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";
import { searchJobs } from "@/lib/jobs";

const VALID_CV = "Maria, dev backend ha 5 anos. Trabalhou com Python, SQL, Docker e AWS em empresas grandes.";
const VALID_DIAG = {
  perfil: {
    nome: "Maria",
    cargo_atual: "Dev Pleno",
    senioridade: "pleno",
    skills: ["python", "sql"],
  },
  sub_scores_explicacoes: {
    aderencia_vagas: "Boa aderencia. [Mercado]",
    relevancia_habilidades: "Skills modernas. [Curriculo]",
    otimizacao_perfil: "Bom perfil. [Curriculo]",
    experiencia_mercado: "5 anos pleno. [Curriculo]",
  },
  gaps: [
    {
      habilidade: "kubernetes",
      porque: "60% das vagas pedem",
      frequencia: "60%",
      microacao: "Curso CKAD",
      impacto: { dimensao: "aderencia_vagas", pontos: 5 },
    },
  ],
};

let POST;

// Helper: faz request com ?stream=1.
function makeStreamReq(body) {
  return new Request("http://test.local/api/analyze?stream=1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Helper: faz request JSON tradicional (sem ?stream).
function makeJsonReq(body) {
  return new Request("http://test.local/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Le toda a SSE response e devolve array dos JSON-parsed eventos em ordem.
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
  prisma.profile.upsert.mockReset();
  prisma.profile.update.mockReset();
  prisma.scoreSnapshot.create.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
  prisma.scoreSnapshot.count.mockReset();
  prisma.notification.count.mockReset();
  prisma.consent.create.mockReset();
  prisma.dataSource.create.mockReset();
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(async (cb) => {
    if (typeof cb === "function") return await cb(prisma);
    return await Promise.all(cb);
  });
  completeJSONWithUsage.mockReset();
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });
  searchJobs.mockReset();
  searchJobs.mockResolvedValue({ jobs: [], sources: [] });

  const mod = await import("@/app/api/analyze/route.js");
  POST = mod.POST;
});

describe("POST /api/analyze?stream=1 — SSE response", () => {
  it("retorna Content-Type text/event-stream", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(res.headers.get("cache-control")).toMatch(/no-cache/);
  });

  it("emite events {step} em ordem + {result} + {done}", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    const events = await readSSE(res);

    const stepEvents = events.filter((e) => e.type === "step");
    const stepNames = stepEvents.map((e) => e.step);

    // Ordem esperada: validating -> llm_jobs_parallel -> computing
    // (persisting nao roda em anon — sai antes).
    expect(stepNames).toContain("validating");
    expect(stepNames).toContain("llm_jobs_parallel");
    expect(stepNames).toContain("computing");

    // validating vem antes de llm_jobs_parallel.
    expect(stepNames.indexOf("validating")).toBeLessThan(stepNames.indexOf("llm_jobs_parallel"));
    // llm_jobs_parallel vem antes de computing.
    expect(stepNames.indexOf("llm_jobs_parallel")).toBeLessThan(stepNames.indexOf("computing"));

    const resultEv = events.find((e) => e.type === "result");
    expect(resultEv).toBeTruthy();
    expect(resultEv.payload.overall).toBe(72);
    expect(resultEv.payload.efemero).toBe(true);

    const doneEv = events.find((e) => e.type === "done");
    expect(doneEv).toBeTruthy();
  });

  it("user logado emite step 'persisting' + payload com snapshotId", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });
    prisma.profile.upsert.mockResolvedValue({ userId: "u1" });
    prisma.scoreSnapshot.create.mockResolvedValue({ id: "snap-1", overall: 72, gaps: VALID_DIAG.gaps });
    prisma.scoreSnapshot.count.mockResolvedValue(0);
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    prisma.notification.count.mockResolvedValue(0);

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    const events = await readSSE(res);

    const stepNames = events.filter((e) => e.type === "step").map((e) => e.step);
    expect(stepNames).toContain("persisting");

    const resultEv = events.find((e) => e.type === "result");
    expect(resultEv.payload.snapshotId).toBe("snap-1");
    expect(resultEv.payload.efemero).toBeUndefined();
  });

  it("LLM + searchJobs sao chamados em paralelo (allSettled)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    await readSSE(res);

    // Ambos chamados uma vez, sem dependencia mutua.
    expect(completeJSONWithUsage).toHaveBeenCalledTimes(1);
    expect(searchJobs).toHaveBeenCalledTimes(1);
    // searchJobs recebe role direto, NAO precisa do output do LLM.
    expect(searchJobs).toHaveBeenCalledWith({
      role: "Backend",
      location: "Brasil",
      limit: 50,
    });
  });

  it("paralelismo: searchJobs chamado ANTES do LLM resolver", async () => {
    // Prova empirica de paralelismo: LLM demora 80ms, searchJobs 10ms.
    // Em paralelo: total ~80ms (LLM bottleneck).
    // Em serial seria ~90ms. Mais importante: searchJobs deve ter SIDO
    // chamado antes do LLM ter resolvido — verificavel via ordem das calls.
    auth.mockResolvedValue(null);
    const callOrder = [];
    completeJSONWithUsage.mockImplementation(async () => {
      callOrder.push({ name: "llm", phase: "start", t: Date.now() });
      await new Promise((r) => setTimeout(r, 80));
      callOrder.push({ name: "llm", phase: "end", t: Date.now() });
      return { result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } };
    });
    searchJobs.mockImplementation(async () => {
      callOrder.push({ name: "jobs", phase: "start", t: Date.now() });
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push({ name: "jobs", phase: "end", t: Date.now() });
      return { jobs: [], sources: [] };
    });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    await readSSE(res);

    // searchJobs comeca antes do LLM acabar (paralelo).
    const llmStart = callOrder.find((c) => c.name === "llm" && c.phase === "start");
    const llmEnd = callOrder.find((c) => c.name === "llm" && c.phase === "end");
    const jobsStart = callOrder.find((c) => c.name === "jobs" && c.phase === "start");
    expect(jobsStart.t).toBeLessThan(llmEnd.t);
    // Os dois inicios sao basicamente simultaneos (paralelo: <50ms entre eles).
    expect(Math.abs(jobsStart.t - llmStart.t)).toBeLessThan(50);
  });

  it("emite {error} mid-stream quando LLM falha (status HTTP segue 200)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockRejectedValue(new Error("upstream timeout"));

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    expect(res.status).toBe(200); // HTTP ja foi 200 quando stream comecou.

    const events = await readSSE(res);
    const errEv = events.find((e) => e.type === "error");
    expect(errEv).toBeTruthy();
    expect(errEv.code).toBe("LLM_FAILED");
    expect(errEv.status).toBe(502);
    // Nao vaza detalhe upstream.
    expect(errEv.error).not.toContain("timeout");
  });

  it("emite {error} quando LLM retorna shape invalido", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({
      result: { perfil: {}, gaps: "string-bad" },
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    const events = await readSSE(res);
    const errEv = events.find((e) => e.type === "error");
    expect(errEv).toBeTruthy();
    expect(errEv.code).toBe("LLM_INVALID");
    expect(errEv.status).toBe(502);
  });

  it("emite {error} quando body invalido (validacao)", async () => {
    auth.mockResolvedValue(null);

    const res = await POST(makeStreamReq({ cv: "curto", role: "Backend" }));
    const events = await readSSE(res);
    const errEv = events.find((e) => e.type === "error");
    expect(errEv).toBeTruthy();
    expect(errEv.code).toBe("CV_TOO_SHORT");
    expect(errEv.status).toBe(400);
    // Nao chega a chamar LLM.
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("rate-limit serializa pra {error} no stream tambem", async () => {
    auth.mockResolvedValue(null);
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    // Rate-limit retorna antes do stream iniciar — pode ser response direta.
    // Aceitamos ambos: 429 direta OU 200 com event {error, status:429}.
    if (res.status === 429) {
      // Path direto (rate-limit retornou Response sem entrar no SSE branch).
      // Isso eh aceitavel porque nao chegou a emitir nada ainda.
      expect(completeJSONWithUsage).not.toHaveBeenCalled();
    } else {
      expect(res.status).toBe(200);
      const events = await readSSE(res);
      const errEv = events.find((e) => e.type === "error");
      expect(errEv).toBeTruthy();
      expect(errEv.status).toBe(429);
    }
  });

  it("trackTokenUsage chamado mesmo em LLM_INVALID (tokens ja gastos)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: { perfil: {}, gaps: "string-bad" },
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    await readSSE(res);

    expect(trackTokenUsage).toHaveBeenCalledWith("u1", "analyze", {
      inputTokens: 100,
      outputTokens: 50,
    });
  });
});

describe("POST /api/analyze — backwards compat sem ?stream", () => {
  it("retorna JSON quando sem query param stream", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });

    const res = await POST(makeJsonReq({ cv: VALID_CV, role: "Backend" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.overall).toBe(72);
    expect(data.efemero).toBe(true);
  });

  it("?stream=0 explicito tambem retorna JSON (so '1' ativa)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });

    const req = new Request("http://test.local/api/analyze?stream=0", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cv: VALID_CV, role: "Backend" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("erro de validacao no path JSON segue retornando status HTTP correto", async () => {
    auth.mockResolvedValue(null);

    const res = await POST(makeJsonReq({ cv: "curto", role: "Backend" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("CV_TOO_SHORT");
  });

  it("LLM_FAILED no path JSON retorna 502 (nao stream)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockRejectedValue(new Error("down"));

    const res = await POST(makeJsonReq({ cv: VALID_CV, role: "Backend" }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.code).toBe("LLM_FAILED");
  });
});

describe("POST /api/analyze — paralelismo melhora tempo total", () => {
  it("falha de searchJobs NAO mata diagnostico (degrada gracioso)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });
    searchJobs.mockRejectedValue(new Error("Adzuna down"));

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    const events = await readSSE(res);

    // Diagnostico continua chegando — score de aderencia pode ser baixo,
    // mas o pipeline nao quebra.
    const resultEv = events.find((e) => e.type === "result");
    expect(resultEv).toBeTruthy();
    expect(resultEv.payload.overall).toBe(72);
  });

  it("falha de LLM mata o diagnostico (jobs nao salva)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockRejectedValue(new Error("Anthropic 500"));
    // searchJobs roda em paralelo e PODE ter retornado com sucesso, mas o
    // resultado nao chega ao cliente porque LLM e critico.

    const res = await POST(makeStreamReq({ cv: VALID_CV, role: "Backend" }));
    const events = await readSSE(res);

    const errEv = events.find((e) => e.type === "error");
    expect(errEv).toBeTruthy();
    expect(errEv.code).toBe("LLM_FAILED");
    // searchJobs PODE ter sido chamado (paralelo), mas isso e ok — gasto
    // foi minimo (call HTTP, nao LLM).
  });
});
