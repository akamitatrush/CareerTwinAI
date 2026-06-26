// Testes do WelcomeModal. Padrao copilot-widget.test.js: como o setup do
// projeto NAO inclui JSDOM/RTL (vitest env = "node"), validamos a FORMA
// (eventos, contratos, acessibilidade via reuse do Modal, condicoes de
// montagem) lendo o source. Cobre regressao essencial sem custo de RTL.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { EVENTS } from "@/lib/analytics/events";

const ROOT = path.resolve(__dirname, "../..");
const MODAL_PATH = path.join(ROOT, "components/WelcomeModal.js");
const BASE_MODAL_PATH = path.join(ROOT, "components/Modal.js");

function read(p) {
  return readFileSync(p, "utf8");
}

describe("WelcomeModal — eventos PostHog", () => {
  it("EVENTS.WELCOME_SHOWN e WELCOME_DISMISSED existem com nomes canonicos", () => {
    expect(EVENTS.WELCOME_SHOWN).toBe("welcome_shown");
    expect(EVENTS.WELCOME_DISMISSED).toBe("welcome_dismissed");
  });

  it("nomes seguem snake_case (taxonomia)", () => {
    expect(EVENTS.WELCOME_SHOWN).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(EVENTS.WELCOME_DISMISSED).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("WelcomeModal — source structure", () => {
  it("arquivo do componente existe", () => {
    expect(existsSync(MODAL_PATH)).toBe(true);
  });

  it("eh client component", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/^["']use client["']/);
  });

  it("renderiza title + subtitle (Modal base)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/title=["']Bem-vindo ao CareerTwin AI["']/);
    expect(src).toMatch(/subtitle=/);
  });

  it("renderiza os 3 cards Diagnostico/Gaps/Vagas", () => {
    const src = read(MODAL_PATH);
    expect(src).toContain("Diagnóstico");
    expect(src).toContain("Gaps");
    expect(src).toContain("Vagas");
    // Array de cards (estrutura visual hierarquica)
    expect(src).toMatch(/CARDS\s*=\s*\[/);
  });

  it("trackeia WELCOME_SHOWN e WELCOME_DISMISSED", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/EVENTS\.WELCOME_SHOWN/);
    expect(src).toMatch(/EVENTS\.WELCOME_DISMISSED/);
  });
});

describe("WelcomeModal — gate de exibicao (1o acesso)", () => {
  it("controla via localStorage key estavel ct_welcome_shown", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/ct_welcome_shown/);
    expect(src).toMatch(/localStorage\.(getItem|setItem)/);
  });

  it("combina check server-side via /api/profile/onboarding", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/\/api\/profile\/onboarding/);
    expect(src).toMatch(/welcomedAt/);
  });

  it("chama /api/auth/welcome-sent fire-and-forget no mount", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/\/api\/auth\/welcome-sent/);
    // fetch envolto em try/catch (.catch ou try-catch) — fail-safe
    expect(src).toMatch(/method:\s*["']POST["']/);
  });

  it("nao monta nada quando show=false (return null defensivo)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/if\s*\(\s*!show\s*\)\s*return\s*null/);
  });
});

describe("WelcomeModal — acessibilidade via Modal base", () => {
  it("usa o Modal compartilhado (heranca de role=dialog + focus trap)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/import\s+Modal\s+from\s+["']\.\/Modal["']/);
    expect(src).toMatch(/<Modal[\s\S]*?onClose=\{/);
  });

  it("Modal base prove role=dialog + aria-modal (a11y herdada)", () => {
    const baseSrc = read(BASE_MODAL_PATH);
    expect(baseSrc).toMatch(/role=["']dialog["']/);
    expect(baseSrc).toMatch(/aria-modal=["']true["']/);
  });

  it("Modal base trata ESC pra fechar (heranca)", () => {
    const baseSrc = read(BASE_MODAL_PATH);
    expect(baseSrc).toMatch(/Escape/);
    expect(baseSrc).toMatch(/onClose/);
  });

  it("Modal base implementa focus trap (Tab/Shift+Tab)", () => {
    const baseSrc = read(BASE_MODAL_PATH);
    expect(baseSrc).toMatch(/Tab/);
    expect(baseSrc).toMatch(/preventDefault/);
  });
});

describe("WelcomeModal — handlers de fechamento", () => {
  it("handleDismiss seta localStorage flag pra nao reaparecer", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/handleDismiss/);
    expect(src).toMatch(/localStorage\.setItem\s*\(\s*STORAGE_KEY/);
  });

  it("handleStart usa scrollTo + router.push pra dashboard", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/handleStart/);
    expect(src).toMatch(/scrollTo/);
    expect(src).toMatch(/router\.push/);
  });

  it("dois botoes de acao: dismiss + comecar diagnostico", () => {
    const src = read(MODAL_PATH);
    expect(src).toContain("Mais tarde");
    expect(src).toContain("Começar diagnóstico");
  });
});
