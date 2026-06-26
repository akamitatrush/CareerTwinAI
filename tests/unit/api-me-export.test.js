// Integration tests da rota GET /api/me/export.
//
// Cobertura:
//  - 401 sem session (sem export anonimo — defesa contra IDOR)
//  - 200 retorna JSON com dados do user
//  - audit() chamado com DATA_EXPORTED + meta { bytes }
//  - Headers: content-disposition attachment, content-type, cache-control no-store
//  - 500 EXPORT_FAILED quando exportUserData lanca
//
// Mocks: auth, data-export, audit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/data-export", () => ({ exportUserData: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

import { auth } from "@/lib/auth";
import { exportUserData } from "@/lib/data-export";
import { audit } from "@/lib/audit";

let GET;

beforeEach(async () => {
  vi.resetModules();
  auth.mockReset();
  exportUserData.mockReset();
  audit.mockReset();

  const mod = await import("@/app/api/me/export/route.js");
  GET = mod.GET;
});

function makeGetReq() {
  return new Request("http://test.local/api/me/export", { method: "GET" });
}

describe("GET /api/me/export — auth", () => {
  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await GET(makeGetReq());
    expect(r.status).toBe(401);
    const data = await r.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(exportUserData).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

describe("GET /api/me/export — happy path", () => {
  it("200 retorna JSON com dados do user", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const mockData = {
      version: "2",
      user: { id: "u1", email: "a@b.com" },
      profile: null,
      snapshots: [],
      assessments: [],
      evidence: [],
      usageMeters: [],
      billingEvents: [],
    };
    exportUserData.mockResolvedValue(mockData);
    const r = await GET(makeGetReq());
    expect(r.status).toBe(200);
    const text = await r.text();
    const parsed = JSON.parse(text);
    expect(parsed.user.id).toBe("u1");
    expect(parsed.version).toBe("2");
    // Confirma escopo correto.
    expect(exportUserData).toHaveBeenCalledWith("u1");
  });

  it("Headers: attachment + cache-control no-store + content-type application/json", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    exportUserData.mockResolvedValue({ user: { id: "u1" } });
    const r = await GET(makeGetReq());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(r.headers.get("content-disposition")).toContain("attachment");
    expect(r.headers.get("content-disposition")).toContain("careertwin-export-u1.json");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("audit() chamado com DATA_EXPORTED + bytes em meta", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    exportUserData.mockResolvedValue({ user: { id: "u1" } });
    await GET(makeGetReq());
    expect(audit).toHaveBeenCalledTimes(1);
    const call = audit.mock.calls[0][0];
    expect(call.userId).toBe("u1");
    expect(call.action).toBe("DATA_EXPORTED");
    expect(call.target).toBe("User:u1");
    expect(call.meta.bytes).toBeGreaterThan(0);
  });

  it("audit roda DEPOIS do export (request termina com sucesso)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const calls = [];
    exportUserData.mockImplementation(async () => {
      calls.push("export");
      return { user: { id: "u1" } };
    });
    audit.mockImplementation(async () => {
      calls.push("audit");
    });
    await GET(makeGetReq());
    expect(calls).toEqual(["export", "audit"]);
  });
});

describe("GET /api/me/export — DB failure", () => {
  it("500 EXPORT_FAILED quando exportUserData lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    exportUserData.mockRejectedValue(new Error("DB connection lost"));
    const r = await GET(makeGetReq());
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.code).toBe("EXPORT_FAILED");
    expect(data.error).not.toContain("connection lost");
    // audit nao foi chamado (export falhou antes).
    expect(audit).not.toHaveBeenCalled();
  });
});
