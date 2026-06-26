// Unit tests do helper de notificacoes — shape dos templates e validacoes
// defensivas do notify(). Sem chamadas de rede ou DB (mockamos prisma).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma client antes de importar o modulo. Os endpoints usam
// notify() — aqui testamos so o helper, o resto e coberto por inspecao
// visual do shape do payload.
vi.mock("@/lib/db", () => {
  const create = vi.fn();
  return {
    prisma: {
      notification: {
        create: (args) => create(args),
      },
      __create: create,
    },
  };
});

import { notify, NotificationTemplates } from "@/lib/notifications";
import { prisma } from "@/lib/db";

beforeEach(() => {
  prisma.__create.mockReset();
  prisma.__create.mockResolvedValue({ id: "n_test" });
});

describe("NotificationTemplates", () => {
  it("gapCompleted devolve shape esperado", () => {
    const t = NotificationTemplates.gapCompleted({
      habilidade: "Python",
      pts: 5,
      gapId: "g_1",
    });
    expect(t.kind).toBe("GAP_COMPLETED");
    expect(t.title).toContain("Python");
    expect(t.body).toContain("+5");
    expect(t.link).toBe("/dashboard");
    expect(t.meta).toEqual({ gapId: "g_1", pts: 5 });
  });

  it("gapCompleted usa fallback de 4pts quando ausente", () => {
    const t = NotificationTemplates.gapCompleted({ habilidade: "Docker" });
    expect(t.body).toContain("+4");
  });

  it("scoreUpdated com delta positivo formata sinal", () => {
    const t = NotificationTemplates.scoreUpdated({ overall: 72, delta: 3 });
    expect(t.kind).toBe("SCORE_UPDATED");
    expect(t.title).toContain("72");
    expect(t.body).toContain("+3");
  });

  it("scoreUpdated com delta negativo nao duplica sinal", () => {
    const t = NotificationTemplates.scoreUpdated({ overall: 65, delta: -4 });
    expect(t.body).toContain("-4");
    expect(t.body).not.toContain("+-");
  });

  it("scoreUpdated sem snapshot anterior (delta=null) tem body vazio", () => {
    const t = NotificationTemplates.scoreUpdated({ overall: 80, delta: null });
    expect(t.body).toBe("");
  });

  it("digestSent inclui contagem", () => {
    const t = NotificationTemplates.digestSent({ vagasCount: 7 });
    expect(t.kind).toBe("DIGEST_SENT");
    expect(t.title).toContain("7");
    expect(t.link).toBe("/oportunidades");
  });

  it("applicationStatus monta titulo e transicao", () => {
    const t = NotificationTemplates.applicationStatus({
      titulo: "Senior Eng",
      empresa: "Acme",
      fromStatus: "APPLIED",
      toStatus: "INTERVIEW",
    });
    expect(t.kind).toBe("APPLICATION_STATUS");
    expect(t.title).toContain("Senior Eng");
    expect(t.title).toContain("Acme");
    expect(t.body).toContain("APPLIED");
    expect(t.body).toContain("INTERVIEW");
    expect(t.link).toBe("/candidaturas");
  });

  it("applicationStatus omite parenteses se sem empresa", () => {
    const t = NotificationTemplates.applicationStatus({
      titulo: "Eng",
      empresa: null,
      fromStatus: "SAVED",
      toStatus: "APPLIED",
    });
    expect(t.title).toBe("Eng");
  });

  it("welcome tem shape minimo", () => {
    const t = NotificationTemplates.welcome();
    expect(t.kind).toBe("WELCOME");
    expect(t.title.length).toBeGreaterThan(0);
    expect(t.link).toBe("/dashboard");
  });

  it("dailyBriefing tem kind/title/body/link", () => {
    const t = NotificationTemplates.dailyBriefing({
      subject: "Sergio, 3 vagas novas hoje",
      summary: "Bom dia. Score 72. Vaga: PM de IA @ Acme.",
    });
    expect(t.kind).toBe("DAILY_BRIEFING");
    expect(t.title).toContain("Sergio");
    expect(t.body).toContain("PM de IA");
    expect(t.link).toBe("/dashboard");
  });
});

describe("notify()", () => {
  it("retorna null sem chamar prisma quando userId ausente", async () => {
    const r = await notify({ kind: "WELCOME", title: "oi" });
    expect(r).toBeNull();
    expect(prisma.__create).not.toHaveBeenCalled();
  });

  it("retorna null para kind invalido", async () => {
    const r = await notify({ userId: "u1", kind: "HAX0R", title: "x" });
    expect(r).toBeNull();
    expect(prisma.__create).not.toHaveBeenCalled();
  });

  it("retorna null se title vazio (apos trim)", async () => {
    const r = await notify({ userId: "u1", kind: "WELCOME", title: "   " });
    expect(r).toBeNull();
    expect(prisma.__create).not.toHaveBeenCalled();
  });

  it("clampa titulo gigante pra MAX_TITLE", async () => {
    await notify({
      userId: "u1",
      kind: "WELCOME",
      title: "a".repeat(500),
    });
    const args = prisma.__create.mock.calls[0][0];
    expect(args.data.title.length).toBeLessThanOrEqual(200);
  });

  it("normaliza body/link/meta vazios pra null", async () => {
    await notify({
      userId: "u1",
      kind: "WELCOME",
      title: "ola",
      body: "",
      link: "",
    });
    const args = prisma.__create.mock.calls[0][0];
    expect(args.data.body).toBeNull();
    expect(args.data.link).toBeNull();
    expect(args.data.meta).toBeNull();
  });

  it("falha silenciosa quando prisma.create lanca", async () => {
    prisma.__create.mockRejectedValueOnce(new Error("DB down"));
    const r = await notify({
      userId: "u1",
      kind: "WELCOME",
      title: "bem-vindo",
    });
    expect(r).toBeNull();
  });

  it("template + notify integram (gapCompleted ate insert)", async () => {
    const payload = NotificationTemplates.gapCompleted({
      habilidade: "SQL",
      pts: 6,
      gapId: "g_42",
    });
    await notify({ userId: "u1", ...payload });
    expect(prisma.__create).toHaveBeenCalledTimes(1);
    const args = prisma.__create.mock.calls[0][0];
    expect(args.data.userId).toBe("u1");
    expect(args.data.kind).toBe("GAP_COMPLETED");
    expect(args.data.meta).toEqual({ gapId: "g_42", pts: 6 });
  });
});
