// Integration tests da rota POST/DELETE /api/gaps/[id]/complete.
//
// Cobertura:
//  - 401 sem session (ambos POST e DELETE)
//  - 400 invalid_id (vazio, nao-string, > 50 chars)
//  - 404 IDOR: gap nao existe OU pertence a snapshot de outro user
//  - 200 marca completedAt (POST happy path)
//  - 200 idempotent (gap ja concluido) retorna alreadyDone:true
//  - 200 DELETE desfaz (completedAt: null)
//  - 500 em DB error (POST update lanca)
//  - Confirma ownership via 2-step (gap.snapshot.userId === session.user.id)
//
// Mocks: prisma, auth, notifications.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    gap: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(async () => undefined),
  NotificationTemplates: {
    gapCompleted: () => ({ kind: "GAP_COMPLETED", title: "x", body: "y" }),
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

let POST, DELETE;

beforeEach(async () => {
  vi.resetModules();
  prisma.gap.findUnique.mockReset();
  prisma.gap.update.mockReset();
  auth.mockReset();

  const mod = await import("@/app/api/gaps/[id]/complete/route.js");
  POST = mod.POST;
  DELETE = mod.DELETE;
});

// ctx.params e Promise no Next 15 — async params. Mockamos pra retornar params direto.
function mkCtx(id) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/gaps/[id]/complete — auth + input validation", () => {
  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(null, mkCtx("gap1"));
    expect(r.status).toBe(401);
    expect(prisma.gap.findUnique).not.toHaveBeenCalled();
  });

  it("400 invalid_id quando id vazio", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(null, mkCtx(""));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.error).toBe("invalid_id");
  });

  it("400 invalid_id quando id > 50 chars", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(null, mkCtx("x".repeat(51)));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.error).toBe("invalid_id");
  });
});

describe("POST /api/gaps/[id]/complete — IDOR defesas", () => {
  it("404 quando gap nao existe", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.gap.findUnique.mockResolvedValue(null);
    const r = await POST(null, mkCtx("gap1"));
    expect(r.status).toBe(404);
    const data = await r.json();
    expect(data.error).toBe("not_found");
    // NAO retorna 403 (evita enumeration).
  });

  it("404 quando gap pertence a snapshot de OUTRO user", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.gap.findUnique.mockResolvedValue({
      id: "gap1",
      completedAt: null,
      habilidade: "k8s",
      impactoPontos: 5,
      snapshot: { userId: "OUTRO" }, // dono diferente
    });
    const r = await POST(null, mkCtx("gap1"));
    expect(r.status).toBe(404);
    const data = await r.json();
    expect(data.error).toBe("not_found");
    // Confirma que NUNCA chamou update.
    expect(prisma.gap.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/gaps/[id]/complete — happy path + idempotencia", () => {
  it("200 marca completedAt", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.gap.findUnique.mockResolvedValue({
      id: "gap1",
      completedAt: null,
      habilidade: "k8s",
      impactoPontos: 5,
      snapshot: { userId: "u1" },
    });
    const completedAt = new Date();
    prisma.gap.update.mockResolvedValue({
      id: "gap1",
      completedAt,
      habilidade: "k8s",
      impactoPontos: 5,
    });
    const r = await POST(null, mkCtx("gap1"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.habilidade).toBe("k8s");
    expect(data.alreadyDone).toBeUndefined();
    // Update foi chamado com completedAt: new Date().
    const updArgs = prisma.gap.update.mock.calls[0][0];
    expect(updArgs.where).toEqual({ id: "gap1" });
    expect(updArgs.data.completedAt).toBeInstanceOf(Date);
  });

  it("200 alreadyDone:true quando gap ja tem completedAt (idempotente)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const ts = new Date(Date.now() - 86400000);
    prisma.gap.findUnique.mockResolvedValue({
      id: "gap1",
      completedAt: ts,
      habilidade: "k8s",
      impactoPontos: 5,
      snapshot: { userId: "u1" },
    });
    const r = await POST(null, mkCtx("gap1"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.alreadyDone).toBe(true);
    // NAO chamou update.
    expect(prisma.gap.update).not.toHaveBeenCalled();
  });

  it("500 quando update lanca (DB error)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.gap.findUnique.mockResolvedValue({
      id: "gap1",
      completedAt: null,
      habilidade: "k8s",
      snapshot: { userId: "u1" },
    });
    prisma.gap.update.mockRejectedValue(new Error("DB pool"));
    const r = await POST(null, mkCtx("gap1"));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.error).toBe("internal");
  });
});

describe("DELETE /api/gaps/[id]/complete — desfaz", () => {
  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await DELETE(null, mkCtx("gap1"));
    expect(r.status).toBe(401);
  });

  it("404 IDOR quando gap de outro user", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.gap.findUnique.mockResolvedValue({
      id: "gap1",
      snapshot: { userId: "OUTRO" },
    });
    const r = await DELETE(null, mkCtx("gap1"));
    expect(r.status).toBe(404);
    expect(prisma.gap.update).not.toHaveBeenCalled();
  });

  it("200 zera completedAt", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.gap.findUnique.mockResolvedValue({
      id: "gap1",
      completedAt: new Date(),
      snapshot: { userId: "u1" },
    });
    prisma.gap.update.mockResolvedValue({ id: "gap1", completedAt: null });
    const r = await DELETE(null, mkCtx("gap1"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.completedAt).toBeNull();
    const updArgs = prisma.gap.update.mock.calls[0][0];
    expect(updArgs.data.completedAt).toBeNull();
  });
});
