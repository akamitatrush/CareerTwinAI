import { describe, it, expect } from "vitest";
import { computeOnboardingState } from "@/lib/metrics/onboarding-state";

describe("computeOnboardingState", () => {
  it("retorna 0/3 sem profile", () => {
    const s = computeOnboardingState(null);
    expect(s.connectedCount).toBe(0);
    expect(s.complete).toBe(false);
  });

  it("CV conta como conectado com 60+ chars", () => {
    const s = computeOnboardingState({ rawCv: "x".repeat(100) });
    expect(s.sources.cv).toBe(true);
    expect(s.connectedCount).toBe(1);
  });

  it("CV muito curto não conta", () => {
    const s = computeOnboardingState({ rawCv: "abc" });
    expect(s.sources.cv).toBe(false);
  });

  it("LinkedIn JSON conta", () => {
    const s = computeOnboardingState({ linkedinJson: { sobre: "x" } });
    expect(s.sources.linkedin).toBe(true);
  });

  it("GitHub user conta", () => {
    const s = computeOnboardingState({ githubUser: "akamitatrush" });
    expect(s.sources.github).toBe(true);
  });

  it("3 fontes = complete=true", () => {
    const s = computeOnboardingState({
      rawCv: "x".repeat(100),
      linkedinJson: {},
      githubUser: "x",
    });
    expect(s.connectedCount).toBe(3);
    expect(s.complete).toBe(true);
  });

  it("targetRole tracked separadamente", () => {
    const s = computeOnboardingState({ targetRole: "PM" });
    expect(s.hasTarget).toBe(true);
  });
});
