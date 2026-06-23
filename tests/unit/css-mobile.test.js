// Smoke test pra garantir que o bloco de fixes mobile responsive
// (audit 2026-06-22) esta presente em globals.css. Nao testa render
// real — so confirma que as regras criticas (touch target, iOS no-zoom,
// modal max-height, kanban snap, AppShell mobile-header) existem.
//
// Por que CSS-string-match e nao snapshot/visual? Snapshots de CSS
// gigante (>5k linhas) sao fragil; visual tests precisam de browser.
// Aqui validamos *presenca* de regras-chave — barata e suficiente
// pra detectar regressao acidental.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const CSS_PATH = path.resolve(__dirname, "../../app/globals.css");
const css = readFileSync(CSS_PATH, "utf-8");

describe("CSS mobile responsive (audit 2026-06-22)", () => {
  it("tem bloco @media (max-width: 720px)", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
  });

  it("tem refinamento @media (max-width: 480px)", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)/);
  });

  it("inputs em mobile com font-size 16px (anti-zoom iOS)", () => {
    // Procura textarea + font-size: 16px no MESMO bloco @media
    // (regex multi-linha capturando o bloco 720px).
    expect(css).toMatch(/textarea[^{}]*\{[^}]*font-size:\s*16px/);
  });

  it("buttons primary com min-height em mobile", () => {
    // Procura grupo de seletores incluindo .btn-primary com min-height
    // (vem do bloco 720px novo: .btn, .btn-primary, .btn-ghost,
    // .btn-secondary { min-height: 44px })
    expect(css).toMatch(/\.btn-primary[\s\S]{0,200}min-height:\s*44px/);
  });

  it("theme-toggle com tamanho touch-friendly em mobile (44px)", () => {
    expect(css).toMatch(/\.theme-toggle\s*\{\s*width:\s*44px;\s*height:\s*44px/);
  });

  it("AppShell tem sidebar + mobile-header (estrutura responsiva)", () => {
    expect(css).toMatch(/\.appshell-sidebar/);
    expect(css).toMatch(/\.appshell-mobile-header/);
  });

  it("modal-overlay com padding reduzido em mobile", () => {
    expect(css).toMatch(/\.modal-overlay\s*\{\s*padding:\s*16px/);
  });

  it("modal com max-height pra nao estourar viewport mobile", () => {
    expect(css).toMatch(/\.modal[^,{}]*,[^{]*\.ct-refresh-modal[^,{}]*,[^{]*\.ct-tailor-modal[^{]*\{[^}]*max-height:\s*calc\(100vh/);
  });

  it("kanban tem scroll-snap horizontal em mobile", () => {
    expect(css).toMatch(/\.kanban[^}]*scroll-snap-type:\s*x\s+mandatory/);
  });

  it("microaction-check com hitbox 44px em mobile", () => {
    expect(css).toMatch(/\.ct-microaction-check\s*\{[^}]*min-(width|height):\s*44px/);
  });

  it("ct-filter-pill com min-height de toque em mobile", () => {
    expect(css).toMatch(/\.ct-filter-pill\s*\{[^}]*min-height:\s*44px/);
  });

  it("word-break em job-card pra salarios longos", () => {
    // Bloco mobile aplica word-break a varios seletores agrupados.
    // .ct-job-card aparece junto com .ct-job-meta e .ct-job-title.
    expect(css).toMatch(/\.ct-job-card[\s\S]{0,200}word-break:\s*break-word/);
  });
});
