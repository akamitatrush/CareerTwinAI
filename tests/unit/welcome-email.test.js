// Testes do template + sendWelcomeEmail.
//
// Template: pure functions (sem mocks). sendWelcomeEmail: mockamos
// prisma (findUnique/update) e fetch (Resend). Mesmo padrao de
// email-digest.test.js.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock prisma ANTES do import — vi.mock e elevado.
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { buildWelcomeEmail } from "@/lib/email/welcome-template";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { prisma } from "@/lib/db";

describe("buildWelcomeEmail — template", () => {
  it("retorna subject + html + text", () => {
    const r = buildWelcomeEmail({
      nome: "Maria Silva",
      dashboardUrl: "https://app.careertwin.ai/dashboard",
    });
    expect(r.subject).toBe("Bem-vindo ao CareerTwin AI");
    expect(typeof r.html).toBe("string");
    expect(typeof r.text).toBe("string");
    expect(r.html.length).toBeGreaterThan(200);
    expect(r.text.length).toBeGreaterThan(50);
  });

  it("HTML tem o CTA apontando pro dashboardUrl correto", () => {
    const url = "https://app.careertwin.ai/dashboard";
    const r = buildWelcomeEmail({ nome: "Ana", dashboardUrl: url });
    expect(r.html).toContain(url);
    expect(r.html).toMatch(/Acessar meu dashboard/i);
  });

  it("usa so o primeiro nome no greet (anti-PII no email)", () => {
    const r = buildWelcomeEmail({
      nome: "Maria Silva Santos",
      dashboardUrl: "https://app.careertwin.ai/dashboard",
    });
    expect(r.html).toContain("Maria");
    expect(r.html).not.toContain("Silva Santos");
    expect(r.text).toContain("Olá, Maria!");
  });

  it("usa 'Olá!' generico quando nome ausente", () => {
    const r = buildWelcomeEmail({
      nome: null,
      dashboardUrl: "https://app.careertwin.ai/dashboard",
    });
    expect(r.html).toContain("Olá!");
    expect(r.text).toContain("Olá!");
    // Nao vaza ", undefined" ou "null"
    expect(r.html).not.toContain("undefined");
    expect(r.html).not.toContain("null!");
  });

  it("plain text espelha conteudo principal do HTML", () => {
    const r = buildWelcomeEmail({
      nome: "Ana",
      dashboardUrl: "https://app.careertwin.ai/dashboard",
    });
    expect(r.text).toContain("Career Health Score");
    expect(r.text).toContain("gaps");
    expect(r.text).toContain("Vagas reais");
    expect(r.text).toContain("https://app.careertwin.ai/dashboard");
    expect(r.text).toContain("Sergio Hasher");
  });

  it("escapa HTML em nome (anti-XSS via PII manipulada)", () => {
    const r = buildWelcomeEmail({
      nome: "<script>alert(1)</script>",
      dashboardUrl: "https://app.careertwin.ai/dashboard",
    });
    expect(r.html).not.toContain("<script>alert(1)</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("rejeita URL javascript: e cai pro fallback", () => {
    const r = buildWelcomeEmail({
      nome: "Ana",
      dashboardUrl: "javascript:alert(1)",
    });
    expect(r.html).not.toContain("javascript:alert");
    // CTA cai pro "/" (fallback no template)
    expect(r.html).toMatch(/href=["']\//);
  });
});

describe("sendWelcomeEmail — idempotencia + fail-safe", () => {
  let fetchSpy;
  const oldEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_RESEND_KEY = "re_test_key";
    process.env.EMAIL_FROM = "welcome@careertwin.test";
    process.env.AUTH_URL = "https://app.careertwin.test";
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_xyz" }),
      text: async () => "",
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...oldEnv };
  });

  it("no-op se welcomeEmailSentAt ja foi setado (skipped=already-sent)", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "ana@test.com",
      name: "Ana",
      welcomeEmailSentAt: new Date("2026-01-01"),
      profile: { nome: "Ana" },
    });

    const r = await sendWelcomeEmail("u1");
    expect(r).toEqual({ ok: true, skipped: "already-sent" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("no-op se AUTH_RESEND_KEY ausente (skipped=no-provider, nao throw)", async () => {
    delete process.env.AUTH_RESEND_KEY;
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "ana@test.com",
      name: "Ana",
      welcomeEmailSentAt: null,
      profile: null,
    });

    const r = await sendWelcomeEmail("u1");
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("no-provider");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("envia via Resend e seta welcomeEmailSentAt em sucesso", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "ana@test.com",
      name: "Ana Silva",
      welcomeEmailSentAt: null,
      profile: { nome: "Ana Silva" },
    });
    prisma.user.update.mockResolvedValueOnce({});

    const r = await sendWelcomeEmail("u1");
    expect(r).toEqual({ ok: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.headers.authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(opts.body);
    expect(body.from).toBe("welcome@careertwin.test");
    expect(body.to).toEqual(["ana@test.com"]);
    expect(body.subject).toBe("Bem-vindo ao CareerTwin AI");
    expect(body.html).toContain("Ana");
    expect(body.html).toContain("https://app.careertwin.test/dashboard");
    expect(body.text).toContain("Olá, Ana!");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { welcomeEmailSentAt: expect.any(Date) },
    });
  });

  it("fail-safe: Resend falha 422 -> retorna ok=false sem throw", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "bad@test.com",
      name: "X",
      welcomeEmailSentAt: null,
      profile: null,
    });
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "invalid recipient",
      json: async () => ({}),
    });

    // NUNCA pode throw — o signup nao depende disso.
    const r = await sendWelcomeEmail("u1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("send-failed");
    // welcomeEmailSentAt NAO foi setado em falha — proxima tentativa retry.
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("no-op se user nao encontrado", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const r = await sendWelcomeEmail("u-fantasma");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("user-nao-encontrado");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-op se user sem email (conta OAuth incompleta)", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: null,
      name: "X",
      welcomeEmailSentAt: null,
      profile: null,
    });
    const r = await sendWelcomeEmail("u1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("user-sem-email");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita userId invalido sem hit no banco", async () => {
    const r = await sendWelcomeEmail("");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("userId-invalido");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("preferencia profile.nome > user.name pra greet", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "ana@test.com",
      name: "Ana User",
      welcomeEmailSentAt: null,
      profile: { nome: "Mariana Profile" },
    });
    prisma.user.update.mockResolvedValueOnce({});

    await sendWelcomeEmail("u1");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.html).toContain("Mariana");
    expect(body.html).not.toContain("Ana User");
  });
});
