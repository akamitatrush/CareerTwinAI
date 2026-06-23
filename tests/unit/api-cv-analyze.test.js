// Integration tests da rota POST /api/cv/analyze-bullets.
//
// Cobertura:
//  - 401 quando sem sessao (anonimos nao entram)
//  - 400 BAD_JSON / INVALID_INPUT
//  - 402 LIMIT_REACHED quando enforceUsage nega
//  - 402 BUDGET_EXCEEDED quando checkDailyBudget nega (pre-LLM)
//  - 429 quando guardLLM nega
//  - 502 LLM_FAILED quando completeJSONWithUsage lanca
//  - 200 retorna bullets analisados + originalLineIndex mapeado
//  - Bullets com texto < 15 chars sao filtrados antes do LLM
//  - Sanitizacao: issues invalidas sao removidas, score clampeado 0-100,
//    suggestion >75 omitida, suggestion cortada em 600 chars
//  - Audit em BUDGET_EXCEEDED (pre-LLM e post-LLM)
//
// Mocks: auth, llm, billing, rate-limit, audit.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/llm", () => ({
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/billing/enforce", () => ({
  enforceUsage: vi.fn(async () => ({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" })),
  trackTokenUsage: vi.fn(async () => undefined),
  checkDailyBudget: vi.fn(async () => ({ ok: true, used: 0, cap: 100 })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn(async () => ({ ok: true })),
  tooMany: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "rate", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
  ),
}));

import { completeJSONWithUsage } from "@/lib/llm";
import { auth } from "@/lib/auth";
import {
  enforceUsage,
  trackTokenUsage,
  checkDailyBudget,
} from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

// CV de teste — varias linhas, algumas bulletizaveis (entre 15 e 300 chars),
// outras curtas (filtradas no extract).
const CV_WITH_BULLETS = [
  "Maria Silva",
  "maria@email.com",
  "",
  "EXPERIENCIA",
  "Auxiliei na implementacao de APIs REST em Python sem dados de impacto.",
  "ab", // < 15 chars — filtrado
  "Construi sistema de billing servindo 50k usuarios/mes com Stripe e Postgres.",
  "Participei de reunioes de planning agile com a squad de produto.",
].join("\n");

const VALID_LLM_RESPONSE = {
  bullets: [
    {
      index: 0, // primeiro bullet bulletizavel
      score: 35,
      issues: ["no-metric", "weak-verb"],
      suggestion: "Implementei APIs REST em Python servindo X req/s com latencia Y ms.",
    },
    {
      index: 1, // segundo bullet
      score: 85,
      issues: [],
    },
    {
      index: 2, // terceiro bullet
      score: 50,
      issues: ["generic"],
      suggestion: "Participei do planning agile semanal, contribuindo com estimativas tecnicas em 12 sprints.",
    },
  ],
};

let POST;

beforeEach(async () => {
  vi.resetModules();
  completeJSONWithUsage.mockReset();
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({
    ok: true,
    remaining: 99,
    limit: 100,
    plan: "pro_monthly",
  });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });
  audit.mockReset();
  audit.mockResolvedValue(undefined);

  const mod = await import("@/app/api/cv/analyze-bullets/route.js");
  POST = mod.POST;
});

describe("POST /api/cv/analyze-bullets — auth", () => {
  it("401 UNAUTHORIZED quando sem sessao", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(401);
    const data = await r.json();
    expect(data.code).toBe("UNAUTHORIZED");
    // Sem chamar LLM nem billing antes do gate de auth.
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
    expect(enforceUsage).not.toHaveBeenCalled();
  });

  it("401 quando session sem user.id", async () => {
    auth.mockResolvedValue({ user: {} });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(401);
  });
});

describe("POST /api/cv/analyze-bullets — gates billing e rate-limit", () => {
  it("429 quando guardLLM nega", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(429);
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("402 LIMIT_REACHED quando enforceUsage nega", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    enforceUsage.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      limit: 5,
      plan: "free",
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(data.feature).toBe("cv-analyze");
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("402 BUDGET_EXCEEDED pre-LLM dispara audit", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    checkDailyBudget.mockResolvedValueOnce({
      ok: false,
      used: 0.5,
      cap: 0.1,
      remaining: 0,
      plan: "free",
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("BUDGET_EXCEEDED");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        action: "SECURITY_BUDGET_EXCEEDED",
      })
    );
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/cv/analyze-bullets — body validation", () => {
  it("400 BAD_JSON quando body invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const req = new Request("http://test.local/api/cv/analyze-bullets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 INVALID_INPUT quando cv abaixo de 60 chars", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({ cv: "muito curto" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_INPUT");
  });

  it("400 INVALID_INPUT quando cv ausente", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(400);
  });

  it("400 INVALID_INPUT quando campo extra (strict)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(
      makeReq({ cv: CV_WITH_BULLETS, role: "Backend", evilField: "attack" })
    );
    expect(r.status).toBe(400);
  });
});

