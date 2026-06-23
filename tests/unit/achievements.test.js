// Unit tests do lib/achievements — grantAchievement idempotente + integracao
// com notify. Sem hit em DB real (mock do prisma).
//
// Cobertura:
//  - grantAchievement happy path cria Achievement + dispara notify
//  - grantAchievement com (userId, kind) ja existente retorna alreadyEarned
//    (via P2002 do prisma)
//  - grantAchievement valida userId/kind (allow-list ACHIEVEMENTS_META)
//  - getUserAchievements escopa por userId
//  - getUserPoints soma corretamente
//  - ACHIEVEMENTS_META exporta os 17 kinds esperados

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const create = vi.fn();
  const findMany = vi.fn();
  return {
    prisma: {
      achievement: {
        create: (args) => create(args),
        findMany: (args) => findMany(args),
      },
      __achievement: { create, findMany },
      notification: {
        create: vi.fn(async () => ({ id: "n_test" })),
      },
    },
  };
});

import {
  grantAchievement,
  getUserAchievements,
  getUserPoints,
  ACHIEVEMENTS_META,
  ACHIEVEMENT_KINDS,
  MAX_POINTS,
} from "@/lib/achievements";
import { prisma } from "@/lib/db";

beforeEach(() => {
  prisma.__achievement.create.mockReset();
  prisma.__achievement.findMany.mockReset();
  prisma.notification.create.mockClear();
});

describe("ACHIEVEMENTS_META", () => {
  it("expoe exatamente 17 kinds (alinhado com schema)", () => {
    expect(ACHIEVEMENT_KINDS.length).toBe(17);
  });

  it("cada kind tem title, desc, icon, points", () => {
    for (const kind of ACHIEVEMENT_KINDS) {
      const m = ACHIEVEMENTS_META[kind];
      expect(m).toBeDefined();
      expect(typeof m.title).toBe("string");
      expect(typeof m.desc).toBe("string");
      expect(typeof m.icon).toBe("string");
      expect(typeof m.points).toBe("number");
      expect(m.points).toBeGreaterThan(0);
    }
  });

  it("MAX_POINTS bate com a soma dos meta.points", () => {
    const sum = Object.values(ACHIEVEMENTS_META).reduce(
      (s, m) => s + m.points,
      0,
    );
    expect(MAX_POINTS).toBe(sum);
    expect(MAX_POINTS).toBeGreaterThan(0);
  });
});

describe("grantAchievement — validation", () => {
  it("retorna { granted: false } sem chamar prisma quando userId vazio", async () => {
    const r = await grantAchievement("", "FIRST_DIAGNOSIS");
    expect(r).toEqual({ granted: false });
    expect(prisma.__achievement.create).not.toHaveBeenCalled();
  });

  it("retorna { granted: false } quando kind desconhecido", async () => {
    const r = await grantAchievement("u1", "HAX0R_UNKNOWN_KIND");
    expect(r).toEqual({ granted: false });
    expect(prisma.__achievement.create).not.toHaveBeenCalled();
  });

  it("retorna { granted: false } quando userId nao-string", async () => {
    const r = await grantAchievement(123, "FIRST_DIAGNOSIS");
    expect(r).toEqual({ granted: false });
    expect(prisma.__achievement.create).not.toHaveBeenCalled();
  });
});

