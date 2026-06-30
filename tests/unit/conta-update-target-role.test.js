// Tests da server action `updateTargetRole` em app/(app)/conta/actions.js.
//
// Cobertura:
//  - UNAUTHORIZED quando sem sessao (anti IDOR — userId NUNCA vem do input)
//  - INVALID_INPUT quando body invalido (max 80 chars / campo extra)
//  - PERSIST_FAILED quando prisma falha
//  - ok=true + roleChanged=true quando role mudou (caso do fundador 2026-06-30)
//  - ok=true + roleChanged=false quando role NAO mudou (so re-salvar)
//  - ok=true + roleChanged=true quando oldRole=null e newRole preenchido
//    (primeira vez setando — tambem precisa disparar refresh)
//  - ok=true + roleChanged=true quando newRole="" e oldRole tinha valor
//    (limpar tambem e mudanca — banner pode sinalizar inconsistencia)
//  - Audit log PROFILE_UPDATED chamado com meta sanitizado (sem revelar cargo)
//
// Mocks: next/headers, next/cache, prisma, auth, audit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (k) => {
      if (k === "x-forwarded-for") return "203.0.113.7";
      return null;
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

let updateTargetRole;

beforeEach(async () => {
  vi.resetModules();
  prisma.profile.findUnique.mockReset();
  prisma.profile.upsert.mockReset();
  auth.mockReset();
  audit.mockReset();
  revalidatePath.mockReset && revalidatePath.mockReset();
  audit.mockResolvedValue(undefined);

  const mod = await import("@/app/(app)/conta/actions.js");
  updateTargetRole = mod.updateTargetRole;
});

describe("updateTargetRole — auth & validation", () => {
  it("retorna UNAUTHORIZED quando sessao ausente (anti IDOR)", async () => {
    auth.mockResolvedValue(null);
    const r = await updateTargetRole({ targetRole: "Product Manager" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("UNAUTHORIZED");
    expect(r.roleChanged).toBe(false);
    // Nao toca prisma sem auth.
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it("retorna INVALID_INPUT quando targetRole > 80 chars", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const longRole = "a".repeat(81);
    const r = await updateTargetRole({ targetRole: longRole });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("INVALID_INPUT");
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it("retorna INVALID_INPUT quando campo extra (anti mass-assignment)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await updateTargetRole({
      targetRole: "Backend",
      // strict() do Zod rejeita.
      userId: "outro-user",
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("INVALID_INPUT");
  });

  it("retorna PERSIST_FAILED quando prisma.upsert falha", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend" });
    prisma.profile.upsert.mockRejectedValue(new Error("db down"));
    const r = await updateTargetRole({ targetRole: "Frontend" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("PERSIST_FAILED");
  });
});

describe("updateTargetRole — roleChanged detection (P0.3 do PO audit)", () => {
  it("roleChanged=true quando role muda — caso do fundador", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend Engineer" });
    prisma.profile.upsert.mockResolvedValue({});
    const r = await updateTargetRole({ targetRole: "Product Manager" });
    expect(r.ok).toBe(true);
    expect(r.roleChanged).toBe(true);
    expect(r.oldRole).toBe("Backend Engineer");
    expect(r.newRole).toBe("Product Manager");
  });

  it("roleChanged=false quando user salva mesmo valor (so nome/email mudou)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend Engineer" });
    prisma.profile.upsert.mockResolvedValue({});
    const r = await updateTargetRole({ targetRole: "Backend Engineer" });
    expect(r.ok).toBe(true);
    expect(r.roleChanged).toBe(false);
  });

  it("roleChanged=false quando difere so em whitespace/caixa (normaliza)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend Engineer" });
    prisma.profile.upsert.mockResolvedValue({});
    const r = await updateTargetRole({ targetRole: "  backend engineer  " });
    expect(r.ok).toBe(true);
    // normalize: trim + lowercase compara identicos
    expect(r.roleChanged).toBe(false);
  });

  it("roleChanged=true quando oldRole=null e newRole preenchido (primeira vez)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: null });
    prisma.profile.upsert.mockResolvedValue({});
    const r = await updateTargetRole({ targetRole: "Data Scientist" });
    expect(r.ok).toBe(true);
    expect(r.roleChanged).toBe(true);
    expect(r.oldRole).toBeNull();
    expect(r.newRole).toBe("Data Scientist");
  });

  it("roleChanged=true quando limpa role (newRole vazio + oldRole tinha valor)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend" });
    prisma.profile.upsert.mockResolvedValue({});
    const r = await updateTargetRole({ targetRole: "" });
    expect(r.ok).toBe(true);
    expect(r.roleChanged).toBe(true);
    expect(r.newRole).toBeNull();
  });

  it("roleChanged=false quando oldRole=null e newRole vazio (sem mudanca)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: null });
    prisma.profile.upsert.mockResolvedValue({});
    const r = await updateTargetRole({ targetRole: "" });
    expect(r.ok).toBe(true);
    expect(r.roleChanged).toBe(false);
  });
});

describe("updateTargetRole — side effects", () => {
  it("audit log PROFILE_UPDATED com meta sanitizado (sem revelar cargo)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend" });
    prisma.profile.upsert.mockResolvedValue({});
    await updateTargetRole({ targetRole: "Product Manager" });
    expect(audit).toHaveBeenCalledTimes(1);
    const call = audit.mock.calls[0][0];
    expect(call.action).toBe("PROFILE_UPDATED");
    expect(call.userId).toBe("u1");
    expect(call.target).toBe("Profile:u1");
    expect(call.meta).toEqual({ field: "targetRole", cleared: false });
    // Sem o valor do cargo no meta — LGPD.
    expect(JSON.stringify(call.meta)).not.toContain("Product Manager");
  });

  it("audit meta.cleared=true quando user limpa o cargo", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: "Backend" });
    prisma.profile.upsert.mockResolvedValue({});
    await updateTargetRole({ targetRole: "" });
    const call = audit.mock.calls[0][0];
    expect(call.meta.cleared).toBe(true);
  });

  it("prisma.upsert usa userId da sessao (anti IDOR redundante)", async () => {
    auth.mockResolvedValue({ user: { id: "u-real" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: null });
    prisma.profile.upsert.mockResolvedValue({});
    await updateTargetRole({ targetRole: "Eng" });
    expect(prisma.profile.upsert).toHaveBeenCalledWith({
      where: { userId: "u-real" },
      update: { targetRole: "Eng" },
      create: { userId: "u-real", targetRole: "Eng" },
    });
  });

  it("revalidatePath('/conta') chamado em sucesso", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({ targetRole: null });
    prisma.profile.upsert.mockResolvedValue({});
    await updateTargetRole({ targetRole: "Eng" });
    expect(revalidatePath).toHaveBeenCalledWith("/conta");
  });
});