describe("POST /api/cv/analyze-bullets — extracao de bullets", () => {
  it("CV sem bullets bulletizaveis (todas linhas <15 ou >300) retorna []", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    // CV com 60+ chars total mas todas linhas curtas demais individualmente.
    // Cada linha <15 chars; soma >60 pra passar a validacao do Zod (min 60).
    const shortLines = Array(20).fill("abc 123 xyz").join("\n");
    const r = await POST(makeReq({ cv: shortLines }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.bullets).toEqual([]);
    // Nem chama LLM quando nao tem nada pra analisar.
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("linhas <15 chars sao filtradas antes do prompt", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: VALID_LLM_RESPONSE,
      usage: { tokensIn: 100, tokensOut: 50 },
    });
    await POST(makeReq({ cv: CV_WITH_BULLETS }));
    // Verifica que "ab" (linha curta) NAO entrou no prompt do LLM.
    const callArgs = completeJSONWithUsage.mock.calls[0][0];
    const userPrompt = callArgs.user;
    expect(userPrompt).not.toContain('"""ab"""');
    // Mas o bullet "Construi sistema..." (>15 chars) entrou.
    expect(userPrompt).toContain("Construi sistema");
  });
});

describe("POST /api/cv/analyze-bullets — LLM e response shape", () => {
  it("200 retorna bullets com originalLineIndex mapeado", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: VALID_LLM_RESPONSE,
      usage: { tokensIn: 100, tokensOut: 50 },
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data.bullets)).toBe(true);
    expect(data.bullets.length).toBe(3);
    // Cada bullet tem originalLineIndex (o N da linha original no \n-split).
    for (const b of data.bullets) {
      expect(Number.isInteger(b.originalLineIndex)).toBe(true);
      expect(b.originalLineIndex).toBeGreaterThanOrEqual(0);
    }
    // Score>=75 NAO traz suggestion (omitido pra economizar payload).
    const good = data.bullets.find((b) => b.score >= 75);
    expect(good?.suggestion).toBe("");
  });

  it("trackTokenUsage chamado com usage do LLM", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: VALID_LLM_RESPONSE,
      usage: { tokensIn: 100, tokensOut: 50, costUsd: 0.001 },
    });
    await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(trackTokenUsage).toHaveBeenCalledWith(
      "u1",
      "tailor",
      expect.objectContaining({ tokensIn: 100, tokensOut: 50 })
    );
  });

  it("502 LLM_FAILED quando completeJSONWithUsage lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockRejectedValue(new Error("anthropic 500 timeout"));
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    // Mensagem ao cliente nao vaza detalhe interno.
    expect(data.error).not.toContain("timeout");
    expect(data.error).not.toContain("anthropic");
  });

  it("sanitiza issues invalidas e clampeia score", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: {
        bullets: [
          {
            index: 0,
            score: 200, // fora do range — vai virar 100
            issues: ["no-metric", "xss-attack", "rm -rf /"], // 2 ultimas filtradas
            suggestion: "Reescrita ok",
          },
          {
            index: 1,
            score: -50, // negativo — vai virar 0
            issues: "not-an-array", // tipo errado — vira []
            suggestion: "Outra reescrita",
          },
        ],
      },
      usage: { tokensIn: 50, tokensOut: 30 },
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.bullets[0].score).toBe(100);
    expect(data.bullets[0].issues).toEqual(["no-metric"]); // resto filtrado
    expect(data.bullets[1].score).toBe(0);
    expect(data.bullets[1].issues).toEqual([]);
  });

  it("corta suggestion em 600 chars (defesa contra payload gigante)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const huge = "x".repeat(2000);
    completeJSONWithUsage.mockResolvedValue({
      result: {
        bullets: [{ index: 0, score: 30, issues: [], suggestion: huge }],
      },
      usage: { tokensIn: 50, tokensOut: 30 },
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    const data = await r.json();
    expect(data.bullets[0].suggestion.length).toBeLessThanOrEqual(600);
  });

  it("ignora bullets com index fora do range", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: {
        bullets: [
          { index: 99, score: 30, issues: [], suggestion: "fora do range" },
          { index: 0, score: 30, issues: [], suggestion: "ok" },
        ],
      },
      usage: { tokensIn: 50, tokensOut: 30 },
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    const data = await r.json();
    // So o index 0 sobrevive.
    expect(data.bullets.length).toBe(1);
    expect(data.bullets[0].suggestion).toBe("ok");
  });

  it("BUDGET_EXCEEDED post-LLM gera audit (mas devolve 200)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: VALID_LLM_RESPONSE,
      usage: { tokensIn: 100, tokensOut: 50 },
    });
    // Primeiro check (pre-LLM): ok. Segundo check (pos-LLM): nao ok.
    checkDailyBudget
      .mockResolvedValueOnce({ ok: true, used: 0.09, cap: 0.1 })
      .mockResolvedValueOnce({ ok: false, used: 0.11, cap: 0.1 });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(200); // LLM ja gastou — devolve resultado
    const auditCalls = audit.mock.calls.map((c) => c[0]);
    const postLlmAudit = auditCalls.find(
      (c) => c.action === "SECURITY_BUDGET_EXCEEDED" && c.meta?.phase === "post-llm"
    );
    expect(postLlmAudit).toBeDefined();
  });

  it("LLM retornando shape errado (nao array) nao quebra — retorna []", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({
      result: { bullets: "isso devia ser array" },
      usage: { tokensIn: 50, tokensOut: 30 },
    });
    const r = await POST(makeReq({ cv: CV_WITH_BULLETS }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.bullets).toEqual([]);
  });
});
