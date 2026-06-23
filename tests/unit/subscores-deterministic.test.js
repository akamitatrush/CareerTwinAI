import { describe, it, expect } from "vitest";
import {
  computeAderenciaVagas,
  computeRelevanciaHabilidades,
  computeOtimizacaoPerfil,
  computeExperienciaMercado,
  computeAllSubScores,
} from "@/lib/scoring/subscores";
import { WEIGHTS } from "@/lib/score";

describe("computeAderenciaVagas — TF-like ponderado por frequencia", () => {
  it("retorna 0 sem vagas", () => {
    expect(computeAderenciaVagas({ skills: ["Python"] }, []).valor).toBe(0);
  });

  it("retorna 0 sem skills no perfil", () => {
    const vagas = [{ titulo: "Python Dev", descricao: "python sql" }];
    expect(computeAderenciaVagas({ skills: [] }, vagas).valor).toBe(0);
  });

  it("score alto quando user tem skills muito pedidas", () => {
    const vagas = [
      { titulo: "Python Dev", descricao: "python sql" },
      { titulo: "Backend", descricao: "python aws docker" },
      { titulo: "Data Engineer", descricao: "python sql airflow" },
    ];
    const r = computeAderenciaVagas({ skills: ["Python", "SQL"] }, vagas);
    expect(r.valor).toBeGreaterThan(40); // tem 2 das mais pedidas
    expect(r.n_vagas).toBe(3);
    expect(r.comuns).toBeGreaterThan(0);
  });

  it("score baixo quando user nao tem nada do que o mercado pede", () => {
    const vagas = [
      { titulo: "Python Dev", descricao: "python sql aws" },
      { titulo: "Backend", descricao: "python aws docker" },
    ];
    const r = computeAderenciaVagas({ skills: ["Excel"] }, vagas);
    expect(r.valor).toBe(0); // Excel nao aparece em nenhuma vaga
  });

  it("aceita vagas sem campos (defensivo)", () => {
    const r = computeAderenciaVagas({ skills: ["Python"] }, [{}, { titulo: "" }]);
    expect(r.valor).toBe(0);
  });

  it("retorna inteiro 0-100", () => {
    const vagas = [{ titulo: "Python Dev", descricao: "python python python" }];
    const r = computeAderenciaVagas({ skills: ["Python"] }, vagas);
    expect(Number.isInteger(r.valor)).toBe(true);
    expect(r.valor).toBeGreaterThanOrEqual(0);
    expect(r.valor).toBeLessThanOrEqual(100);
  });
});

describe("computeRelevanciaHabilidades — count/validity/diversity", () => {
  it("retorna 0 sem skills", () => {
    expect(computeRelevanciaHabilidades({}).valor).toBe(0);
    expect(computeRelevanciaHabilidades({ skills: [] }).valor).toBe(0);
  });

  it("score alto com 10+ skills reconhecidas e unicas", () => {
    const skills = [
      "Python",
      "SQL",
      "React",
      "Go",
      "Docker",
      "AWS",
      "Kubernetes",
      "Java",
      "Tableau",
      "Airflow",
    ];
    const r = computeRelevanciaHabilidades({ skills });
    expect(r.valor).toBeGreaterThan(70);
    expect(r.total).toBe(10);
    expect(r.validas).toBeGreaterThan(8);
  });

  it("penaliza skills nao reconheciveis", () => {
    const r = computeRelevanciaHabilidades({
      skills: ["xyzzy", "foo", "bar", "baz", "qux"],
    });
    // 5 skills (count=50) + 0% validas + 100% diversidade.
    // 0.4*50 + 0.4*0 + 0.2*100 = 20 + 0 + 20 = 40
    expect(r.valor).toBeLessThan(50);
    expect(r.validas).toBe(0);
  });

  it("penaliza duplicacao (perde diversidade)", () => {
    const dup = computeRelevanciaHabilidades({
      skills: ["python", "python", "PYTHON", "Python", "python"],
    });
    const uniq = computeRelevanciaHabilidades({
      skills: ["Python", "SQL", "React", "Go", "Docker"],
    });
    expect(dup.valor).toBeLessThan(uniq.valor);
  });
});

describe("computeOtimizacaoPerfil — reusa computeCompleteness", () => {
  it("retorna 0 sem perfil", () => {
    expect(computeOtimizacaoPerfil(null).valor).toBe(0);
  });

  it("perfil vazio = score baixo", () => {
    expect(computeOtimizacaoPerfil({}).valor).toBe(0);
  });

  it("perfil bem preenchido = score alto", () => {
    const profile = {
      nome: "M",
      cargoAtual: "Eng",
      senioridade: "Pleno",
      targetRole: "Senior Eng",
      skills: ["Python", "SQL", "Go"],
      rawCv: "x".repeat(300),
      linkedinJson: { ok: true },
      githubUser: "user",
    };
    const r = computeOtimizacaoPerfil(profile);
    expect(r.valor).toBeGreaterThan(80);
    expect(r.missing_count).toBeLessThanOrEqual(2);
  });
});

