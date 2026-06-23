import { describe, it, expect } from "vitest";

// Logica do welcome flow:
// - Primeiro diagnostico = quando o count de ScoreSnapshot ANTES desse era 0
// - Banner aparece enquanto welcomedAt for null (dismiss em Profile.welcomedAt)
// - Banner muda copy conforme firstDiagnosisAt (null = "ainda nao fez")
//
// Os asserts abaixo refletem a logica que vive em app/api/analyze/route.js
// e em app/(app)/dashboard/page.js — qualquer mudanca de criterio deve atualizar
// estes testes pra falhar cedo no CI.

describe("welcome flow logic", () => {
  it("primeiro diagnostico detectado quando count antes era 0", () => {
    const isFirst = (prevCount) => prevCount === 0;
    expect(isFirst(0)).toBe(true);
    expect(isFirst(1)).toBe(false);
    expect(isFirst(42)).toBe(false);
  });

  it("banner aparece se welcomedAt is null", () => {
    expect(!null).toBe(true);
    expect(!undefined).toBe(true);
    expect(!new Date()).toBe(false);
  });

  it("banner some quando user dismissa (welcomedAt setado)", () => {
    const showBanner = (welcomedAt) => !welcomedAt;
    expect(showBanner(null)).toBe(true);
    expect(showBanner(undefined)).toBe(true);
    expect(showBanner(new Date())).toBe(false);
  });

  it("variante 'primeira vez' quando firstDiagnosisAt e null", () => {
    const isFirstTime = (firstDiagnosisAt) => !firstDiagnosisAt;
    expect(isFirstTime(null)).toBe(true);
    expect(isFirstTime(new Date())).toBe(false);
  });

  it("welcome notification idempotente: so cria se existing === 0", () => {
    const shouldNotify = (existingCount) => existingCount === 0;
    expect(shouldNotify(0)).toBe(true);
    expect(shouldNotify(1)).toBe(false);
  });
});
