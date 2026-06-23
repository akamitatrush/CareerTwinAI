// Integration tests da rota POST /api/interview.
//
// Cobertura:
//  - 400 BAD_JSON / INVALID_ACTION / ROLE_REQUIRED
//  - 400 QUESTION_REQUIRED / ANSWER_REQUIRED (action=evaluate)
//  - 402 LIMIT_REACHED (5 simulacoes/mes Free)
//  - 429 quando guardLLM nega
//  - 502 LLM_FAILED quando completeJSON lanca
//  - 200 action=question: chama promptInterviewQuestion
//  - 200 action=evaluate: chama promptInterviewEval
//  - anonimo NAO chama enforce (so rate-limit)
//
// Mocks: LLM, prompts, auth, billing, rate-limit.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/llm", () => ({
  completeJSON: vi.fn(),
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/prompts", () => ({
  promptInterviewQuestion: vi.fn(async () => ({ system: "sys", user: "usr" })),
  promptInterviewEval: vi.fn(() => ({ system: "sys", user: "usr" })),
}));
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

import { completeJSON, completeJSONWithUsage } from "@/lib/llm";
import {
  promptInterviewQuestion,
  promptInterviewEval,
} from "@/lib/prompts";
import { auth } from "@/lib/auth";
import {
  enforceUsage,
  trackTokenUsage,
  checkDailyBudget,
} from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";

let POST;

beforeEach(async () => {
  vi.resetModules();
  completeJSON.mockReset();
  completeJSONWithUsage.mockReset();
  promptInterviewQuestion.mockReset();
  promptInterviewQuestion.mockResolvedValue({ system: "sys", user: "usr" });
  promptInterviewEval.mockReset();
  promptInterviewEval.mockReturnValue({ system: "sys", user: "usr" });
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });

  const mod = await import("@/app/api/interview/route.js");
  POST = mod.POST;
});

describe("POST /api/interview — input validation", () => {
  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue(null);
    const req = new Request("http://test.local/api/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 INVALID_ACTION quando action invalido", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ action: "unknown", role: "Backend" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_ACTION");
  });

  it("400 ROLE_REQUIRED quando action=question sem role", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ action: "question", role: "" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("ROLE_REQUIRED");
  });

  it("400 QUESTION_REQUIRED quando evaluate sem pergunta", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(
      makeReq({
        action: "evaluate",
        role: "Backend",
        pergunta: "",
        resposta: "minha resposta",
      })
    );
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("QUESTION_REQUIRED");
  });

  it("400 ANSWER_REQUIRED quando evaluate sem resposta", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(
      makeReq({
        action: "evaluate",
        role: "Backend",
        pergunta: "como vc estrutura?",
        resposta: "",
      })
    );
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("ANSWER_REQUIRED");
  });
});

describe("POST /api/interview — gates billing e rate-limit", () => {
  it("429 quando guardLLM nega", async () => {
    auth.mockResolvedValue(null);
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({ action: "question", role: "Backend" }));
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
    const r = await POST(makeReq({ action: "question", role: "Backend" }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(data.feature).toBe("interview");
  });

  it("anonimo NAO chama enforce", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: { pergunta: "Q?" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ action: "question", role: "Backend" }));
    expect(r.status).toBe(200);
    expect(enforceUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/interview — modos question + evaluate", () => {
  it("action=question: chama promptInterviewQuestion (NAO eval)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: { pergunta: "Como vc estrutura uma API?" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(
      makeReq({ action: "question", role: "Backend", gaps: ["k8s"], asked: [] })
    );
    expect(r.status).toBe(200);
    expect(promptInterviewQuestion).toHaveBeenCalledTimes(1);
    expect(promptInterviewEval).not.toHaveBeenCalled();
    const data = await r.json();
    expect(data.pergunta).toBeDefined();
  });

  it("action=evaluate: chama promptInterviewEval (NAO question)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: { nota: 8, feedback: "Bom" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(
      makeReq({
        action: "evaluate",
        role: "Backend",
        pergunta: "Q?",
        resposta: "R.",
      })
    );
    expect(r.status).toBe(200);
    expect(promptInterviewEval).toHaveBeenCalledTimes(1);
    expect(promptInterviewQuestion).not.toHaveBeenCalled();
  });

  it("502 LLM_FAILED quando completeJSON lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockRejectedValue(new Error("timeout"));
    const r = await POST(makeReq({ action: "question", role: "Backend" }));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    expect(data.error).not.toContain("timeout");
  });
});
