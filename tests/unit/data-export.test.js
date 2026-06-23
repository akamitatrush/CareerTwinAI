import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma para testar a logica de export/erase sem hit no banco.
vi.mock("@/lib/db", () => {
  const mock = {
    user: { findUnique: vi.fn(), delete: vi.fn() },
    profile: { findUnique: vi.fn() },
    scoreSnapshot: { findMany: vi.fn() },
    consent: { findMany: vi.fn() },
    dataSource: { findMany: vi.fn() },
    tailoredCv: { findMany: vi.fn() },
    assessmentResult: { findMany: vi.fn() },
    evidence: { findMany: vi.fn() },
    subscription: { findUnique: vi.fn() },
    usageMeter: { findMany: vi.fn() },
    billingEvent: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: mock };
});

// Mock do audit pra nao depender de import circular nem hit no DB.
vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { exportUserData, eraseUserData } from "@/lib/data-export";

describe("exportUserData", () => {
  beforeEach(() => {
    Object.values(prisma).forEach((m) =>
      Object.values(m).forEach((fn) => fn.mockReset && fn.mockReset())
    );
  });

  it("escopa todas as queries por userId", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" });
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.scoreSnapshot.findMany.mockResolvedValue([]);
    prisma.consent.findMany.mockResolvedValue([]);
    prisma.dataSource.findMany.mockResolvedValue([]);
    prisma.tailoredCv.findMany.mockResolvedValue([]);
    prisma.assessmentResult.findMany.mockResolvedValue([]);
    prisma.evidence.findMany.mockResolvedValue([]);
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.usageMeter.findMany.mockResolvedValue([]);
    prisma.billingEvent.findMany.mockResolvedValue([]);

    const data = await exportUserData("u1");

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } })
    );
    expect(prisma.profile.findUnique).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.scoreSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.consent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.dataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.tailoredCv.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.assessmentResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.usageMeter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.billingEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );

    expect(data.user.id).toBe("u1");
    expect(data.version).toBe("2");
    expect(typeof data.exportedAt).toBe("string");
    expect(Array.isArray(data.assessments)).toBe(true);
    expect(Array.isArray(data.evidence)).toBe(true);
    expect(Array.isArray(data.usageMeters)).toBe(true);
    expect(Array.isArray(data.billingEvents)).toBe(true);
  });

  it("sanitiza billingEvents (sem payload completo)", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" });
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.scoreSnapshot.findMany.mockResolvedValue([]);
    prisma.consent.findMany.mockResolvedValue([]);
    prisma.dataSource.findMany.mockResolvedValue([]);
    prisma.tailoredCv.findMany.mockResolvedValue([]);
    prisma.assessmentResult.findMany.mockResolvedValue([]);
    prisma.evidence.findMany.mockResolvedValue([]);
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.usageMeter.findMany.mockResolvedValue([]);
    prisma.billingEvent.findMany.mockResolvedValue([
      {
        stripeEventId: "evt_123",
        type: "checkout.session.completed",
        processedAt: new Date("2026-06-22"),
      },
    ]);
    const data = await exportUserData("u1");
    expect(data.billingEvents).toHaveLength(1);
    expect(data.billingEvents[0]).toHaveProperty("stripeEventId");
    expect(data.billingEvents[0]).toHaveProperty("type");
    expect(data.billingEvents[0]).not.toHaveProperty("payload");
  });

  it("recusa userId vazio", async () => {
    await expect(exportUserData(null)).rejects.toThrow(/userId required/);
    await expect(exportUserData("")).rejects.toThrow(/userId required/);
  });
});

describe("eraseUserData", () => {
  beforeEach(() => {
    prisma.user.delete.mockReset();
    audit.mockClear();
  });

  it("delega para prisma.user.delete escopado pelo id", async () => {
    prisma.user.delete.mockResolvedValue({ id: "u1" });
    await eraseUserData("u1");
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("registra audit ACCOUNT_DELETED antes do delete", async () => {
    prisma.user.delete.mockResolvedValue({ id: "u1" });
    await eraseUserData("u1");
    expect(audit).toHaveBeenCalledTimes(1);
    const call = audit.mock.calls[0][0];
    expect(call.userId).toBe("u1");
    expect(call.action).toBe("ACCOUNT_DELETED");
    expect(call.target).toBe("User:u1");
  });

  it("propaga actorIp para audit quando passado", async () => {
    prisma.user.delete.mockResolvedValue({ id: "u1" });
    await eraseUserData("u1", { actorIp: "1.2.3.4" });
    const call = audit.mock.calls[0][0];
    expect(call.actorIp).toBe("1.2.3.4");
  });

  it("recusa userId vazio", async () => {
    await expect(eraseUserData(null)).rejects.toThrow(/userId required/);
  });
});
