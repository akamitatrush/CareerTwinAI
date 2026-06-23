import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, _internal } from "@/lib/logger";

describe("logger.sanitize — redaction de PII", () => {
  const { sanitize } = _internal;

  it("redacta chaves PII no nivel raiz", () => {
    const out = sanitize({ email: "foo@bar.com", name: "Foo" });
    expect(out.email).toBe("[REDACTED]");
    expect(out.name).toBe("Foo");
  });

  it("redacta chaves PII em case-insensitive", () => {
    const out = sanitize({ Email: "x@y.com", EMAIL: "z@w.com", PHONE: "+55..." });
    expect(out.Email).toBe("[REDACTED]");
    expect(out.EMAIL).toBe("[REDACTED]");
    expect(out.PHONE).toBe("[REDACTED]");
  });

  it("mantem chaves nao-PII intactas", () => {
    const out = sanitize({ userId: "abc", route: "/x", count: 42, ok: true });
    expect(out.userId).toBe("abc");
    expect(out.route).toBe("/x");
    expect(out.count).toBe(42);
    expect(out.ok).toBe(true);
  });

  it("redacta PII em objetos aninhados", () => {
    const out = sanitize({
      user: { id: "1", email: "a@b.com", profile: { phone: "+55", role: "dev" } },
      meta: { ok: true },
    });
    expect(out.user.id).toBe("1");
    expect(out.user.email).toBe("[REDACTED]");
    expect(out.user.profile.phone).toBe("[REDACTED]");
    expect(out.user.profile.role).toBe("dev");
    expect(out.meta.ok).toBe(true);
  });

  it("redacta PII dentro de arrays", () => {
    const out = sanitize([{ email: "a@b.com" }, { name: "x" }]);
    expect(out[0].email).toBe("[REDACTED]");
    expect(out[1].name).toBe("x");
  });

  it("trunca strings muito longas pra evitar log gigante", () => {
    const big = "a".repeat(5000);
    const out = sanitize({ note: big });
    expect(out.note.length).toBeLessThan(2100);
    expect(out.note.endsWith("...[truncated]")).toBe(true);
  });

  it("limita profundidade de recursao", () => {
    let nested = { v: 1 };
    let cur = nested;
    for (let i = 0; i < 10; i++) {
      cur.next = { v: i };
      cur = cur.next;
    }
    const out = sanitize(nested);
    // Em algum nivel deve aparecer "[...]"
    function findEllipsis(obj, depth = 0) {
      if (depth > 10) return false;
      if (obj === "[...]") return true;
      if (obj && typeof obj === "object") {
        return Object.values(obj).some((v) => findEllipsis(v, depth + 1));
      }
      return false;
    }
    expect(findEllipsis(out)).toBe(true);
  });

  it("redacta token, password, cv, authorization", () => {
    const out = sanitize({
      token: "abc",
      password: "p",
      cv: "long text",
      authorization: "Bearer x",
      cookie: "sid=...",
    });
    expect(out.token).toBe("[REDACTED]");
    expect(out.password).toBe("[REDACTED]");
    expect(out.cv).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.cookie).toBe("[REDACTED]");
  });
});

describe("logger.emit — formato JSON-line", () => {
  let logSpy, errSpy, warnSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("emite linha JSON valida com campos esperados", () => {
    logger.info("test.route", "ola", { extra: 1 });
    expect(logSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe("info");
    expect(parsed.route).toBe("test.route");
    expect(parsed.msg).toBe("ola");
    expect(parsed.extra).toBe(1);
    expect(typeof parsed.ts).toBe("string");
  });

  it("usa console.error pra level=error", () => {
    logger.error("x", "boom");
    expect(errSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("usa console.warn pra level=warn", () => {
    logger.warn("x", "alerta");
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("redacta PII em meta no output emitido", () => {
    logger.info("x", "msg", { email: "a@b.com", id: "1" });
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.email).toBe("[REDACTED]");
    expect(parsed.id).toBe("1");
  });

  it("nao quebra com meta undefined/null", () => {
    expect(() => logger.info("x", "msg")).not.toThrow();
    expect(() => logger.info("x", "msg", null)).not.toThrow();
  });
});
