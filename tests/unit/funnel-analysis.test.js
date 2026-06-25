// Tests da logica pura de analise de funil (lib/funnel.js).
//
// Cobertura:
//  - aggregateLastNWeeks: soma correta, null-safe, ordem cronologica.
//  - calculateRates: divisao por zero -> null pra rate especifica.
//  - analyzeBottleneck: cada cenario retorna o stage + severity esperado.
//  - startOfWeekUTC: canonical Segunda 00:00 UTC; idempotente.

import { describe, it, expect } from "vitest";
import {
  analyzeBottleneck,
  aggregateLastNWeeks,
  calculateRates,
  startOfWeekUTC,
  THRESHOLDS,
} from "@/lib/funnel.js";

describe("aggregateLastNWeeks", () => {
  it("soma 4 semanas corretamente", () => {
    const entries = [
      { applications: 10, callbacks: 2, hmConversations: 1, finals: 1, offers: 0 },
      { applications: 5, callbacks: 1, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 8, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 7, callbacks: 1, hmConversations: 1, finals: 0, offers: 0 },
    ];
    const r = aggregateLastNWeeks(entries, 4);
    expect(r.applications).toBe(30);
    expect(r.callbacks).toBe(4);
    expect(r.hmConversations).toBe(2);
    expect(r.finals).toBe(1);
    expect(r.offers).toBe(0);
  });

  it("limita ao N solicitado (corta extras)", () => {
    const entries = [
      { applications: 10, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 10, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 10, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 10, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 100, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
      { applications: 100, callbacks: 0, hmConversations: 0, finals: 0, offers: 0 },
    ];
    const r = aggregateLastNWeeks(entries, 4);
    // So as 4 primeiras (10+10+10+10=40), nao as 100s.
    expect(r.applications).toBe(40);
  });

  it("aceita lista vazia / null sem explodir", () => {
    expect(aggregateLastNWeeks([], 4).applications).toBe(0);
    expect(aggregateLastNWeeks(null, 4).applications).toBe(0);
    expect(aggregateLastNWeeks(undefined, 4).applications).toBe(0);
  });

  it("trata campos missing/null como zero", () => {
    const entries = [{ applications: 5 }, { callbacks: 1 }];
    const r = aggregateLastNWeeks(entries, 4);
    expect(r.applications).toBe(5);
    expect(r.callbacks).toBe(1);
    expect(r.hmConversations).toBe(0);
  });
});

describe("calculateRates", () => {
  it("calcula taxas corretamente", () => {
    const r = calculateRates({
      applications: 100,
      callbacks: 10,
      hmConversations: 5,
      finals: 2,
      offers: 1,
    });
    expect(r.triagemRate).toBeCloseTo(0.1, 5);
    expect(r.hmRate).toBeCloseTo(0.5, 5);
    expect(r.finalRate).toBeCloseTo(0.4, 5);
    expect(r.offerRate).toBeCloseTo(0.5, 5);
  });

  it("divisao por zero retorna null pra cada rate afetada", () => {
    const r = calculateRates({
      applications: 0,
      callbacks: 0,
      hmConversations: 0,
      finals: 0,
      offers: 0,
    });
    expect(r.triagemRate).toBeNull();
    expect(r.hmRate).toBeNull();
    expect(r.finalRate).toBeNull();
    expect(r.offerRate).toBeNull();
  });

  it("divisao por zero parcial: rates de baixo viram null, de cima nao", () => {
    const r = calculateRates({
      applications: 50,
      callbacks: 5,
      hmConversations: 0,
      finals: 0,
      offers: 0,
    });
    expect(r.triagemRate).toBeCloseTo(0.1, 5);
    expect(r.hmRate).toBe(0); // 0/5 = 0 (nao null — cb>0)
    expect(r.finalRate).toBeNull(); // hm=0 -> null
    expect(r.offerRate).toBeNull(); // finals=0 -> null
  });
});

describe("analyzeBottleneck", () => {
  it("volume baixo (< 5 applications) -> stage=volume, severity=high", () => {
    const r = analyzeBottleneck({
      applications: 4,
      callbacks: 4,
      hmConversations: 4,
      finals: 4,
      offers: 4,
    });
    expect(r.stage).toBe("volume");
    expect(r.severity).toBe("high");
    expect(r.suggestion).toMatch(/volume/i);
    expect(r.link).toBe("/oportunidades");
  });

  it("triagem rate < 5% -> stage=triagem (gargalo CV)", () => {
    // 50 apps, 1 callback = 2% (abaixo de 5%)
    const r = analyzeBottleneck({
      applications: 50,
      callbacks: 1,
      hmConversations: 1,
      finals: 1,
      offers: 1,
    });
    expect(r.stage).toBe("triagem");
    expect(r.severity).toBe("high");
    expect(r.link).toBe("/cvs-adaptados");
  });

  it("hm rate < 30% (recrutador nao passa pra HM) -> stage=hm", () => {
    // 50 apps, 10 callbacks (20%, ok), 1 HM (10% de cb — abaixo de 30%)
    const r = analyzeBottleneck({
      applications: 50,
      callbacks: 10,
      hmConversations: 1,
      finals: 1,
      offers: 1,
    });
    expect(r.stage).toBe("hm");
    expect(r.severity).toBe("high");
    expect(r.link).toBe("/autoconhecimento");
  });

  it("final rate < 30% (HM nao avanca pra final) -> stage=final", () => {
    // 50 apps, 10 cb, 5 HMs (50%, ok), 1 final (20% — abaixo de 30%)
    const r = analyzeBottleneck({
      applications: 50,
      callbacks: 10,
      hmConversations: 5,
      finals: 1,
      offers: 1,
    });
    expect(r.stage).toBe("final");
    expect(r.severity).toBe("high");
    expect(r.link).toBe("/evidencias");
  });

  it("offer rate < 40% (final nao vira offer) -> stage=offer, severity=medium", () => {
    // 50 apps, 10 cb, 5 HMs, 5 finais (100%, ok), 1 offer (20% — abaixo de 40%)
    const r = analyzeBottleneck({
      applications: 50,
      callbacks: 10,
      hmConversations: 5,
      finals: 5,
      offers: 1,
    });
    expect(r.stage).toBe("offer");
    expect(r.severity).toBe("medium");
    expect(r.link).toBe("/plano");
  });

  it("funil saudavel (todas taxas acima dos thresholds) -> stage=saudavel", () => {
    // 50 apps, 10 cb (20%), 5 HMs (50%), 3 finais (60%), 2 offers (66%)
    const r = analyzeBottleneck({
      applications: 50,
      callbacks: 10,
      hmConversations: 5,
      finals: 3,
      offers: 2,
    });
    expect(r.stage).toBe("saudavel");
    expect(r.severity).toBe("low");
    expect(r.suggestion).toMatch(/saudavel/i);
  });

  it("retorna rates calculadas junto da analise", () => {
    const r = analyzeBottleneck({
      applications: 100,
      callbacks: 10,
      hmConversations: 5,
      finals: 2,
      offers: 1,
    });
    expect(r.rates).toBeDefined();
    expect(r.rates.triagemRate).toBeCloseTo(0.1, 5);
  });

  it("THRESHOLDS exportado pra reuso em UI/tests", () => {
    expect(THRESHOLDS.triagem).toBe(0.05);
    expect(THRESHOLDS.hm).toBe(0.3);
    expect(THRESHOLDS.final).toBe(0.3);
    expect(THRESHOLDS.offer).toBe(0.4);
  });
});

describe("startOfWeekUTC", () => {
  it("Segunda-feira retorna ela mesma 00:00 UTC", () => {
    // 2026-06-22 e Segunda
    const d = new Date("2026-06-22T14:30:00Z");
    const w = startOfWeekUTC(d);
    expect(w.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("Quinta-feira volta pra Segunda da mesma semana", () => {
    // 2026-06-25 e Quinta
    const d = new Date("2026-06-25T10:00:00Z");
    const w = startOfWeekUTC(d);
    expect(w.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("Domingo volta pra Segunda da semana anterior", () => {
    // 2026-06-28 e Domingo -> deve cair em 2026-06-22 (Segunda anterior)
    const d = new Date("2026-06-28T23:59:59Z");
    const w = startOfWeekUTC(d);
    expect(w.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("idempotente — chamar 2x na mesma semana retorna mesma data", () => {
    const a = startOfWeekUTC(new Date("2026-06-23T10:00:00Z"));
    const b = startOfWeekUTC(new Date("2026-06-24T15:30:00Z"));
    expect(a.getTime()).toBe(b.getTime());
  });
});
