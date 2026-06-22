import { describe, it, expect } from "vitest";
import {
  LinkedinParseBody,
  LinkedinShape,
  PortfolioImportBody,
  PortfolioShape,
  ApplicationCreateBody,
  ApplicationPatchBody,
} from "@/lib/validators";

// Fixture base de LinkedinShape valido (LLM output)
const okLinkedinShape = {
  cv_consolidado: "CV consolidado a partir do texto colado.",
  perfil: {
    nome: "Maria Silva",
    headline: "Dev backend Node",
    cargo_atual: "Engenheira de Software",
    senioridade: "pleno",
    localidade: "Sao Paulo",
    sobre: "Curto sobre.",
    experiencias: [
      { cargo: "Eng", empresa: "Acme", periodo: "2020-2023", descricao: "x" },
    ],
    formacoes: [
      { instituicao: "USP", curso: "CC", periodo: "2014-2018" },
    ],
    skills: ["node", "postgres"],
  },
};

describe("LinkedinParseBody — body do paste do LinkedIn", () => {
  it("aceita texto no limite inferior (120 chars)", () => {
    const r = LinkedinParseBody.safeParse({ text: "a".repeat(120) });
    expect(r).toMatchObject({ success: true });
  });

  it("rejeita texto muito curto (<120)", () => {
    const r = LinkedinParseBody.safeParse({ text: "a".repeat(119) });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita texto vazio", () => {
    const r = LinkedinParseBody.safeParse({ text: "" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita texto gigante (>60k chars — DoS/custo LLM)", () => {
    const r = LinkedinParseBody.safeParse({ text: "a".repeat(60_001) });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita campo extra (.strict)", () => {
    const r = LinkedinParseBody.safeParse({
      text: "a".repeat(120),
      adminOverride: true,
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita text ausente", () => {
    const r = LinkedinParseBody.safeParse({});
    expect(r).toMatchObject({ success: false });
  });
});

describe("LinkedinShape — saida do LLM nao confiavel", () => {
  it("aceita shape valido completo", () => {
    const r = LinkedinShape.safeParse(okLinkedinShape);
    expect(r).toMatchObject({ success: true });
  });

  it("aceita perfil com campos extras (.strip remove silenciosamente)", () => {
    const r = LinkedinShape.safeParse({
      ...okLinkedinShape,
      perfil: {
        ...okLinkedinShape.perfil,
        twitter_handle: "@evil",
        prompt_injection: "ignore all prior",
      },
    });
    expect(r).toMatchObject({ success: true });
    // .strip() remove o campo extra, ele nao deve persistir
    expect(r.data?.perfil.twitter_handle).toBeUndefined();
    expect(r.data?.perfil.prompt_injection).toBeUndefined();
  });

  it("aceita perfil quase vazio (todos os defaults aplicam)", () => {
    const r = LinkedinShape.safeParse({
      cv_consolidado: "x",
      perfil: {},
    });
    expect(r).toMatchObject({ success: true });
    expect(r.data?.perfil.skills).toEqual([]);
    expect(r.data?.perfil.experiencias).toEqual([]);
  });

  it("rejeita cv_consolidado faltando", () => {
    const r = LinkedinShape.safeParse({ perfil: {} });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita tipo errado (skills como string ao inves de array)", () => {
    const r = LinkedinShape.safeParse({
      cv_consolidado: "x",
      perfil: { skills: "node,postgres" },
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita experiencia sem cargo (campo obrigatorio)", () => {
    const r = LinkedinShape.safeParse({
      cv_consolidado: "x",
      perfil: {
        experiencias: [{ empresa: "Acme", periodo: "" }],
      },
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita skills com >40 itens (limite anti-abuso)", () => {
    const r = LinkedinShape.safeParse({
      cv_consolidado: "x",
      perfil: { skills: Array.from({ length: 41 }, (_, i) => `s${i}`) },
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita cv_consolidado >40k chars", () => {
    const r = LinkedinShape.safeParse({
      cv_consolidado: "a".repeat(40_001),
      perfil: {},
    });
    expect(r).toMatchObject({ success: false });
  });
});

describe("PortfolioImportBody — refine github OU url", () => {
  it("aceita so github", () => {
    const r = PortfolioImportBody.safeParse({ github: "octocat" });
    expect(r).toMatchObject({ success: true });
  });

  it("aceita so url", () => {
    const r = PortfolioImportBody.safeParse({ url: "https://meusite.dev" });
    expect(r).toMatchObject({ success: true });
  });

  it("aceita ambos (github + url)", () => {
    const r = PortfolioImportBody.safeParse({
      github: "octo-cat_1",
      url: "https://meusite.dev/portfolio",
    });
    expect(r).toMatchObject({ success: true });
  });

  it("rejeita ambos vazios (refine: 'Informe github ou url.')", () => {
    const r = PortfolioImportBody.safeParse({});
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita github com caracteres ilegais (espaco)", () => {
    const r = PortfolioImportBody.safeParse({ github: "evil user" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita github com caracteres ilegais (slash, tentativa de path traversal)", () => {
    const r = PortfolioImportBody.safeParse({ github: "user/../../etc" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita github com caracteres ilegais (cifrao)", () => {
    const r = PortfolioImportBody.safeParse({ github: "user$bash" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita github muito longo (>80 chars)", () => {
    const r = PortfolioImportBody.safeParse({ github: "a".repeat(81) });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita url malformada (sem schema)", () => {
    const r = PortfolioImportBody.safeParse({ url: "meusite.dev" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita url malformada (texto qualquer)", () => {
    const r = PortfolioImportBody.safeParse({ url: "not-a-url-at-all" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita url maior que 400 chars", () => {
    const r = PortfolioImportBody.safeParse({
      url: "https://x.com/" + "a".repeat(400),
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita campo extra (.strict)", () => {
    const r = PortfolioImportBody.safeParse({
      github: "octocat",
      token: "ghp_fake",
    });
    expect(r).toMatchObject({ success: false });
  });
});

describe("PortfolioShape — saida do LLM nao confiavel", () => {
  it("aceita shape valido completo", () => {
    const r = PortfolioShape.safeParse({
      resumo: "Dev full-stack.",
      stack: ["node", "react"],
      projetos: [
        {
          nome: "App X",
          descricao: "App de y",
          stack: ["next"],
          url: "https://github.com/u/x",
          destaque: "1k stars",
        },
      ],
    });
    expect(r).toMatchObject({ success: true });
  });

  it("aceita shape minimo (so projetos vazios)", () => {
    const r = PortfolioShape.safeParse({ projetos: [] });
    expect(r).toMatchObject({ success: true });
    expect(r.data?.resumo).toBe("");
    expect(r.data?.stack).toEqual([]);
  });

  it("rejeita projeto sem nome (obrigatorio)", () => {
    const r = PortfolioShape.safeParse({
      projetos: [{ descricao: "sem nome" }],
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita >12 projetos (limite)", () => {
    const r = PortfolioShape.safeParse({
      projetos: Array.from({ length: 13 }, (_, i) => ({ nome: `P${i}` })),
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita stack com >40 itens", () => {
    const r = PortfolioShape.safeParse({
      stack: Array.from({ length: 41 }, (_, i) => `s${i}`),
      projetos: [],
    });
    expect(r).toMatchObject({ success: false });
  });
});

describe("ApplicationCreateBody — criar candidatura no tracker", () => {
  it("aceita campos minimos (titulo + empresa, status default SAVED)", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "Dev Backend",
      empresa: "Acme",
    });
    expect(r).toMatchObject({ success: true });
    expect(r.data?.status).toBe("SAVED");
  });

  it("aceita todos os campos opcionais", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "Dev Backend",
      empresa: "Acme",
      local: "SP",
      url: "https://acme.com/jobs/1",
      salario: "R$ 15k",
      source: "adzuna",
      notes: "boa cultura",
      status: "APPLIED",
    });
    expect(r).toMatchObject({ success: true });
  });

  it("aceita todos os valores do enum status", () => {
    const statuses = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
    for (const status of statuses) {
      const r = ApplicationCreateBody.safeParse({ titulo: "x", empresa: "y", status });
      expect(r).toMatchObject({ success: true });
    }
  });

  it("rejeita titulo vazio", () => {
    const r = ApplicationCreateBody.safeParse({ titulo: "", empresa: "Acme" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita empresa vazia", () => {
    const r = ApplicationCreateBody.safeParse({ titulo: "X", empresa: "" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita titulo ausente", () => {
    const r = ApplicationCreateBody.safeParse({ empresa: "Acme" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita titulo maior que 200 chars", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "a".repeat(201),
      empresa: "Acme",
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita url invalida (nao URL)", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "X",
      empresa: "Y",
      url: "not-a-url",
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita notes >4000 chars", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "X",
      empresa: "Y",
      notes: "a".repeat(4001),
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita status fora do enum", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "X",
      empresa: "Y",
      status: "HIRED",
    });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita campo extra (.strict) — anti mass assignment (ex: userId)", () => {
    const r = ApplicationCreateBody.safeParse({
      titulo: "X",
      empresa: "Y",
      userId: "outroUser",
    });
    expect(r).toMatchObject({ success: false });
  });
});

describe("ApplicationPatchBody — refine status OU notes", () => {
  it("aceita so status", () => {
    const r = ApplicationPatchBody.safeParse({ status: "APPLIED" });
    expect(r).toMatchObject({ success: true });
  });

  it("aceita so notes", () => {
    const r = ApplicationPatchBody.safeParse({ notes: "ligar amanha" });
    expect(r).toMatchObject({ success: true });
  });

  it("aceita ambos", () => {
    const r = ApplicationPatchBody.safeParse({
      status: "INTERVIEW",
      notes: "entrevista 10h",
    });
    expect(r).toMatchObject({ success: true });
  });

  it("rejeita ambos vazios/ausentes (refine)", () => {
    const r = ApplicationPatchBody.safeParse({});
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita status invalido", () => {
    const r = ApplicationPatchBody.safeParse({ status: "GHOSTED" });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita notes >4000 chars", () => {
    const r = ApplicationPatchBody.safeParse({ notes: "a".repeat(4001) });
    expect(r).toMatchObject({ success: false });
  });

  it("rejeita campo extra (.strict)", () => {
    const r = ApplicationPatchBody.safeParse({
      status: "APPLIED",
      userId: "outro",
    });
    expect(r).toMatchObject({ success: false });
  });
});