describe("computeExperienciaMercado — anos + senioridade", () => {
  it("parses anos do CV", () => {
    const profile = {
      rawCv: "Trabalhei de 2015 a 2024 na empresa X",
      senioridade: "Sênior",
    };
    const r = computeExperienciaMercado(profile, "Senior Engineer");
    expect(r.anos_estimados).toBeGreaterThanOrEqual(5);
    expect(r.valor).toBeGreaterThan(50);
  });

  it("match perfeito senior x cargo senior", () => {
    const r = computeExperienciaMercado(
      { rawCv: "2010 ... 2024", senioridade: "Senior" },
      "Senior Software Engineer"
    );
    expect(r.valor).toBeGreaterThan(80);
  });

  it("under-qualified: junior pra cargo senior baixa o score", () => {
    const senior = computeExperienciaMercado(
      { rawCv: "2015 ... 2024", senioridade: "Senior" },
      "Senior Engineer"
    );
    const junior = computeExperienciaMercado(
      { rawCv: "2023 ... 2024", senioridade: "Junior" },
      "Senior Engineer"
    );
    expect(senior.valor).toBeGreaterThan(junior.valor);
  });

  it("CV sem datas retorna anos=0", () => {
    const r = computeExperienciaMercado(
      { rawCv: "Profissional dedicado e proativo", senioridade: "Pleno" },
      "Engenheiro Pleno"
    );
    expect(r.anos_estimados).toBe(0);
    // Mas seniority_match=90 (pleno x cargo neutro) ainda da score baixo:
    // 0.6*0 + 0.4*90 = 36
    expect(r.valor).toBeLessThan(50);
  });

  it("trata datas absurdas (ano > atual)", () => {
    const r = computeExperienciaMercado(
      { rawCv: "Vou trabalhar de 2099 a 2999", senioridade: "" },
      "X"
    );
    expect(r.anos_estimados).toBe(0); // filtra anos invalidos
  });
});

describe("computeAllSubScores — orchestrator", () => {
  it("combina os 4 sub-scores com WEIGHTS corretos", () => {
    const profile = {
      nome: "M",
      cargoAtual: "Eng",
      senioridade: "Senior",
      targetRole: "Senior Engineer",
      skills: ["Python", "SQL", "Go", "Docker", "AWS"],
      rawCv: "Trabalhei de 2015 a 2024. " + "x".repeat(300),
      linkedinJson: { ok: true },
      githubUser: "user",
    };
    const vagas = [
      { titulo: "Senior Eng", descricao: "python sql aws docker" },
      { titulo: "Backend", descricao: "python go" },
    ];
    const r = computeAllSubScores(profile, "Senior Engineer", vagas);

    // Shape compativel com ScoreSnapshot.subScores
    expect(r.sub_scores.aderencia_vagas.valor).toBeGreaterThan(0);
    expect(r.sub_scores.relevancia_habilidades.valor).toBeGreaterThan(0);
    expect(r.sub_scores.otimizacao_perfil.valor).toBeGreaterThan(0);
    expect(r.sub_scores.experiencia_mercado.valor).toBeGreaterThan(0);

    // _meta carrega insumos
    expect(r.sub_scores.aderencia_vagas._meta).toBeDefined();
    expect(r.sub_scores.experiencia_mercado._meta.anos_estimados).toBeGreaterThan(0);

    // Overall = soma ponderada
    const manual =
      r.sub_scores.aderencia_vagas.valor * WEIGHTS.aderencia_vagas +
      r.sub_scores.relevancia_habilidades.valor * WEIGHTS.relevancia_habilidades +
      r.sub_scores.otimizacao_perfil.valor * WEIGHTS.otimizacao_perfil +
      r.sub_scores.experiencia_mercado.valor * WEIGHTS.experiencia_mercado;
    expect(r.overall).toBe(Math.round(manual));
  });

  it("perfil vazio + sem vagas = overall proximo de zero", () => {
    // experiencia_mercado tem baseline 40 (sem dado) — gera ~2 pts no overall.
    // E proposital: indica "nao avaliavel" sem zerar tudo.
    const r = computeAllSubScores({}, "X", []);
    expect(r.overall).toBeLessThan(10);
    expect(r.sub_scores.aderencia_vagas.valor).toBe(0);
    expect(r.sub_scores.relevancia_habilidades.valor).toBe(0);
    expect(r.sub_scores.otimizacao_perfil.valor).toBe(0);
  });

  it("e deterministico: mesma entrada = mesma saida", () => {
    const profile = { skills: ["Python", "SQL"], rawCv: "2015 a 2024" };
    const vagas = [{ titulo: "Python Dev", descricao: "python sql" }];
    const a = computeAllSubScores(profile, "Python Dev", vagas);
    const b = computeAllSubScores(profile, "Python Dev", vagas);
    expect(a).toEqual(b);
  });
});
