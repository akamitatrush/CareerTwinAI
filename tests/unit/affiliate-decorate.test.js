// Tests do hook de afiliado: decorateUrl + getAffiliateConfig.
//
// Cobertura:
//  - decorateUrl sem provider conhecido -> URL crua
//  - decorateUrl com provider conhecido mas env nao setada -> URL crua
//  - decorateUrl com provider + env setada -> adiciona param correto
//  - decorateUrl preserva params existentes
//  - decorateUrl nao sobrescreve param de afiliado se ja existir
//  - URL malformada -> retorna como veio
//  - URL vazia/null -> retorna como veio
//  - getAffiliateConfig retorna null pra provider desconhecido
//  - getAffiliateConfig retorna {param, id} quando env presente
//
// Importante: cada teste manipula process.env e restaura no afterEach pra
// nao vazar estado entre cases.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decorateUrl } from "@/lib/knowledge/course-retrieval";
import {
  getAffiliateConfig,
  AFFILIATE_PROVIDERS,
} from "@/lib/knowledge/affiliate-config";

// Lista das envs que esses tests podem mexer. Backup/restore garantia.
const ENV_KEYS = Object.values(AFFILIATE_PROVIDERS).map((p) => p.env);

describe("getAffiliateConfig", () => {
  const original = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("retorna null pra provider desconhecido", () => {
    expect(getAffiliateConfig("ProviderInexistenteXYZ")).toBeNull();
    expect(getAffiliateConfig("freeCodeCamp")).toBeNull();
  });

  it("retorna null pra provider null/undefined/vazio", () => {
    expect(getAffiliateConfig(null)).toBeNull();
    expect(getAffiliateConfig(undefined)).toBeNull();
    expect(getAffiliateConfig("")).toBeNull();
  });

  it("retorna null pra provider mapeado mas env nao setada", () => {
    // Tera esta no mapa mas TERA_AFFILIATE_ID nao foi setada -> null.
    expect(getAffiliateConfig("Tera")).toBeNull();
    expect(getAffiliateConfig("Alura")).toBeNull();
  });

  it("retorna { param, id } quando env presente (Tera)", () => {
    process.env.TERA_AFFILIATE_ID = "careertwin";
    expect(getAffiliateConfig("Tera")).toEqual({
      param: "ref",
      id: "careertwin",
    });
  });

  it("retorna { param, id } com param customizado (Udemy -> referralCode)", () => {
    process.env.UDEMY_AFFILIATE_ID = "abc123";
    expect(getAffiliateConfig("Udemy")).toEqual({
      param: "referralCode",
      id: "abc123",
    });
  });

  it("retorna { param, id } com param Coursera (irclickid)", () => {
    process.env.COURSERA_AFFILIATE_ID = "impact_123";
    expect(getAffiliateConfig("Coursera")).toEqual({
      param: "irclickid",
      id: "impact_123",
    });
  });

  it("matching de provider eh case-sensitive (Hashtag Treinamentos com espaco)", () => {
    process.env.HASHTAG_AFFILIATE_ID = "ht-id";
    expect(getAffiliateConfig("Hashtag Treinamentos")).toEqual({
      param: "ref",
      id: "ht-id",
    });
    // Variantes nao batem -- catalogo usa o nome exato.
    expect(getAffiliateConfig("hashtag treinamentos")).toBeNull();
    expect(getAffiliateConfig("Hashtag")).toBeNull();
  });
});

describe("decorateUrl", () => {
  const original = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("retorna URL crua sem provider (backward-compat com callers antigos)", () => {
    expect(decorateUrl("https://example.com/curso")).toBe(
      "https://example.com/curso",
    );
    expect(decorateUrl("https://example.com/curso", {})).toBe(
      "https://example.com/curso",
    );
  });

  it("retorna URL crua pra provider desconhecido", () => {
    expect(
      decorateUrl("https://example.com/curso", { provider: "freeCodeCamp" }),
    ).toBe("https://example.com/curso");
  });

  it("retorna URL crua pra provider mapeado mas env nao setada", () => {
    // Tera mapeado, sem TERA_AFFILIATE_ID -> URL crua (fail-safe).
    expect(
      decorateUrl("https://somostera.com/curso", { provider: "Tera" }),
    ).toBe("https://somostera.com/curso");
  });

  it("adiciona param correto quando provider + env setados (Tera)", () => {
    process.env.TERA_AFFILIATE_ID = "careertwin";
    const out = decorateUrl("https://somostera.com/curso", { provider: "Tera" });
    expect(out).toContain("ref=careertwin");
  });

  it("usa param customizado por provider (Udemy referralCode)", () => {
    process.env.UDEMY_AFFILIATE_ID = "myid";
    const out = decorateUrl("https://udemy.com/course/python", {
      provider: "Udemy",
    });
    expect(out).toContain("referralCode=myid");
    // Nao deve usar "ref" pra Udemy.
    expect(out).not.toContain("ref=myid");
  });

  it("preserva query params existentes ao adicionar afiliado", () => {
    process.env.ALURA_AFFILIATE_ID = "myid";
    const out = decorateUrl(
      "https://alura.com.br/curso?utm_source=campanha&track=1",
      { provider: "Alura" },
    );
    expect(out).toContain("utm_source=campanha");
    expect(out).toContain("track=1");
    expect(out).toContain("ref=myid");
  });

  it("nao sobrescreve param de afiliado existente na URL", () => {
    process.env.TERA_AFFILIATE_ID = "careertwin";
    // URL ja vem com ?ref=interno (campanha do proprio provider). Defesa.
    const out = decorateUrl("https://somostera.com/curso?ref=interno", {
      provider: "Tera",
    });
    expect(out).toContain("ref=interno");
    expect(out).not.toContain("ref=careertwin");
  });

  it("URL malformada retorna como veio (nao quebra)", () => {
    process.env.TERA_AFFILIATE_ID = "careertwin";
    expect(decorateUrl("not-a-url", { provider: "Tera" })).toBe("not-a-url");
    expect(decorateUrl("ht!tp://broken", { provider: "Tera" })).toBe(
      "ht!tp://broken",
    );
  });

  it("URL vazia/null/undefined retorna como veio", () => {
    expect(decorateUrl(null)).toBeNull();
    expect(decorateUrl(undefined)).toBeUndefined();
    expect(decorateUrl("")).toBe("");
    expect(decorateUrl(123)).toBe(123); // nao-string passa direto
  });

  it("decora multiplos providers diferentes corretamente em sequencia", () => {
    process.env.TERA_AFFILIATE_ID = "tera-id";
    process.env.DIO_AFFILIATE_ID = "dio-id";
    process.env.PM3_AFFILIATE_ID = "pm3-id";

    expect(decorateUrl("https://somostera.com/x", { provider: "Tera" })).toContain(
      "ref=tera-id",
    );
    expect(decorateUrl("https://dio.me/x", { provider: "DIO" })).toContain(
      "ref=dio-id",
    );
    expect(decorateUrl("https://pm3.com.br/x", { provider: "PM3" })).toContain(
      "ref=pm3-id",
    );
  });

  it("Coursera usa irclickid (param do Impact, nao 'ref')", () => {
    process.env.COURSERA_AFFILIATE_ID = "click123";
    const out = decorateUrl("https://coursera.org/learn/python", {
      provider: "Coursera",
    });
    expect(out).toContain("irclickid=click123");
    expect(out).not.toContain("ref=click123");
  });
});
