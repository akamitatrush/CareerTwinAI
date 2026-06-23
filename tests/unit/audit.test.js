// Unit tests do helper de AuditLog (lib/audit.js).
//
// Foca em 3 garantias:
//  1. audit() persiste com shape esperado em prisma.auditLog.create.
//  2. Falha silenciosa: se prisma lanca, nao quebra request principal.
//  3. hashIp e deterministico pro mesmo salt+ip (LGPD: hash, nao raw).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const create = vi.fn();
  return {
    prisma: {
      auditLog: {
        create: (args) => create(args),
      },
      __create: create,
    },
  };
});

import { audit, _internal } from "@/lib/audit";
import { prisma } from "@/lib/db";

beforeEach(() => {
  prisma.__create.mockReset();
  prisma.__create.mockResolvedValue({ id: "al_test" });
  // Reset env entre testes pra nao vazar salt entre cases
  delete process.env.AUDIT_IP_SALT;
});

describe("audit()", () => {
  it("chama prisma.auditLog.create com payload correto", async () => {
    await audit({
      userId: "u1",
      action: "ACCOUNT_DELETED",
      target: "User:u1",
      meta: { reason: "user_request" },
    });
    expect(prisma.__create).toHaveBeenCalledTimes(1);
    const arg = prisma.__create.mock.calls[0][0];
    expect(arg.data.userId).toBe("u1");
    expect(arg.data.action).toBe("ACCOUNT_DELETED");
    expect(arg.data.target).toBe("User:u1");
    expect(arg.data.meta).toEqual({ reason: "user_request" });
    expect(arg.data.actorIp).toBeNull(); // sem req nem actorIp
  });

  it("hashIp converte IP raw em hash sha256 com salt", async () => {
    process.env.AUDIT_IP_SALT = "test-salt-xyz";
    await audit({
      userId: "u1",
      action: "LOGIN",
      actorIp: "1.2.3.4",
    });
    const arg = prisma.__create.mock.calls[0][0];
    expect(arg.data.actorIp).toBeTypeOf("string");
    expect(arg.data.actorIp.length).toBe(32); // truncado pra 32 hex chars
    // Hash determinitistico — segunda chamada com mesmo IP+salt = mesmo hash
    prisma.__create.mockClear();
    await audit({ userId: "u2", action: "LOGIN", actorIp: "1.2.3.4" });
    expect(prisma.__create.mock.calls[0][0].data.actorIp).toBe(arg.data.actorIp);
  });

  it("hashIp gera hashes diferentes pra IPs diferentes", async () => {
    process.env.AUDIT_IP_SALT = "test-salt-xyz";
    await audit({ userId: "u1", action: "LOGIN", actorIp: "1.2.3.4" });
    const h1 = prisma.__create.mock.calls[0][0].data.actorIp;
    prisma.__create.mockClear();
    await audit({ userId: "u1", action: "LOGIN", actorIp: "5.6.7.8" });
    const h2 = prisma.__create.mock.calls[0][0].data.actorIp;
    expect(h1).not.toBe(h2);
  });

  it("extrai IP do header x-forwarded-for via req", async () => {
    const req = {
      headers: {
        get: (h) => (h === "x-forwarded-for" ? "9.9.9.9, 10.10.10.10" : null),
      },
    };
    await audit({ userId: "u1", action: "LOGIN", req });
    const arg = prisma.__create.mock.calls[0][0];
    expect(arg.data.actorIp).toBeTypeOf("string");
    expect(arg.data.actorIp.length).toBe(32);
  });

  it("falha silenciosa: nao lanca se prisma.create lanca", async () => {
    prisma.__create.mockRejectedValue(new Error("db down"));
    // Nao deve lancar — request principal nao pode quebrar por audit log.
    await expect(
      audit({ userId: "u1", action: "LOGIN" })
    ).resolves.toBeUndefined();
  });

  it("recusa action vazio (log e retorna sem chamar create)", async () => {
    await audit({ userId: "u1" });
    expect(prisma.__create).not.toHaveBeenCalled();
  });

  it("aceita userId null (acoes de sistema/anon)", async () => {
    await audit({ action: "SECURITY_INVALID_WEBHOOK", meta: { reason: "test" } });
    const arg = prisma.__create.mock.calls[0][0];
    expect(arg.data.userId).toBeNull();
    expect(arg.data.action).toBe("SECURITY_INVALID_WEBHOOK");
  });

  it("aceita meta null sem quebrar", async () => {
    await audit({ userId: "u1", action: "LOGOUT" });
    const arg = prisma.__create.mock.calls[0][0];
    expect(arg.data.meta).toBeNull();
  });
});

describe("_internal.hashIp", () => {
  it("retorna null pra ip vazio", () => {
    expect(_internal.hashIp(null)).toBeNull();
    expect(_internal.hashIp("")).toBeNull();
  });

  it("usa salt default se AUDIT_IP_SALT ausente", () => {
    delete process.env.AUDIT_IP_SALT;
    const h = _internal.hashIp("1.2.3.4");
    expect(h).toBeTypeOf("string");
    expect(h.length).toBe(32);
  });
});
