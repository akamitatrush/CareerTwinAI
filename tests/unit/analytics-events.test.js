// Tests da taxonomy de eventos PostHog (lib/analytics/events.js).
//
// Garantias:
//  1. Todas as constantes EVENTS sao strings nao-vazias.
//  2. Nao ha duplicatas de event name (impediria diferenciar funis).
//  3. Padrao de naming: snake_case (a-z + _ + numeros opcionais).
//  4. FUNNELS contem so referencias validas (cada step esta em EVENTS).
//  5. SERVER_SIDE_EVENTS so contem refs validas de EVENTS.

import { describe, it, expect } from "vitest";
import { EVENTS, FUNNELS, SERVER_SIDE_EVENTS } from "@/lib/analytics/events";

describe("EVENTS taxonomy", () => {
  it("todas as constantes sao strings nao-vazias", () => {
    for (const [key, value] of Object.entries(EVENTS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      // Sanity: chave UPPER, valor lower
      expect(key).toBe(key.toUpperCase());
      expect(value).toBe(value.toLowerCase());
    }
  });

  it("nao ha event names duplicados", () => {
    const values = Object.values(EVENTS);
    const set = new Set(values);
    expect(set.size).toBe(values.length);
  });

  it("event names seguem snake_case (apenas a-z, 0-9, _)", () => {
    const pattern = /^[a-z][a-z0-9_]*$/;
    for (const value of Object.values(EVENTS)) {
      expect(value, `event "${value}" nao bate com snake_case`).toMatch(pattern);
    }
  });

  it("ha pelo menos 30 eventos definidos (cobertura comprehensive)", () => {
    expect(Object.keys(EVENTS).length).toBeGreaterThanOrEqual(30);
  });
});

describe("FUNNELS", () => {
  it("e um objeto com >=4 funis", () => {
    expect(typeof FUNNELS).toBe("object");
    expect(Object.keys(FUNNELS).length).toBeGreaterThanOrEqual(4);
  });

  it("cada funil e um array de pelo menos 2 steps", () => {
    for (const [name, steps] of Object.entries(FUNNELS)) {
      expect(Array.isArray(steps), `funnel "${name}" nao e array`).toBe(true);
      expect(steps.length, `funnel "${name}" tem <2 steps`).toBeGreaterThanOrEqual(2);
    }
  });

  it("cada step de cada funil e uma string que existe em EVENTS", () => {
    const allEventValues = new Set(Object.values(EVENTS));
    for (const [name, steps] of Object.entries(FUNNELS)) {
      for (const step of steps) {
        expect(typeof step, `step de "${name}" nao e string`).toBe("string");
        expect(
          allEventValues.has(step),
          `funnel "${name}" referencia event invalido: "${step}"`
        ).toBe(true);
      }
    }
  });

  it("ACTIVATION cobre o caminho home->dashboard", () => {
    expect(FUNNELS.ACTIVATION).toContain(EVENTS.HOME_VIEWED);
    expect(FUNNELS.ACTIVATION).toContain(EVENTS.DIAGNOSIS_COMPLETED);
    expect(FUNNELS.ACTIVATION).toContain(EVENTS.DASHBOARD_VIEWED);
  });

  it("MONETIZATION termina em checkout_completed", () => {
    const last = FUNNELS.MONETIZATION[FUNNELS.MONETIZATION.length - 1];
    expect(last).toBe(EVENTS.CHECKOUT_COMPLETED);
  });
});

describe("SERVER_SIDE_EVENTS", () => {
  it("e um Set", () => {
    expect(SERVER_SIDE_EVENTS).toBeInstanceOf(Set);
  });

  it("nao esta vazio (allowlist deve existir pro proxy /api/_track)", () => {
    expect(SERVER_SIDE_EVENTS.size).toBeGreaterThan(0);
  });

  it("todos os eventos do set existem em EVENTS", () => {
    const allEventValues = new Set(Object.values(EVENTS));
    for (const evt of SERVER_SIDE_EVENTS) {
      expect(
        allEventValues.has(evt),
        `SERVER_SIDE_EVENTS contem event invalido: "${evt}"`
      ).toBe(true);
    }
  });

  it("inclui eventos sensiveis (checkout + LGPD)", () => {
    expect(SERVER_SIDE_EVENTS.has(EVENTS.CHECKOUT_COMPLETED)).toBe(true);
    expect(SERVER_SIDE_EVENTS.has(EVENTS.DATA_EXPORTED)).toBe(true);
    expect(SERVER_SIDE_EVENTS.has(EVENTS.ACCOUNT_DELETED)).toBe(true);
  });
});
