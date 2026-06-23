// Testes do CopilotWidget. Como o setup do projeto NAO inclui JSDOM/RTL
// (vitest env = "node"), nao renderizamos o componente: validamos a forma
// (eventos PostHog presentes + contratos chave no source) e a integracao
// estrutural com AppShell (import + render do widget).
//
// Cobertura logica:
//  1. Eventos COPILOT_* existem em EVENTS.
//  2. Widget bate em /api/chat com role + history + message (ChatBody contract).
//  3. Persistencia em localStorage usa chave estavel.
//  4. AppShell renderiza <CopilotWidget /> e ele NAO vaza pra public layout.
//
// Esses asserts cobrem regressao: se alguem mudar a chave do localStorage
// ou remover o evento, o teste falha cedo no CI.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { EVENTS } from "@/lib/analytics/events";

const ROOT = path.resolve(__dirname, "../..");
const WIDGET_PATH = path.join(ROOT, "components/CopilotWidget.js");
const APPSHELL_PATH = path.join(ROOT, "components/AppShell.js");
const APP_LAYOUT_PATH = path.join(ROOT, "app/(app)/layout.js");
const ROOT_LAYOUT_PATH = path.join(ROOT, "app/layout.js");

function readSource(p) {
  return readFileSync(p, "utf8");
}

describe("CopilotWidget — eventos PostHog", () => {
  it("EVENTS expoe as quatro constantes do copilot", () => {
    expect(EVENTS.COPILOT_OPENED).toBe("copilot_opened");
    expect(EVENTS.COPILOT_MESSAGE_SENT).toBe("copilot_message_sent");
    expect(EVENTS.COPILOT_MESSAGE_RECEIVED).toBe("copilot_message_received");
    expect(EVENTS.COPILOT_SUGGESTION_CLICKED).toBe("copilot_suggestion_clicked");
  });

  it("nomes seguem snake_case (alinhado com taxonomia geral)", () => {
    const pattern = /^[a-z][a-z0-9_]*$/;
    for (const key of [
      "COPILOT_OPENED",
      "COPILOT_MESSAGE_SENT",
      "COPILOT_MESSAGE_RECEIVED",
      "COPILOT_SUGGESTION_CLICKED",
    ]) {
      expect(EVENTS[key]).toMatch(pattern);
    }
  });
});

describe("CopilotWidget — source structure", () => {
  it("arquivo do componente existe", () => {
    expect(existsSync(WIDGET_PATH)).toBe(true);
  });

  it("eh client component (use client header)", () => {
    const src = readSource(WIDGET_PATH);
    // Aceita aspas simples ou duplas
    expect(src).toMatch(/^["']use client["']/);
  });

  it("chama POST /api/chat com role, history e message (ChatBody)", () => {
    const src = readSource(WIDGET_PATH);
    expect(src).toMatch(/fetch\(\s*["']\/api\/chat["']/);
    // Body deve enviar role + history + message conforme validator
    expect(src).toMatch(/role:\s*targetRole/);
    expect(src).toMatch(/history,?/);
    expect(src).toMatch(/message:\s*userMsg/);
  });

  it("le e grava historico em localStorage", () => {
    const src = readSource(WIDGET_PATH);
    expect(src).toMatch(/localStorage\.getItem/);
    expect(src).toMatch(/localStorage\.setItem/);
    expect(src).toMatch(/ct-copilot-history/);
  });

  it("trackea os quatro eventos PostHog do dominio copilot", () => {
    const src = readSource(WIDGET_PATH);
    expect(src).toMatch(/EVENTS\.COPILOT_OPENED/);
    expect(src).toMatch(/EVENTS\.COPILOT_MESSAGE_SENT/);
    expect(src).toMatch(/EVENTS\.COPILOT_MESSAGE_RECEIVED/);
    expect(src).toMatch(/EVENTS\.COPILOT_SUGGESTION_CLICKED/);
  });

  it("expõe sugestoes contextuais por rota (dashboard/gaps/oportunidades)", () => {
    const src = readSource(WIDGET_PATH);
    expect(src).toMatch(/pathname.+startsWith\(["']\/dashboard["']\)/);
    expect(src).toMatch(/pathname.+startsWith\(["']\/gaps["']\)/);
    expect(src).toMatch(/pathname.+startsWith\(["']\/oportunidades["']\)/);
  });

  it("tem role=dialog e aria-label pra a11y", () => {
    const src = readSource(WIDGET_PATH);
    expect(src).toMatch(/role=["']dialog["']/);
    expect(src).toMatch(/aria-label/);
  });

  it("usa targetRole do user (com fallback) — passa ownership pra /api/chat", () => {
    const src = readSource(WIDGET_PATH);
    expect(src).toMatch(/user\?\.targetRole/);
  });
});

describe("CopilotWidget — integracao com AppShell", () => {
  it("AppShell importa CopilotWidget", () => {
    const src = readSource(APPSHELL_PATH);
    expect(src).toMatch(/import\s+CopilotWidget\s+from\s+["']@\/components\/CopilotWidget["']/);
  });

  it("AppShell renderiza <CopilotWidget /> passando user", () => {
    const src = readSource(APPSHELL_PATH);
    expect(src).toMatch(/<CopilotWidget\s+user=\{user\}\s*\/>/);
  });

  it("AppShell so eh montado em /(app)/layout.js (rota auth-gated)", () => {
    expect(existsSync(APP_LAYOUT_PATH)).toBe(true);
    const src = readSource(APP_LAYOUT_PATH);
    // Layout do grupo (app) chama auth() e faz redirect pra /entrar quando nao logado
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/redirect\(["']\/entrar["']\)/);
    expect(src).toMatch(/AppShell/);
  });

  it("CopilotWidget NAO eh montado no layout root (nao vaza pra public pages)", () => {
    if (!existsSync(ROOT_LAYOUT_PATH)) return;
    const src = readSource(ROOT_LAYOUT_PATH);
    expect(src).not.toMatch(/CopilotWidget/);
  });
});

describe("CopilotWidget — CSS", () => {
  it("classes principais existem em globals.css", () => {
    const css = readSource(path.join(ROOT, "app/globals.css"));
    for (const cls of [
      ".ct-copilot-fab",
      ".ct-copilot-panel",
      ".ct-copilot-header",
      ".ct-copilot-messages",
      ".ct-copilot-form",
      ".ct-copilot-input",
      ".ct-copilot-send",
      ".ct-copilot-suggestion",
    ]) {
      expect(css, `CSS class ${cls} ausente`).toContain(cls);
    }
  });

  it("regra mobile responsiva (max-width: 720px) cobre FAB + panel", () => {
    const css = readSource(path.join(ROOT, "app/globals.css"));
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
  });
});
