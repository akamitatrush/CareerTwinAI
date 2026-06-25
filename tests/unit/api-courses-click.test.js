// Tests da rota POST /api/courses/click.
//
// Cobertura:
//  - POST sem body -> 400 (BAD_JSON)
//  - POST com URL invalida -> 400 (INVALID_BODY)
//  - POST com body valido -> 200 com decoratedUrl + trackedAt
//  - Rate-limit excedido -> 429
//  - Provider sem env setada -> decoratedUrl == url original (backward-compat)
//  - Provider com env setada -> decoratedUrl tem ?ref=...
//  - strict() rejeita campo extra (defesa contra payload abuse)
//  - Auth anonimo OK (modo "experimentar")
//
// Mocks: auth (sessao opcional), rate-limit (controlavel por test). Sem prisma.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn().mockResolvedValue({ ok: true }),
  tooMany: vi.fn(() => new Response("Too many", { status: 429 })),
}));

import { auth } from "@/lib/auth";
import { guardLLM } from "@/lib/rate-limit";
import { POST } from "@/app/api/courses/click/route";

function mkPost(body) {
  return new Request("http://localhost/api/courses/click", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Lista das envs que esses tests podem mexer.
const ENV_KEYS = [
  "TERA_AFFILIATE_ID",
  "ALURA_AFFILIATE_ID",
  "ROCKETSEAT_AFFILIATE_ID",
  "UDEMY_AFFILIATE_ID",
  "DIO_AFFILIATE_ID",
  "COURSERA_AFFILIATE_ID",
  "HASHTAG_AFFILIATE_ID",
  "TRYBE_AFFILIATE_ID",
  "PM3_AFFILIATE_ID",
];

describe("POST /api/courses/click", () => {
  const original = {};

  beforeEach(() => {
    auth.mockReset();
    guardLLM.mockReset();
    guardLLM.mockResolvedValue({ ok: true });
    // Limpa envs de afiliado pra estado conhecido.
    for (const k of ENV_KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("400 quando body nao eh JSON valido", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(mkPost("not-json{{{"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_JSON");
  });

  it("400 quando URL eh invalida", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "c1",
        provider: "Tera",
        url: "nao-eh-url-valida",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_BODY");
  });

  it("400 quando campos obrigatorios ausentes", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(mkPost({ courseId: "c1" }));
    expect(res.status).toBe(400);
  });

  it("200 com body valido (sem env -> URL crua, backward-compat)", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "tera-prod-mgmt",
        provider: "Tera",
        url: "https://somostera.com/curso",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackedAt).toBeTruthy();
    expect(typeof body.trackedAt).toBe("string");
    // Sem env: decoratedUrl == url original.
    expect(body.decoratedUrl).toBe("https://somostera.com/curso");
  });

  it("200 com provider sem programa de afiliado retorna URL original", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "fcc-py",
        provider: "freeCodeCamp",
        url: "https://freecodecamp.org/learn/python",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decoratedUrl).toBe("https://freecodecamp.org/learn/python");
  });

  it("200 com env setada decora URL com param de afiliado", async () => {
    process.env.TERA_AFFILIATE_ID = "careertwin";
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "tera-prod",
        provider: "Tera",
        url: "https://somostera.com/curso",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decoratedUrl).toContain("ref=careertwin");
  });

  it("200 com Udemy usa param referralCode (nao ref)", async () => {
    process.env.UDEMY_AFFILIATE_ID = "myid";
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "udemy-react",
        provider: "Udemy",
        url: "https://udemy.com/course/react",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decoratedUrl).toContain("referralCode=myid");
  });

  it("429 quando rate-limit excedido", async () => {
    auth.mockResolvedValue(null);
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await POST(
      mkPost({
        courseId: "c1",
        provider: "Tera",
        url: "https://somostera.com/curso",
      }),
    );
    expect(res.status).toBe(429);
  });

  it("strict() rejeita campo extra (defesa contra payload abuse)", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "c1",
        provider: "Tera",
        url: "https://somostera.com/curso",
        userId: "spoofed", // campo extra -> strict() rejeita
        admin: true,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_BODY");
  });

  it("auth anonimo OK (modo experimentar)", async () => {
    // Sem session, ainda assim 200 (rate-limit bate por IP).
    auth.mockResolvedValue(null);
    const res = await POST(
      mkPost({
        courseId: "c1",
        provider: "Tera",
        url: "https://somostera.com/curso",
      }),
    );
    expect(res.status).toBe(200);
    // Confirma que guardLLM foi chamado com userId null (anon bucket).
    expect(guardLLM).toHaveBeenCalled();
    const call = guardLLM.mock.calls[0][1];
    expect(call.userId).toBeNull();
    expect(call.name).toBe("course-click");
  });

  it("auth user OK (logado)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(
      mkPost({
        courseId: "c1",
        provider: "Tera",
        url: "https://somostera.com/curso",
      }),
    );
    expect(res.status).toBe(200);
    const call = guardLLM.mock.calls[0][1];
    expect(call.userId).toBe("u1");
  });
});
