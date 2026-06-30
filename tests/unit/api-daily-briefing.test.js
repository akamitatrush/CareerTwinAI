// Cron daily-briefing — testa auth, eligibility, debounce, audit, fallback LLM.
//
// Stubamos prisma, completeJSON (LLM), searchJobs, sendBriefingEmail, notify e
// audit. Importamos GET/POST do route handler e chamamos com Request mock.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockUserFindMany = vi.fn();
const mockUserUpdate = vi.fn();
const mockCompleteJSON = vi.fn();
const mockSearchJobs = vi.fn();
const mockSendBriefingEmail = vi.fn();
const mockNotify = vi.fn();
const mockAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: (...args) => mockUserFindMany(...args),
      update: (...args) => mockUserUpdate(...args),
    },
  },
}));
vi.mock("@/lib/llm", () => ({
  completeJSON: (...args) => mockCompleteJSON(...args),
}));
vi.mock("@/lib/jobs", () => ({
  searchJobs: (...args) => mockSearchJobs(...args),
}));
vi.mock("@/lib/email", () => ({
  sendBriefingEmail: (...args) => mockSendBriefingEmail(...args),
}));
vi.mock("@/lib/notifications", () => ({
  notify: (...args) => mockNotify(...args),
  NotificationTemplates: {
    dailyBriefing: ({ subject, summary }) => ({
      kind: "DAILY_BRIEFING",
      title: subject,
      body: summary,
      link: "/dashboard",
    }),
  },
}));
vi.mock("@/lib/audit", () => ({
  audit: (...args) => mockAudit(...args),
}));

