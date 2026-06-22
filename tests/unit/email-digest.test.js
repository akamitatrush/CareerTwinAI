import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { __test__, sendDigestEmail } from "@/lib/email";

const { digestHtml, escapeHtml } = __test__;

describe("escapeHtml — anti-XSS basico em email", () => {
  it("escapa &, <, >, aspas", () => {
    expect(escapeHtml(`<b>"'&</b>`)).toBe("&lt;b&gt;&quot;&#39;&amp;&lt;/b&gt;");
  });

  it("retorna string vazia para null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("coage numero pra string", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("digestHtml — geracao do email", () => {
  const baseVaga = {
    titulo: "Dev Backend Node",
    empresa: "Acme Inc",
    local: "Sao Paulo",
    source: "adzuna",
    match: 87,
    url: "https://acme.com/jobs/1",
  };

  it("contem nome (primeiro nome) quando passado", () => {
    const html = digestHtml({ nome: "Maria Silva", role: "Backend", vagas: [baseVaga] });
    expect(html).toContain("Oi, Maria");
    // Nao deve vazar o sobrenome no greet
    expect(html.match(/Oi, Maria,/)).toBeTruthy();
  });

  it("usa 'Oi' generico quando nome ausente", () => {
    const html = digestHtml({ nome: null, role: "Backend", vagas: [baseVaga] });
    expect(html).toContain("Oi,");
    expect(html).not.toContain("Oi, ,");
  });

  it("inclui o role no corpo do email", () => {
    const html = digestHtml({ nome: "Ana", role: "Engenheira de Dados", vagas: [baseVaga] });
    expect(html).toContain("Engenheira de Dados");
  });

  it("renderiza cada vaga (titulo + empresa)", () => {
    const vagas = [
      { ...baseVaga, titulo: "Vaga A", empresa: "Empresa Alpha" },
      { ...baseVaga, titulo: "Vaga B", empresa: "Empresa Beta" },
      { ...baseVaga, titulo: "Vaga C", empresa: "Empresa Gamma" },
    ];
    const html = digestHtml({ nome: "X", role: "Y", vagas });
    expect(html).toContain("Vaga A");
    expect(html).toContain("Empresa Alpha");
    expect(html).toContain("Vaga B");
    expect(html).toContain("Empresa Beta");
    expect(html).toContain("Vaga C");
    expect(html).toContain("Empresa Gamma");
  });

  it("inclui URL da vaga quando presente", () => {
    const html = digestHtml({ nome: "X", role: "Y", vagas: [baseVaga] });
    expect(html).toContain("https://acme.com/jobs/1");
    expect(html).toContain("ver vaga");
  });

  it("omite link 'ver vaga' quando url ausente", () => {
    const html = digestHtml({
      nome: "X",
      role: "Y",
      vagas: [{ ...baseVaga, url: undefined }],
    });
    expect(html).not.toContain("ver vaga");
  });

  it("escapa HTML em nome (anti-XSS via prompt injection)", () => {
    const html = digestHtml({
      nome: "<script>alert(1)</script> Hacker",
      role: "X",
      vagas: [baseVaga],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapa HTML em titulo/empresa/local/source/url da vaga", () => {
    const html = digestHtml({
      nome: "Ana",
      role: "X",
      vagas: [
        {
          titulo: "<img src=x onerror=alert(1)>",
          empresa: "Acme & <b>Co</b>",
          local: "<svg/onload=1>",
          source: "src<script>",
          match: 50,
          url: 'https://x.com/"onmouseover="alert(1)',
        },
      ],
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<svg/onload");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("Acme &amp; &lt;b&gt;Co&lt;/b&gt;");
  });

  it("escapa role tambem (passa pelo LLM, nao confiavel)", () => {
    const html = digestHtml({
      nome: "Ana",
      role: "<b>Dev</b>",
      vagas: [baseVaga],
    });
    expect(html).not.toContain("<b>Dev</b>");
    expect(html).toContain("&lt;b&gt;Dev&lt;/b&gt;");
  });

  it("usa singular 'vaga nova' quando vagas.length === 1", () => {
    const html = digestHtml({ nome: "X", role: "Y", vagas: [baseVaga] });
    expect(html).toContain("1 vaga nova");
    expect(html).not.toContain("1 vagas novas");
  });

  it("usa plural 'vagas novas' quando vagas.length > 1", () => {
    const html = digestHtml({
      nome: "X",
      role: "Y",
      vagas: [baseVaga, baseVaga, baseVaga],
    });
    expect(html).toContain("3 vagas novas");
    expect(html).not.toContain("3 vaga nova");
  });
});

describe("sendDigestEmail — Resend payload via fetch", () => {
  let fetchSpy;
  const oldEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    process.env.EMAIL_FROM = "digest@careertwin.test";
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_123" }),
      text: async () => "",
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...oldEnv };
  });

  it("envia para Resend com subject singular pra 1 vaga", async () => {
    await sendDigestEmail({
      to: "user@test.com",
      nome: "Ana",
      role: "Backend",
      vagas: [
        { titulo: "T", empresa: "E", local: "L", source: "s", match: 80, url: "https://x" },
      ],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.method).toBe("POST");
    expect(opts.headers.authorization).toBe("Bearer re_test_key");
    const payload = JSON.parse(opts.body);
    expect(payload.from).toBe("digest@careertwin.test");
    expect(payload.to).toEqual(["user@test.com"]);
    expect(payload.subject).toBe("1 vaga nova de Backend");
    expect(payload.html).toContain("Ana");
    expect(payload.html).toContain("Backend");
  });

  it("envia subject plural pra N>1 vagas", async () => {
    await sendDigestEmail({
      to: "user@test.com",
      nome: "Ana",
      role: "Dados",
      vagas: [
        { titulo: "A", empresa: "X", match: 80 },
        { titulo: "B", empresa: "Y", match: 70 },
      ],
    });

    const payload = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(payload.subject).toBe("2 vagas novas de Dados");
  });

  it("lanca erro se Resend devolve nao-2xx", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({}),
      text: async () => "invalid recipient",
    });

    await expect(
      sendDigestEmail({
        to: "bad@test.com",
        nome: "X",
        role: "Y",
        vagas: [{ titulo: "T", empresa: "E", match: 50 }],
      })
    ).rejects.toThrow(/Resend 422/);
  });

  it("lanca erro quando nenhum provider configurado", async () => {
    delete process.env.AUTH_RESEND_KEY;
    delete process.env.EMAIL_SERVER;
    await expect(
      sendDigestEmail({
        to: "x@test.com",
        nome: "X",
        role: "Y",
        vagas: [{ titulo: "T", empresa: "E", match: 50 }],
      })
    ).rejects.toThrow(/provider de email/i);
  });
});
