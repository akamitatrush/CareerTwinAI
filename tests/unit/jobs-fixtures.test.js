import { describe, it, expect } from "vitest";
import { searchFixtures } from "@/lib/jobs/providers/fixtures";
import { extractSkills, matchScore } from "@/lib/skills-taxonomy";

// Helper: pega o catalogo inteiro via searchFixtures (role vazio retorna tudo
// ate `limit`). Usamos limit alto pra garantir que pegamos 100% do catalogo.
async function getAllFixtures() {
  return searchFixtures({ role: "", limit: 500 });
}

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
    const r = await getAllFixtures();
    expect(r.length).toBeGreaterThanOrEqual(60);
    r.forEach((j) => {
      const skills = extractSkills(`${j.titulo} ${j.descricao}`);
      expect(skills.length).toBeGreaterThanOrEqual(5);
    });
  });

  it("catalogo tem >= 60 fixtures (densidade pra preview sem provider real)", async () => {
    const r = await getAllFixtures();
    expect(r.length).toBeGreaterThanOrEqual(60);
  });

  it("catalogo cobre >= 8 areas distintas (backend, frontend, data, produto, ux, devops, seguranca, vendas, etc.)", async () => {
    const r = await getAllFixtures();
    // Heuristica: substring de cada area-keyword nos titulos do catalogo.
    // Nao usamos `areas` interna (encapsulada) — testamos via titulo, que e
    // o sinal final entregue na UI.
    const areaKeywords = [
      "backend",
      "frontend",
      "fullstack",
      "dados",
      "engenheiro(a) de dados",
      "cientista",
      "machine learning",
      "product manager",
      "product designer",
      "ux researcher",
      "devops",
      "site reliability",
      "cloud architect",
      "seguranca",
      "pentester",
      "qa",
      "ios",
      "android",
      "mobile",
      "marketing",
      "growth",
      "vendas",
      "customer success",
      "sales engineer",
      "financeiro",
      "controller",
      "people analytics",
      "tech recruiter",
      "engineering manager",
      "consultor",
      "estrategico",
      "s&op",
      "operacoes",
      "learning",
      "designer instrucional",
      "content strategist",
      "redator",
      "compliance",
      "esg",
      "ai engineer",
      "ml platform",
    ];
    const haystack = r.map((j) => j.titulo.toLowerCase()).join(" | ");
    const hits = areaKeywords.filter((k) => haystack.includes(k.toLowerCase()));
    expect(hits.length).toBeGreaterThanOrEqual(8);
  });

  it("catalogo tem diversidade geografica (cidades fora do eixo SP/RJ/CWB)", async () => {
    const r = await getAllFixtures();
    const locals = r.map((j) => j.local.toLowerCase()).join(" | ");
    // Pelo menos uma cidade fora do eixo SP / RJ / Curitiba precisa existir.
    const diversidadeCidades = [
      "belo horizonte",
      "porto alegre",
      "recife",
      "florianopolis",
      "salvador",
      "brasilia",
      "campinas",
    ];
    const hits = diversidadeCidades.filter((c) => locals.includes(c));
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("salario medio do catalogo e realista BR (>= R$ 5k, <= R$ 30k)", async () => {
    // Parse do campo `salario` formatado em pt-BR ("R$ 8.000 - R$ 13.000").
    // Calcula media dos pontos medios (min+max)/2 de cada vaga e checa range.
    const r = await getAllFixtures();
    const midpoints = r
      .map((j) => {
        if (!j.salario) return null;
        // Match "R$ X.XXX - R$ Y.YYY" → captura 2 numeros (pontos como sep de milhar).
        const m = j.salario.match(/R\$\s*([\d.]+)\s*-\s*R\$\s*([\d.]+)/);
        if (!m) return null;
        const min = Number(m[1].replace(/\./g, ""));
        const max = Number(m[2].replace(/\./g, ""));
        if (Number.isNaN(min) || Number.isNaN(max)) return null;
        return (min + max) / 2;
      })
      .filter((x) => x !== null);
    expect(midpoints.length).toBeGreaterThan(0);
    const avg = midpoints.reduce((a, b) => a + b, 0) / midpoints.length;
    expect(avg).toBeGreaterThanOrEqual(5000);
    expect(avg).toBeLessThanOrEqual(30000);
  });

  it("role desconhecido retorna [] (Gimli G3 2026-06-30: honestidade > preencher)", async () => {
    // Antes: catalogo.slice(0, 8) — qualquer role vira 8 vagas de Backend.
    // Agora: retorna [] e caller (lib/jobs/index.js) sinaliza
    // `noRelevantFixtures: true`. UI mostra empty-state honesto.
    //
    // Limitacao conhecida do algoritmo de match em searchFixtures: areas
    // curtas (`ai`, `ux`, `ia`, `ml`, `bi`, `cs`, `rh`, `qa`, `pm`) batem
    // por substring sem word-boundary — ate role "psiquiatra" pega por
    // causa do "ia" em "psiqu_ia_tra". Tests usam roles cujo texto nao
    // contem nenhuma dessas siglas em nenhum substring.
    const r = await searchFixtures({ role: "fisioterapeuta esportivo", limit: 8 });
    expect(r).toEqual([]);
  });

  it("roles nicho reais (professor/dentista) retornam [] pra evitar viesar p/ Backend", async () => {
    const prof = await searchFixtures({ role: "professor matematica fisica", limit: 8 });
    const dent = await searchFixtures({ role: "dentista clinico", limit: 8 });
    expect(prof).toEqual([]);
    expect(dent).toEqual([]);
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