describe("grantAchievement — happy path", () => {
  it("cria achievement e dispara notify", async () => {
    prisma.__achievement.create.mockResolvedValue({
      id: "a1",
      userId: "u1",
      kind: "FIRST_DIAGNOSIS",
      earnedAt: new Date(),
      meta: null,
    });
    const r = await grantAchievement("u1", "FIRST_DIAGNOSIS");
    expect(r.granted).toBe(true);
    expect(r.achievement.id).toBe("a1");
    // Confirma userId + kind passados pra prisma.create
    const args = prisma.__achievement.create.mock.calls[0][0];
    expect(args.data.userId).toBe("u1");
    expect(args.data.kind).toBe("FIRST_DIAGNOSIS");
    // Notify foi disparada (via lib/notifications -> prisma.notification.create)
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const notifArgs = prisma.notification.create.mock.calls[0][0];
    expect(notifArgs.data.kind).toBe("ACHIEVEMENT_UNLOCKED");
    // Title contem icone + nome
    expect(notifArgs.data.title).toContain(ACHIEVEMENTS_META.FIRST_DIAGNOSIS.icon);
    expect(notifArgs.data.title).toContain(ACHIEVEMENTS_META.FIRST_DIAGNOSIS.title);
  });

  it("passa meta sanitizado pro prisma quando objeto plano", async () => {
    prisma.__achievement.create.mockResolvedValue({
      id: "a2",
      userId: "u1",
      kind: "SCORE_70",
    });
    await grantAchievement("u1", "SCORE_70", { overall: 75, snapshotId: "s1" });
    const args = prisma.__achievement.create.mock.calls[0][0];
    expect(args.data.meta).toEqual({ overall: 75, snapshotId: "s1" });
  });

  it("normaliza meta=null quando nao-objeto (array, primitive)", async () => {
    prisma.__achievement.create.mockResolvedValue({ id: "a3" });
    await grantAchievement("u1", "FIRST_TAILOR", [1, 2, 3]);
    const args = prisma.__achievement.create.mock.calls[0][0];
    expect(args.data.meta).toBeNull();
  });
});

describe("grantAchievement — idempotencia (P2002)", () => {
  it("retorna alreadyEarned:true em P2002 sem nova notify", async () => {
    const err = new Error("unique violation");
    err.code = "P2002";
    prisma.__achievement.create.mockRejectedValue(err);
    const r = await grantAchievement("u1", "FIRST_DIAGNOSIS");
    expect(r).toEqual({ granted: false, alreadyEarned: true });
    // CRUCIAL: notify NAO eh disparada quando alreadyEarned (sem dupla notif)
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("retorna error em outro erro do prisma (nao P2002)", async () => {
    prisma.__achievement.create.mockRejectedValue(new Error("DB pool"));
    const r = await grantAchievement("u1", "FIRST_DIAGNOSIS");
    expect(r.granted).toBe(false);
    expect(r.alreadyEarned).toBeUndefined();
    expect(r.error).toBeDefined();
  });
});

describe("getUserAchievements", () => {
  it("retorna [] quando userId vazio (sem hit no DB)", async () => {
    const r = await getUserAchievements("");
    expect(r).toEqual([]);
    expect(prisma.__achievement.findMany).not.toHaveBeenCalled();
  });

  it("delega pro prisma com where + orderBy", async () => {
    prisma.__achievement.findMany.mockResolvedValue([
      { id: "a1", kind: "FIRST_DIAGNOSIS", earnedAt: new Date() },
    ]);
    const r = await getUserAchievements("u1");
    expect(r.length).toBe(1);
    const args = prisma.__achievement.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "u1" });
    expect(args.orderBy).toEqual({ earnedAt: "desc" });
  });

  it("retorna [] silenciosamente em erro do DB", async () => {
    prisma.__achievement.findMany.mockRejectedValue(new Error("DB down"));
    const r = await getUserAchievements("u1");
    expect(r).toEqual([]);
  });
});

describe("getUserPoints", () => {
  it("soma pontos das conquistas do user", async () => {
    prisma.__achievement.findMany.mockResolvedValue([
      { kind: "FIRST_DIAGNOSIS" },  // 10
      { kind: "FIRST_GAP_COMPLETED" }, // 5
      { kind: "SCORE_70" }, // 25
    ]);
    const p = await getUserPoints("u1");
    expect(p).toBe(10 + 5 + 25);
  });

  it("ignora kinds desconhecidos (defensivo contra schema drift)", async () => {
    prisma.__achievement.findMany.mockResolvedValue([
      { kind: "FIRST_DIAGNOSIS" }, // 10
      { kind: "GHOST_KIND_NOT_IN_META" }, // 0 (ignorado)
    ]);
    const p = await getUserPoints("u1");
    expect(p).toBe(10);
  });

  it("retorna 0 quando user sem conquistas", async () => {
    prisma.__achievement.findMany.mockResolvedValue([]);
    const p = await getUserPoints("u1");
    expect(p).toBe(0);
  });
});
