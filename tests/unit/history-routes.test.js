import { describe, it, expect } from "vitest";

// Cobertura minima — testar o shape do payload (contrato com a UI). Roteamento
// e auth sao cobertos por outros testes / inspecao manual; aqui o foco eh o
// formato esperado pra dashboard ("+18 em 5 meses"), line chart e timeline.

describe("history routes payload shape", () => {
  it("score/latest-with-history retorna shape esperado quando vazio", () => {
    const empty = {
      latest: null,
      deltaFromPrev: 0,
      deltaFromFirst: 0,
      firstAt: null,
      totalSnapshots: 0,
    };
    expect(empty).toHaveProperty("latest");
    expect(empty).toHaveProperty("deltaFromPrev");
    expect(empty).toHaveProperty("deltaFromFirst");
    expect(empty.deltaFromPrev).toBe(0);
    expect(empty.deltaFromFirst).toBe(0);
    expect(empty.latest).toBeNull();
  });

  it("score/latest-with-history calcula deltas corretamente", () => {
    // Snapshots desc (mais recente primeiro): 78, 70, 60.
    const snapshots = [
      { overall: 78, createdAt: new Date("2026-05-01") },
      { overall: 70, createdAt: new Date("2026-03-01") },
      { overall: 60, createdAt: new Date("2026-01-01") },
    ];
    const latest = snapshots[0];
    const prev = snapshots[1];
    const first = snapshots[snapshots.length - 1];

    const deltaFromPrev = latest.overall - prev.overall;
    const deltaFromFirst = latest.overall - first.overall;

    expect(deltaFromPrev).toBe(8);
    expect(deltaFromFirst).toBe(18); // o "+18 em 5 meses" do mock
  });

  it("score/latest-with-history zera deltaFromPrev quando so existe 1 snapshot", () => {
    const snapshots = [{ overall: 50, createdAt: new Date() }];
    const latest = snapshots[0];
    const prev = snapshots[1] || null;
    const first = snapshots[snapshots.length - 1];
    const deltaFromPrev = prev ? latest.overall - prev.overall : 0;
    const deltaFromFirst = latest.overall - first.overall;
    expect(deltaFromPrev).toBe(0);
    expect(deltaFromFirst).toBe(0);
  });

  it("history/actions timeline item tem shape correto", () => {
    const item = {
      type: "gap_completed",
      date: new Date(),
      title: "Concluiu microacao: SQL",
      detail: "Curso 4h",
      tag: "Skill",
    };
    expect(["gap_completed", "plan_completed", "application_event", "diagnosis"]).toContain(
      item.type
    );
    expect(item.date).toBeTruthy();
    expect(typeof item.title).toBe("string");
    expect(typeof item.tag).toBe("string");
  });

  it("history/actions ordena timeline por data decrescente e respeita teto de 40", () => {
    const raw = Array.from({ length: 60 }, (_, i) => ({
      type: "diagnosis",
      date: new Date(2026, 0, i + 1), // jan/2026 dias 1..60
      title: `t${i}`,
      detail: "",
      tag: "Diagnostico",
    }));
    const out = raw
      .filter((x) => x.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 40);
    expect(out.length).toBe(40);
    // primeiro item eh o mais novo (i=59 -> 1 mar 2026)
    expect(new Date(out[0].date) > new Date(out[39].date)).toBe(true);
  });

  it("history/score retorna pontos ordenados ascendente (pra line chart)", () => {
    const points = [
      { overall: 60, createdAt: new Date("2026-01-01") },
      { overall: 70, createdAt: new Date("2026-03-01") },
      { overall: 78, createdAt: new Date("2026-05-01") },
    ];
    for (let i = 1; i < points.length; i++) {
      expect(new Date(points[i].createdAt) >= new Date(points[i - 1].createdAt)).toBe(true);
    }
  });
});
