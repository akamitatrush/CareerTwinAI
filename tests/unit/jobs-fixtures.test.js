import { describe, it, expect } from "vitest";
import { searchFixtures } from "@/lib/jobs/providers/fixtures";
import { extractSkills, matchScore } from "@/lib/skills-taxonomy";

// Regressao critica: ate v0.3.0 as fixtures geravam descricao "vazia de skills"
// → matchScore retornava 0 → rota /api/opportunities filtrava tudo → UI vazia.
// Estes testes garantem que o catalogo curado nao volta a esse estado.

describe("fixtures produzem vagas com skills extraiveis", () => {
  it("nao retorna vazio pra role generica", async () => {
    const r = await searchFixtures({ role: "desenvolvedor", limit: 10 });
    expect(r.length).toBeGreaterThan(0);
  });

  it("retorna vagas com descricao nao-vazia", async () => {
    const r = await searchFixtures({ role: "backend", limit: 5 });
    expect(r.length).toBeGreaterThan(0);
    r.forEach((j) => expect(j.descricao.length).toBeGreaterThan(50));
  });

  it("descricoes tem skills extraiveis pela taxonomy", async () => {
    const r = await searchFixtures({ role: "backend", limit: 5 });
    const totalSkills = r.reduce(
      (acc, j) => acc + extractSkills(`${j.titulo} ${j.descricao}`).length,
      0
    );
    expect(totalSkills).toBeGreaterThan(0);
  });

  it("matchScore retorna > 0 com perfil tech generico", async () => {
    const r = await searchFixtures({ role: "engineer", limit: 1 });
    expect(r.length).toBeGreaterThan(0);
    const job = r[0];
    const profileSkills = ["JavaScript", "Node.js", "SQL", "Docker"];
    const jobSkills = extractSkills(`${job.titulo} ${job.descricao}`);
    const { match } = matchScore({ profileSkills, jobSkills });
    expect(match).toBeGreaterThan(0);
  });

  it("toda fixture do catalogo tem >= 5 skills extraiveis", async () => {
    // Garante riqueza minima da descricao — defesa contra regressao.
    const r = await searchFixtures({ role: "", limit: 100 });
    expect(r.length).toBeGreaterThanOrEqual(30);
    r.forEach((j) => {
      const skills = extractSkills(`${j.titulo} ${j.descricao}`);
      expect(skills.length).toBeGreaterThanOrEqual(5);
    });
  });

  it("role desconhecido nao retorna vazio (fallback catalogo)", async () => {
    const r = await searchFixtures({ role: "xyz-cargo-inexistente-qualquer", limit: 8 });
    expect(r.length).toBeGreaterThan(0);
  });

  it("respeita limit como teto, nao piso", async () => {
    const r = await searchFixtures({ role: "backend", limit: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it("vagas tem salario formatado em pt-BR quando disponivel", async () => {
    const r = await searchFixtures({ role: "backend", limit: 1 });
    expect(r[0].salario).toMatch(/R\$/);
  });

  it("contrato searchFixtures: campos obrigatorios preservados", async () => {
    const r = await searchFixtures({ role: "produto", limit: 2 });
    r.forEach((j) => {
      expect(j).toHaveProperty("id");
      expect(j).toHaveProperty("source", "fixtures");
      expect(j).toHaveProperty("titulo");
      expect(j).toHaveProperty("empresa");
      expect(j).toHaveProperty("local");
      expect(j).toHaveProperty("descricao");
      expect(j).toHaveProperty("url", null); // fixtures nunca tem url
    });
  });
});