function makeReq(secret) {
  return new Request("https://x.test/api/cron/daily-briefing", {
    method: "GET",
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

function makeUser(overrides = {}) {
  return {
    id: "u1",
    email: "u1@t.com",
    name: "Sergio Lopes",
    profile: {
      targetRole: "Product Manager de IA",
      nome: "Sergio",
      skills: ["python", "llm"],
    },
    snapshots: [
      {
        overall: 72,
        role: "Product Manager de IA",
        createdAt: new Date("2026-06-20"),
        gaps: [{ habilidade: "Public Speaking", impactoPontos: 5 }],
      },
    ],
    ...overrides,
  };
}

describe("cron daily-briefing", () => {
  let GET;
  const ORIGINAL_RESEND = process.env.AUTH_RESEND_KEY;
  const ORIGINAL_EMAIL_FROM = process.env.EMAIL_FROM;

  beforeEach(async () => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret-1234567890abcd";
    // Pra default permitir envio nos testes (cron faz no-op sem provider).
    process.env.AUTH_RESEND_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@test.com";

    mockUserFindMany.mockReset();
    mockUserUpdate.mockReset();
    mockCompleteJSON.mockReset();
    mockSearchJobs.mockReset();
    mockSendBriefingEmail.mockReset();
    mockNotify.mockReset();
    mockAudit.mockReset();

    mockUserUpdate.mockResolvedValue({});
    mockSendBriefingEmail.mockResolvedValue({ id: "sent" });
    mockNotify.mockResolvedValue({ id: "n_1" });
    mockAudit.mockResolvedValue(undefined);

    const mod = await import("@/app/api/cron/daily-briefing/route.js");
    GET = mod.GET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    if (ORIGINAL_RESEND !== undefined) process.env.AUTH_RESEND_KEY = ORIGINAL_RESEND;
    else delete process.env.AUTH_RESEND_KEY;
    if (ORIGINAL_EMAIL_FROM !== undefined) process.env.EMAIL_FROM = ORIGINAL_EMAIL_FROM;
    else delete process.env.EMAIL_FROM;
  });

  // ---------- AUTH ----------

  it("500 CRON_NOT_CONFIGURED quando CRON_SECRET ausente", async () => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
    const mod = await import("@/app/api/cron/daily-briefing/route.js");
    const r = await mod.GET(makeReq("qualquer-coisa"));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.code).toBe("CRON_NOT_CONFIGURED");
  });

  it("403 quando header x-cron-secret invalido", async () => {
    mockUserFindMany.mockResolvedValue([]);
    const r = await GET(makeReq("wrong-secret-xxxxxxxxxxxxxxx"));
    expect(r.status).toBe(403);
    const data = await r.json();
    expect(data.code).toBe("FORBIDDEN");
  });

  it("403 quando header ausente", async () => {
    mockUserFindMany.mockResolvedValue([]);
    const r = await GET(makeReq(null));
    expect(r.status).toBe(403);
  });

  it("403 quando secret tem length diferente (anti timing leak)", async () => {
    mockUserFindMany.mockResolvedValue([]);
    const r = await GET(makeReq("short"));
    expect(r.status).toBe(403);
  });

  // ---------- ELIGIBILITY (filtros na query) ----------

  it("filtro: digestEnabled, email!=null, debounce 18h e profile vivo (rawCv+targetRole+!redacted)", async () => {
    mockUserFindMany.mockResolvedValue([]);
    await GET(makeReq("test-secret-1234567890abcd"));
    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
    const args = mockUserFindMany.mock.calls[0][0];
    expect(args.where.digestEnabled).toBe(true);
    expect(args.where.email).toEqual({ not: null });
    expect(Array.isArray(args.where.OR)).toBe(true);
    // debounce: lastDailyBriefingAt null OU < cutoff (18h atras)
    expect(args.where.OR[0]).toEqual({ lastDailyBriefingAt: null });
    expect(args.where.OR[1].lastDailyBriefingAt.lt).toBeInstanceOf(Date);
    // cutoff deve estar perto de 18h atras (com folga generosa pra clock drift do test runner)
    const cutoff = args.where.OR[1].lastDailyBriefingAt.lt;
    const expectedCutoff = Date.now() - 18 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(60_000);
    // profile vivo
    expect(args.where.profile.is.targetRole).toEqual({ not: null });
    expect(args.where.profile.is.rawCv).toEqual({ not: null });
    expect(args.where.profile.is.rawCvRedactedAt).toBeNull();
    // cota Resend
    expect(args.take).toBe(50);
  });

  // ---------- HAPPY PATH ----------

  it("envia briefing pra user eligible, atualiza lastDailyBriefingAt e audita", async () => {
    mockUserFindMany.mockResolvedValue([makeUser()]);
    mockSearchJobs.mockResolvedValue({
      jobs: [
        { titulo: "PM de IA", empresa: "Acme", source: "adzuna" },
        { titulo: "Senior PM AI", empresa: "Beta", source: "adzuna" },
      ],
    });
    mockCompleteJSON.mockResolvedValue({
      subject: "Sergio, foco em public speaking",
      text: "Bom dia Sergio. Score 72/100. Vaga: PM de IA @ Acme.",
    });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(0);

    // sendBriefingEmail recebeu subject + text + firstName extraido
    expect(mockSendBriefingEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendBriefingEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe("u1@t.com");
    expect(emailArgs.subject).toContain("Sergio");
    expect(emailArgs.firstName).toBe("Sergio");

    // lastDailyBriefingAt atualizado APOS envio
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    const updArgs = mockUserUpdate.mock.calls[0][0];
    expect(updArgs.where.id).toBe("u1");
    expect(updArgs.data.lastDailyBriefingAt).toBeInstanceOf(Date);

    // audit DAILY_BRIEFING_SENT com meta sanitizado (sem PII raw)
    expect(mockAudit).toHaveBeenCalledTimes(1);
    const auditArgs = mockAudit.mock.calls[0][0];
    expect(auditArgs.action).toBe("DAILY_BRIEFING_SENT");
    expect(auditArgs.userId).toBe("u1");
    expect(auditArgs.target).toBe("User:u1");
    expect(auditArgs.meta).toEqual({
      jobsIncluded: 2,
      score: 72,
      hasGap: true,
    });
    // garante que NAO logamos email/CV/conteudo bruto
    expect(JSON.stringify(auditArgs.meta)).not.toMatch(/u1@t\.com|public speaking/i);

    // notification in-app criada
    expect(mockNotify).toHaveBeenCalledTimes(1);
    const notifyArgs = mockNotify.mock.calls[0][0];
    expect(notifyArgs.kind).toBe("DAILY_BRIEFING");
    expect(notifyArgs.userId).toBe("u1");
  });

  // ---------- DEDUP DE searchJobs POR ROLE ----------

  it("deduplica searchJobs por role unico (3 users, 1 role => 1 chamada)", async () => {
    mockUserFindMany.mockResolvedValue([
      makeUser({ id: "u1", email: "u1@t.com" }),
      makeUser({ id: "u2", email: "u2@t.com" }),
      makeUser({ id: "u3", email: "u3@t.com" }),
    ]);
    mockSearchJobs.mockResolvedValue({
      jobs: [{ titulo: "T", empresa: "E" }],
    });
    mockCompleteJSON.mockResolvedValue({
      subject: "Briefing",
      text: "Texto de briefing.",
    });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(data.uniqueRoles).toBe(1);
    expect(mockSearchJobs).toHaveBeenCalledTimes(1);
    expect(data.sent).toBe(3);
  });

  // ---------- FALLBACK LLM ----------

  it("usa fallback deterministico quando LLM lanca", async () => {
    mockUserFindMany.mockResolvedValue([makeUser()]);
    mockSearchJobs.mockResolvedValue({
      jobs: [{ titulo: "PM de IA", empresa: "Acme" }],
    });
    mockCompleteJSON.mockRejectedValue(new Error("LLM timeout"));

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(0);

    // Mesmo com LLM falhando, sendBriefingEmail roda (fallback gera subject/text)
    expect(mockSendBriefingEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendBriefingEmail.mock.calls[0][0];
    expect(emailArgs.subject).toBeTruthy();
    expect(emailArgs.summary).toContain("Bom dia");
    expect(emailArgs.summary).toContain("72/100"); // score do snapshot
  });

  it("fallback inclui referencia a vaga em destaque quando ha jobs", async () => {
    mockUserFindMany.mockResolvedValue([makeUser()]);
    mockSearchJobs.mockResolvedValue({
      jobs: [{ titulo: "Head of AI", empresa: "Zeta Corp" }],
    });
    mockCompleteJSON.mockRejectedValue(new Error("fail"));

    await GET(makeReq("test-secret-1234567890abcd"));
    const emailArgs = mockSendBriefingEmail.mock.calls[0][0];
    expect(emailArgs.summary).toMatch(/Head of AI/);
    expect(emailArgs.summary).toMatch(/Zeta Corp/);
  });

  // ---------- ERROS INDIVIDUAIS ----------

  it("falha em 1 user nao derruba os outros (continua loop)", async () => {
    mockUserFindMany.mockResolvedValue([
      makeUser({ id: "u1", email: "u1@t.com" }),
      makeUser({ id: "u2", email: "u2@t.com" }),
      makeUser({ id: "u3", email: "u3@t.com" }),
    ]);
    mockSearchJobs.mockResolvedValue({ jobs: [{ titulo: "T", empresa: "E" }] });
    mockCompleteJSON.mockResolvedValue({ subject: "s", text: "t" });
    // Falha somente no segundo
    mockSendBriefingEmail
      .mockResolvedValueOnce({ id: "1" })
      .mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce({ id: "3" });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(1);
    expect(data.errors[0].err).toMatch(/transport down/);
    // userId truncado no erro (8 chars) — anti leak
    expect(data.errors[0].userId.length).toBeLessThanOrEqual(8);
  });

  it("user com erro NAO recebe update de lastDailyBriefingAt nem audit", async () => {
    mockUserFindMany.mockResolvedValue([makeUser()]);
    mockSearchJobs.mockResolvedValue({ jobs: [] });
    mockCompleteJSON.mockResolvedValue({ subject: "s", text: "t" });
    mockSendBriefingEmail.mockRejectedValue(new Error("smtp"));

    await GET(makeReq("test-secret-1234567890abcd"));
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  // ---------- FILTRA FIXTURES (Gimli H1 — 2026-06-30) ----------

  it("nao envia email quando todas as vagas sao fixtures (source==='fixtures')", async () => {
    mockUserFindMany.mockResolvedValue([makeUser()]);
    mockSearchJobs.mockResolvedValue({
      jobs: [
        { titulo: "PM Fic", empresa: "Norte Tech", source: "fixtures" },
        { titulo: "PM Mock", empresa: "Sul Corp", source: "fixtures" },
      ],
    });
    mockCompleteJSON.mockResolvedValue({ subject: "s", text: "t" });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.sent).toBe(0);
    // Sem envio, sem update de debounce (proxima execucao tenta de novo).
    expect(mockSendBriefingEmail).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("em pool misto (reais + fixtures) so reais entram no topJobs do LLM", async () => {
    mockUserFindMany.mockResolvedValue([makeUser()]);
    mockSearchJobs.mockResolvedValue({
      jobs: [
        { titulo: "PM Real", empresa: "Acme", source: "adzuna" },
        { titulo: "PM Mock", empresa: "Norte Tech", source: "fixtures" },
        { titulo: "PM Real 2", empresa: "Beta", source: "jooble" },
        { titulo: "PM Mock 2", empresa: "Sul Corp", source: "fixtures" },
      ],
    });
    mockCompleteJSON.mockResolvedValue({
      subject: "Briefing",
      text: "Texto.",
    });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(data.sent).toBe(1);

    // LLM prompt deve referir apenas vagas reais — checa via texto do user prompt.
    const llmCall = mockCompleteJSON.mock.calls[0][0];
    const userPrompt = llmCall?.user || "";
    expect(userPrompt).toMatch(/PM Real/);
    expect(userPrompt).toMatch(/PM Real 2/);
    expect(userPrompt).not.toMatch(/Norte Tech/);
    expect(userPrompt).not.toMatch(/Sul Corp/);
  });

  // ---------- NO-OP SEM PROVIDER ----------

  it("no-op quando nenhum provider de email configurado", async () => {
    delete process.env.AUTH_RESEND_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_SERVER;
    mockUserFindMany.mockResolvedValue([makeUser()]);

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.sent).toBe(0);
    expect(data.reason).toMatch(/email/i);
    expect(mockSendBriefingEmail).not.toHaveBeenCalled();
  });

  // ---------- COTA RESEND ----------

  it("respeita cota Resend (take=50 na query)", async () => {
    mockUserFindMany.mockResolvedValue([]);
    await GET(makeReq("test-secret-1234567890abcd"));
    const args = mockUserFindMany.mock.calls[0][0];
    expect(args.take).toBe(50);
  });
});
