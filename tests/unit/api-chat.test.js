// Integration tests da rota POST /api/chat.
//
// Cobertura:
//  - 401 sem session (chat exige login — sem modo anonimo)
//  - 400 BAD_JSON / ROLE_REQUIRED / MESSAGE_REQUIRED
//  - 400 INVALID_INPUT quando body tem perfil/gaps (rejeicao anti-injection)
//  - 429 quando guardLLM nega
//  - 200 happy: rota busca perfil + gaps do DB (NAO do body)
//  - 200 perfil sem perfilJson: monta fallback dos campos estruturados
//  - 200 sem gaps no snapshot: usa array vazio
//  - 502 LLM_FAILED quando completeJSON lanca
//
// Mocks: prisma, LLM, auth, rate-limit.

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
import { completeJSON, completeJSONWithUsage } from "@/lib/llm";
import { auth } from "@/lib/auth";
import { guardLLM } from "@/lib/rate-limit";
import { promptChat } from "@/lib/prompts";
import {
  trackTokenUsage,
  checkDailyBudget,
  getUserPlan,
} from "@/lib/billing/enforce";

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.profile.findUnique.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
  completeJSON.mockReset();
  completeJSONWithUsage.mockReset();
  auth.mockReset();
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });
  promptChat.mockClear();
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  getUserPlan.mockReset();
  getUserPlan.mockResolvedValue({ id: "pro_monthly", name: "Pro" });

  const mod = await import("@/app/api/chat/route.js");
  POST = mod.POST;
});

describe("POST /api/chat — auth + input validation", () => {
  it("401 sem session (anonimo NAO tem chat)", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ role: "Dev", message: "oi" }));
    expect(r.status).toBe(401);
    const data = await r.json();
    expect(data.code).toBe("UNAUTHORIZED");
    // Nem chega no rate-limit.
    expect(guardLLM).not.toHaveBeenCalled();
  });

  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const req = new Request("http://test.local/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 ROLE_REQUIRED quando role vazio", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({ role: "", message: "oi" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("ROLE_REQUIRED");
  });

  it("400 MESSAGE_REQUIRED quando message vazia", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({ role: "Dev", message: "" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("MESSAGE_REQUIRED");
  });

  it("400 INVALID_INPUT quando body tenta injetar perfil (strict schema)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(
      makeReq({
        role: "Dev",
        message: "oi",
        perfil: { nome: "CTO Google" },
        gaps: ["nothing"],
      })
    );
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_INPUT");
    // LLM nem foi chamado.
    expect(completeJSON).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat — rate-limit gate", () => {
  it("429 quando guardLLM nega", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({ role: "Dev", message: "oi" }));
    expect(r.status).toBe(429);
    expect(completeJSON).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat — ownership: usa perfil do DB, NAO do body", () => {
  it("server carrega perfil + gaps via prisma escopado por userId", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      perfilJson: { nome: "Maria", skills: ["python"] },
      targetRole: "Backend",
    });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({
      gaps: [{ habilidade: "kubernetes" }],
    });
    completeJSONWithUsage.mockResolvedValue({ result: { reply: "ola maria" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ role: "Backend", message: "como melhoro?" }));
    expect(r.status).toBe(200);
    // Confirma scope correto na query (IDOR-safe).
    expect(prisma.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.scoreSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { createdAt: "desc" },
      })
    );
    // promptChat recebe perfil do DB (Maria), nao do body.
    const [, perfilArg] = promptChat.mock.calls[0];
    expect(perfilArg.nome).toBe("Maria");
  });

  it("perfil sem perfilJson: monta fallback dos campos estruturados", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      perfilJson: null,
      nome: "Joao",
      cargoAtual: "Dev Pleno",
      senioridade: "pleno",
      skills: ["python", "sql"],
    });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: { reply: "oi joao" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ role: "Backend", message: "oi" }));
    expect(r.status).toBe(200);
    const [, perfilArg, gapsArg] = promptChat.mock.calls[0];
    expect(perfilArg.nome).toBe("Joao");
    expect(perfilArg.cargo_atual).toBe("Dev Pleno");
    expect(perfilArg.skills).toEqual(["python", "sql"]);
    expect(gapsArg).toEqual([]);
  });

  it("usuario sem profile nem snapshot: perfil minimo + gaps vazio", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: { reply: "ola" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ role: "Backend", message: "oi" }));
    expect(r.status).toBe(200);
    const [, perfilArg, gapsArg] = promptChat.mock.calls[0];
    expect(perfilArg.nome).toBe("");
    expect(perfilArg.skills).toEqual([]);
    expect(gapsArg).toEqual([]);
  });
});

describe("POST /api/chat — LLM failure", () => {
  it("502 LLM_FAILED quando completeJSON lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ perfilJson: {} });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockRejectedValue(new Error("LLM down"));
    const r = await POST(makeReq({ role: "Backend", message: "oi" }));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    expect(data.error).not.toContain("down");
  });
});
