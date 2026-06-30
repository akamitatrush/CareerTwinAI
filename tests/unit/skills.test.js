import { describe, it, expect } from "vitest";
import {
  extractSkills,
  matchScore,
  roleSimilarity,
  detectSeniority,
  senioritySignal,
  extractTitleTokens,
} from "@/lib/skills-taxonomy";

describe("extractSkills", () => {
  it("detecta SQL e Python em texto livre", () => {
    const out = extractSkills("Procuramos engenheiro com experiencia em Python e SQL avancado.");
    expect(out).toContain("Python");
    expect(out).toContain("SQL");
  });

  it("nao da falso-positivo dentro de palavra (ex.: 'SQL' dentro de 'mysql')", () => {
    // 'mysql' contem 'sql' como substring mas a checagem de fronteira deve rejeitar.
    const out = extractSkills("Trabalho com MySQL ha 5 anos");
    expect(out).not.toContain("SQL");
  });

  it("detecta Inglês via alias normalizado (sem acento)", () => {
    const out = extractSkills("Ingles avancado e necessario");
    expect(out).toContain("Inglês");
  });

  it("texto vazio retorna []", () => {
    expect(extractSkills("")).toEqual([]);
    expect(extractSkills(null)).toEqual([]);
  });
});

describe("matchScore — deterministico, nao envolve LLM", () => {
  it("100% quando perfil cobre todas as skills da vaga", () => {
    const { match, comuns, falta } = matchScore({
      profileSkills: ["Python", "SQL", "AWS"],
      jobSkills: ["Python", "SQL"],
    });
    expect(match).toBe(100);
    expect(comuns.length).toBe(2);
    expect(falta).toEqual([]);
  });

  it("0% quando nao ha intersecao", () => {
    const { match, falta } = matchScore({
      profileSkills: ["Java"],
      jobSkills: ["Python", "SQL"],
    });
    expect(match).toBe(0);
    expect(falta).toEqual(["python", "sql"]);
  });

  it("parcial: 50% quando cobre metade", () => {
    const { match } = matchScore({
      profileSkills: ["Python"],
      jobSkills: ["Python", "Go"],
    });
    expect(match).toBe(50);
  });

  it("zero defensivo: listas vazias", () => {
    expect(matchScore({ profileSkills: [], jobSkills: ["X"] }).match).toBe(0);
    expect(matchScore({ profileSkills: ["X"], jobSkills: [] }).match).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// P0.3 (docs/fluxos/auditoria/30062026/po-oportunidades-auditoria.md §P0.3):
// matchScore agora pondera role similarity + senioridade alem de skills.
// Pesos 50/30/20 — decisao temporaria, A/B test posterior calibra.
// ---------------------------------------------------------------------------

describe("extractTitleTokens — strippa noise/senioridade", () => {
  it("strippa senior/manager/conectivos e mantem tokens funcionais", () => {
    expect(extractTitleTokens("Senior Backend Engineer")).toEqual(["backend", "engineer"]);
    expect(extractTitleTokens("Marketing Manager")).toEqual(["marketing"]);
    expect(extractTitleTokens("Engenheiro Backend Pleno")).toEqual(["engenheiro", "backend"]);
  });
  it("normaliza acentos e ignora tokens curtos (<3)", () => {
    // 'Gerência' vira 'gerencia' (8 chars, passa) — nao confundir com 'gerente' (noise)
    expect(extractTitleTokens("Gerência de Operações Hospitalares")).toEqual([
      "gerencia",
      "operacoes",
      "hospitalares",
    ]);
    // 'QA' (2 chars) e filtrado — token curto
    expect(extractTitleTokens("QA Engineer")).toEqual(["engineer"]);
  });
  it("entrada vazia retorna []", () => {
    expect(extractTitleTokens("")).toEqual([]);
    expect(extractTitleTokens(null)).toEqual([]);
  });
});

describe("detectSeniority — nivel via word-boundary", () => {
  it("detecta senior em variantes (senior/sr/lead/principal/staff)", () => {
    expect(detectSeniority("Senior Backend Engineer")).toBe("senior");
    expect(detectSeniority("Sr. Engineer")).toBe("senior");
    expect(detectSeniority("Tech Lead Backend")).toBe("senior");
    expect(detectSeniority("Principal Engineer")).toBe("senior");
  });
  it("detecta pleno em variantes pt/en", () => {
    expect(detectSeniority("Engenheiro Pleno")).toBe("pleno");
    expect(detectSeniority("Mid-level Developer")).toBe("pleno");
  });
  it("detecta junior", () => {
    expect(detectSeniority("Junior Engineer")).toBe("junior");
    expect(detectSeniority("Trainee QA")).toBe("junior");
  });
  it("retorna null quando nao identificado", () => {
    expect(detectSeniority("Backend Engineer")).toBe(null);
    expect(detectSeniority("")).toBe(null);
  });
  it("nao da falso positivo dentro de palavra (substring)", () => {
    // "Sr" deve bater por word-boundary mas nao "sr" dentro de "consultor"
    expect(detectSeniority("Consultor de Vendas")).toBe(null);
  });
});

describe("roleSimilarity — Jaccard de tokens funcionais", () => {
  it("titulos identicos retornam 1.0", () => {
    expect(roleSimilarity("Backend Engineer", "Backend Engineer")).toBe(1);
  });
  it("Senior Backend Engineer vs Backend Engineer Pleno → 1.0 (senior/pleno strippados)", () => {
    expect(roleSimilarity("Senior Backend Engineer", "Backend Engineer Pleno")).toBe(1);
  });
  it("Senior Backend Engineer vs QA Engineer Pleno → 0.5 ('engineer' shared; 'qa' filtrado por <3 chars)", () => {
    // tokens A = {backend, engineer}, B = {engineer} (qa cai por filter <3)
    // Jaccard = 1/2 = 0.5 — ainda menor que role identico (1.0) → ranqueia abaixo.
    const r = roleSimilarity("Senior Backend Engineer", "QA Engineer Pleno");
    expect(r).toBe(0.5);
  });
  it("Marketing Manager vs Customer Success Manager → 0 (so 'manager' compartilhado e e noise)", () => {
    expect(roleSimilarity("Marketing Manager", "Customer Success Manager")).toBe(0);
  });
  it("tokens vazios apos strip retornam 0", () => {
    expect(roleSimilarity("Senior", "Pleno")).toBe(0);
    expect(roleSimilarity("", "Backend Engineer")).toBe(0);
  });
});

describe("senioritySignal — distancia ordinal junior/pleno/senior", () => {
  it("mesmo nivel = 1.0", () => {
    expect(senioritySignal("senior", "senior")).toBe(1);
    expect(senioritySignal("pleno", "pleno")).toBe(1);
  });
  it("1 step de distancia = 0.5 (junior-pleno, pleno-senior)", () => {
    expect(senioritySignal("junior", "pleno")).toBe(0.5);
    expect(senioritySignal("pleno", "senior")).toBe(0.5);
  });
  it("2 steps = 0 (junior em senior role)", () => {
    expect(senioritySignal("junior", "senior")).toBe(0);
    expect(senioritySignal("senior", "junior")).toBe(0);
  });
  it("nivel ausente = 0.7 (neutro positivo)", () => {
    expect(senioritySignal(null, "senior")).toBe(0.7);
    expect(senioritySignal("senior", null)).toBe(0.7);
    expect(senioritySignal(null, null)).toBe(0.7);
  });
});

describe("matchScore — multi-sinal (P0.3): role + senioridade alem de skills", () => {
  // Cenario do fundador (persona Senior Backend Engineer):
  //   - Perfil: Senior Backend Engineer com skills tech genericas + nicho
  //   - Vaga 1: Backend Engineer Senior REAL (descricao rica em skills)
  //   - Vaga 2: QA Engineer Pleno (descricao pobre em skills genericas)
  //
  // Antes (P0.3): QA Pleno marcava 100% e ficava no topo (skills cobertas 100%).
  // Agora: Backend Senior REAL > QA Pleno gracas a role + senioridade.

  const profileSkills = ["Java", "Spring", "SQL", "Docker", "Kubernetes", "AWS", "Git", "Kafka", "PostgreSQL"];
  const targetRole = "Senior Backend Engineer";
  const profileSeniority = "senior";

  it("Backend Senior REAL bate mais alto que QA Pleno (cenario do fundador)", () => {
    // Backend Senior: skills 67% (10/15) + role 1.0 + senioridade 1.0
    //   => 0.5*0.67 + 0.3*1 + 0.2*1 = 0.335 + 0.3 + 0.2 = 0.835 → 84
    const backendReal = matchScore({
      profileSkills,
      jobSkills: ["Java", "Spring", "SQL", "Docker", "Kubernetes", "AWS", "Git", "Kafka", "PostgreSQL", "REST", "Microservices", "CI/CD", "Linux", "Redis", "ElasticSearch"],
      targetRole,
      jobTitle: "Backend Engineer Senior",
      profileSeniority,
    });

    // QA Pleno: skills 100% (5/5) + role 0.33 (so 'engineer') + senioridade 0.5
    //   => 0.5*1 + 0.3*0.33 + 0.2*0.5 = 0.5 + 0.1 + 0.1 = 0.70 → 70
    const qaPleno = matchScore({
      profileSkills,
      jobSkills: ["SQL", "Docker", "Git", "AWS", "Scrum"],
      targetRole,
      jobTitle: "QA Engineer Pleno",
      profileSeniority,
    });

    expect(backendReal.match).toBeGreaterThan(qaPleno.match);
    // Sanity check: faixas esperadas (tolerancia ±5 pra pequeno arredondamento)
    expect(backendReal.match).toBeGreaterThanOrEqual(75);
    expect(qaPleno.match).toBeLessThanOrEqual(75);
  });

  it("Backend Junior PERDE pra Backend Senior REAL pro mesmo perfil senior (penalty senioridade)", () => {
    const backendJunior = matchScore({
      profileSkills,
      jobSkills: ["Java", "SQL", "Git"],
      targetRole,
      jobTitle: "Junior Backend Engineer",
      profileSeniority,
    });
    const backendSenior = matchScore({
      profileSkills,
      jobSkills: ["Java", "SQL", "Git"],
      targetRole,
      jobTitle: "Senior Backend Engineer",
      profileSeniority,
    });
    expect(backendSenior.match).toBeGreaterThan(backendJunior.match);
  });

  it("Marketing Manager vs Customer Success Manager: role similarity 0 separa false positive", () => {
    // Sem o filtro de role, ambos teriam skills similares e bateriam alto.
    // Agora: CS Manager role_sim = 0 (so 'manager' compartilhado e e noise).
    const marketingTarget = "Marketing Manager";
    const csManager = matchScore({
      profileSkills: ["HubSpot", "Excel"],
      jobSkills: ["HubSpot", "Excel"],
      targetRole: marketingTarget,
      jobTitle: "Customer Success Manager",
      profileSeniority: "senior",
    });
    const marketingManager = matchScore({
      profileSkills: ["HubSpot", "Excel"],
      jobSkills: ["HubSpot", "Excel"],
      targetRole: marketingTarget,
      jobTitle: "Marketing Manager Senior",
      profileSeniority: "senior",
    });
    expect(marketingManager.match).toBeGreaterThan(csManager.match);
  });

  it("breakdown auditavel exposto quando multi-sinal acionado (pilar #1)", () => {
    const r = matchScore({
      profileSkills: ["Python", "SQL"],
      jobSkills: ["Python"],
      targetRole: "Backend Engineer",
      jobTitle: "Backend Engineer Pleno",
      profileSeniority: "pleno",
    });
    expect(r.breakdown).toBeTruthy();
    expect(r.breakdown.skills).toBe(100);
    expect(r.breakdown.role).toBe(100);
    expect(r.breakdown.seniority).toBe(100);
    expect(r.breakdown.weights).toEqual({ skills: 0.5, role: 0.3, seniority: 0.2 });
  });

  it("back-compat: sem targetRole/jobTitle, retorna o calculo antigo (skills puro)", () => {
    const r = matchScore({
      profileSkills: ["Python", "SQL", "AWS"],
      jobSkills: ["Python", "SQL"],
    });
    expect(r.match).toBe(100);
    expect(r.breakdown).toBeUndefined();
  });
});
