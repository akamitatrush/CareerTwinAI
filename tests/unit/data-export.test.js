import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma para testar a logica de export/erase sem hit no banco.
vi.mock("@/lib/db", () => {
  const mock = {
    user: { findUnique: vi.fn(), delete: vi.fn() },
    profile: { findUnique: vi.fn() },
    scoreSnapshot: { findMany: vi.fn() },
    consent: { findMany: vi.fn() },
    dataSource: { findMany: vi.fn() },
  };
  return { prisma: mock };
});

import { prisma } from "@/lib/db";
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

    expect(data.user.id).toBe("u1");
    expect(data.version).toBe("1");
    expect(typeof data.exportedAt).toBe("string");
  });

  it("recusa userId vazio", async () => {
    await expect(exportUserData(null)).rejects.toThrow(/userId required/);
    await expect(exportUserData("")).rejects.toThrow(/userId required/);
  });
});

describe("eraseUserData", () => {
  beforeEach(() => prisma.user.delete.mockReset());

  it("delega para prisma.user.delete escopado pelo id", async () => {
    prisma.user.delete.mockResolvedValue({ id: "u1" });
    await eraseUserData("u1");
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("recusa userId vazio", async () => {
    await expect(eraseUserData(null)).rejects.toThrow(/userId required/);
  });
});
