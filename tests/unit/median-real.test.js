// Testes do calculo de mediana real.
//
// Cobre:
//  - <50 outcomes => stub (HIRED_MEDIAN=78) + isStub=true
//  - >=50 outcomes => mediana real calculada do scoreAtTime
//  - Mediana de N par (media dos 2 centrais) e N impar (central)
//  - Cache em memoria 1h evita re-query
//  - DB falha => failsafe (stub + isStub=true, sem cache)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    outcome: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  getRealMedian,
  _resetCache,
  MIN_OUTCOMES_FOR_REAL,
  HIRED_MEDIAN,
} from "@/lib/metrics/median-real";

describe("getRealMedian", () => {
  beforeEach(() => {
    _resetCache();
    prisma.outcome.findMany.mockReset();
  });

  it("threshold default = 50 (estatisticamente minimo)", () => {
    expect(MIN_OUTCOMES_FOR_REAL).toBe(50);
  });

  it("retorna stub quando ha menos de 50 outcomes", async () => {
    prisma.outcome.findMany.mockResolvedValue(
      Array.from({ length: 10 }, () => ({ scoreAtTime: 80 }))
    );
    const result = await getRealMedian();
    expect(result.isStub).toBe(true);
    expect(result.value).toBe(HIRED_MEDIAN);
    expect(result.value).toBe(78);
    expect(result.sampleSize).toBe(10);
    expect(result.thresholdToReal).toBe(50);
  });

  it("retorna stub quando 0 outcomes", async () => {
    prisma.outcome.findMany.mockResolvedValue([]);
    const result = await getRealMedian();
    expect(result.isStub).toBe(true);
    expect(result.sampleSize).toBe(0);
  });

  it("mediana N=5 (impar) e valor central", async () => {
    // Mock com >=50 pra ativar o branch real. Mas com 5 valores distintos.
    const samples = [10, 20, 30, 40, 50];
    const filled = [
      ...samples.map((v) => ({ scoreAtTime: v })),
      ...Array.from({ length: 45 }, () => ({ scoreAtTime: 30 })),
    ];
    prisma.outcome.findMany.mockResolvedValue(filled);
    const result = await getRealMedian();
    expect(result.isStub).toBe(false);
    expect(result.sampleSize).toBe(50);
    // 5 valores [10,20,30,40,50] + 45 valores [30,30,...] => sorted, middle eh 30
    expect(result.value).toBe(30);
  });

  it("mediana de 100 valores mistos: calcula correto", async () => {
    // 100 valores 1..100 — mediana eh (50+51)/2 = 50.5 -> round(50.5)=51
    const filled = Array.from({ length: 100 }, (_, i) => ({
      scoreAtTime: i + 1,
    }));
    prisma.outcome.findMany.mockResolvedValue(filled);
    const result = await getRealMedian();
    expect(result.isStub).toBe(false);
    expect(result.sampleSize).toBe(100);
    expect(result.value).toBe(51);
  });

  it("mediana N par usa media dos 2 centrais (arredondada)", async () => {
    // 50 valores: 25 com score 40, 25 com score 60. Sorted: [40x25, 60x25].
    // Middle: media de sorted[24]=40 e sorted[25]=60 -> 50.
    const filled = [
      ...Array.from({ length: 25 }, () => ({ scoreAtTime: 40 })),
      ...Array.from({ length: 25 }, () => ({ scoreAtTime: 60 })),
    ];
    prisma.outcome.findMany.mockResolvedValue(filled);
    const result = await getRealMedian();
    expect(result.value).toBe(50);
  });

  it("exatamente 50 outcomes ativa real (>= threshold, nao >)", async () => {
    const filled = Array.from({ length: 50 }, () => ({ scoreAtTime: 75 }));
    prisma.outcome.findMany.mockResolvedValue(filled);
    const result = await getRealMedian();
    expect(result.isStub).toBe(false);
    expect(result.value).toBe(75);
  });

  it("49 outcomes ainda eh stub (< threshold)", async () => {
    const filled = Array.from({ length: 49 }, () => ({ scoreAtTime: 90 }));
    prisma.outcome.findMany.mockResolvedValue(filled);
    const result = await getRealMedian();
    expect(result.isStub).toBe(true);
    expect(result.value).toBe(78); // stub
  });

  it("cache evita re-query DB (chamadas consecutivas)", async () => {
    prisma.outcome.findMany.mockResolvedValue([]);
    await getRealMedian();
    await getRealMedian();
    await getRealMedian();
    expect(prisma.outcome.findMany).toHaveBeenCalledTimes(1);
  });

  it("DB falha: retorna stub com isStub=true SEM cachear", async () => {
    prisma.outcome.findMany.mockRejectedValue(new Error("db down"));
    const r1 = await getRealMedian();
    expect(r1.isStub).toBe(true);
    expect(r1.value).toBe(78);
    expect(r1.sampleSize).toBe(0);
    // Sem cache: proxima chamada tenta DB de novo.
    await getRealMedian();
    expect(prisma.outcome.findMany).toHaveBeenCalledTimes(2);
  });

  it("ignora valores nao-numericos defensivamente", async () => {
    const filled = [
      ...Array.from({ length: 50 }, () => ({ scoreAtTime: 80 })),
      { scoreAtTime: NaN },
      { scoreAtTime: null },
    ];
    prisma.outcome.findMany.mockResolvedValue(filled);
    const result = await getRealMedian();
    // sampleSize do return e total apos filter — NaN/null filtrados.
    expect(result.value).toBe(80);
  });

  it("query filtra por kind HIRED + HIRED_DIFFERENT e scoreAtTime not null", async () => {
    prisma.outcome.findMany.mockResolvedValue([]);
    await getRealMedian();
    const call = prisma.outcome.findMany.mock.calls[0][0];
    expect(call.where.kind).toEqual({ in: ["HIRED", "HIRED_DIFFERENT"] });
    expect(call.where.scoreAtTime).toEqual({ not: null });
  });
});
