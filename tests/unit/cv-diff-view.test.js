// Testes do CvDiffView. Como o setup do projeto NAO inclui JSDOM/RTL
// (vitest env = "node"), nao renderizamos o componente: validamos a forma
// (source structure + contratos chave) seguindo o mesmo padrao do
// copilot-widget.test.js.
//
// Cobertura logica:
//  1. Side-by-side e modo default.
//  2. Toggle pra "unified" presente.
//  3. Stats summary renderiza adicionadas/removidas/alteradas/% mudou.
//  4. Linhas com cor verde-ish (insert) e vermelho-ish (delete).
//  5. aria-pressed no toggle (a11y).
//  6. CSS inline com cores distintas (sem depender de globals.css novo).
//  7. Integracao com lib/text-diff.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const VIEW_PATH = path.join(ROOT, "app/(app)/cvs-adaptados/CvDiffView.js");
const PAGE_PATH = path.join(ROOT, "app/(app)/cvs-adaptados/[id]/page.js");
const LIST_PATH = path.join(ROOT, "app/(app)/cvs-adaptados/page.js");

function readSource(p) {
  return readFileSync(p, "utf8");
}

describe("CvDiffView — source structure", () => {
  it("arquivo do componente existe", () => {
    expect(existsSync(VIEW_PATH)).toBe(true);
  });

  it("eh client component (use client header)", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/^["']use client["']/);
  });

  it("usa side-by-side como modo default", () => {
    const src = readSource(VIEW_PATH);
    // useState inicial deve ser "side" (lado-a-lado padrao)
    expect(src).toMatch(/useState\(["']side["']\)/);
  });

  it("tem toggle pra unified mode", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/setMode\(["']unified["']\)/);
    expect(src).toMatch(/setMode\(["']side["']\)/);
  });

  it("renderiza stats summary com adicionadas/removidas/alteradas/% mudou", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/Adicionadas/i);
    expect(src).toMatch(/Removidas/i);
    expect(src).toMatch(/Alteradas/i);
    expect(src).toMatch(/mudou|mudança/i);
  });

  it("usa cores diferenciadas: verde-ish pra insert, vermelho-ish pra delete, amarelo pra changed", () => {
    const src = readSource(VIEW_PATH);
    // Cores aplicadas via inline styles ou helpers.
    // rgba(34,197,94,...) = verde (Tailwind green-500), rgba(239,68,68,...) = vermelho
    expect(src).toMatch(/34\s*,\s*197\s*,\s*94/);
    expect(src).toMatch(/239\s*,\s*68\s*,\s*68/);
    expect(src).toMatch(/234\s*,\s*179\s*,\s*8/); // amarelo (yellow-500)
  });

  it("toggle button usa aria-pressed (a11y)", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/aria-pressed=\{mode\s*===\s*["']side["']\}/);
    expect(src).toMatch(/aria-pressed=\{mode\s*===\s*["']unified["']\}/);
  });

  it("usa prefixo +/- /~  por linha (acessibilidade pra daltonicos)", () => {
    const src = readSource(VIEW_PATH);
    // Os simbolos sao usados como discriminator alem da cor.
    expect(src).toMatch(/["']\+["']/);
    expect(src).toMatch(/["']-["']/);
    expect(src).toMatch(/["']~["']/);
  });

  it("integra com lib/text-diff (diffLines + alignSideBySide + lineStats)", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/from\s+["']@\/lib\/text-diff["']/);
    expect(src).toMatch(/diffLines/);
    expect(src).toMatch(/alignSideBySide/);
    expect(src).toMatch(/lineStats/);
  });

  it("memoiza calculo de diff (perf) com useMemo", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/useMemo/);
  });

  it("tem region aria-label semantico no container", () => {
    const src = readSource(VIEW_PATH);
    expect(src).toMatch(/aria-label=["'].*[Cc]omparac/);
  });

  it("acepta props original e tailored", () => {
    const src = readSource(VIEW_PATH);
    // Defaults vazios evitam crash com TailoredCv que tem campo null
    expect(src).toMatch(/original\s*=\s*["']{2}/);
    expect(src).toMatch(/tailored\s*=\s*["']{2}/);
  });
});

describe("/cvs-adaptados/[id] — detail page", () => {
  it("arquivo da detail page existe", () => {
    expect(existsSync(PAGE_PATH)).toBe(true);
  });

  it("eh server component dynamic=force-dynamic", () => {
    const src = readSource(PAGE_PATH);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("verifica auth e redireciona quando nao logado", () => {
    const src = readSource(PAGE_PATH);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/redirect\(["']\/entrar["']\)/);
  });

  it("IDOR-safe: redirect quando id de outro user (nao expoe 403)", () => {
    const src = readSource(PAGE_PATH);
    // Padrao: findUnique + check de userId, redirect pra lista
    expect(src).toMatch(/cv\.userId\s*!==\s*session\.user\.id/);
    expect(src).toMatch(/redirect\(["']\/cvs-adaptados["']\)/);
  });

  it("usa CvDiffView passando original e tailored", () => {
    const src = readSource(PAGE_PATH);
    expect(src).toMatch(/<CvDiffView\s+original=\{original\}\s+tailored=\{tailored\}/);
  });

  it("eyebrow e title do header batem com spec", () => {
    const src = readSource(PAGE_PATH);
    expect(src).toMatch(/CV ADAPTADO · DIFF/);
    expect(src).toMatch(/Comparação antes \/ depois/);
  });

  it("usa ct-page-header e ct-kpi-strip (design system existente)", () => {
    const src = readSource(PAGE_PATH);
    expect(src).toMatch(/ct-page-header/);
    expect(src).toMatch(/ct-kpi-strip/);
  });

  it("link Voltar aponta pra /cvs-adaptados", () => {
    const src = readSource(PAGE_PATH);
    expect(src).toMatch(/href=["']\/cvs-adaptados["']/);
  });
});

describe("/cvs-adaptados — list page modificacao minimal", () => {
  it("adicionou Link 'Ver diff' apontando pra /cvs-adaptados/{id}", () => {
    const src = readSource(LIST_PATH);
    expect(src).toMatch(/href=\{`\/cvs-adaptados\/\$\{cv\.id\}`\}/);
    expect(src).toMatch(/Ver diff/);
  });

  it("manteve CvDetailClient (nao quebrou modal existente)", () => {
    const src = readSource(LIST_PATH);
    expect(src).toMatch(/<CvDetailClient\s+cvId=\{cv\.id\}/);
  });
});
