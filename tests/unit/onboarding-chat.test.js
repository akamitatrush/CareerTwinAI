// Tests da logica do onboarding conversacional (components/OnboardingChat.js).
//
// Escopo: so a logica pura (buildCv + estrutura de QUESTIONS). Render do
// componente fica pra e2e — exige DOM/React renderer e nao pertence aqui.
//
// O que defendemos:
//  1. buildCv concatena os campos preenchidos na ordem esperada
//  2. campos vazios/whitespace sao pulados (nao geram secao vazia)
//  3. QUESTIONS tem entre 5-6 perguntas validas (id/text/inputType)
//  4. nao ha ids duplicados em QUESTIONS

import { describe, it, expect } from "vitest";
// Importa direto da logic (pure JS, sem JSX) pra vitest env=node poder
// resolver sem precisar de plugin React.
import { buildCv, QUESTIONS } from "@/components/OnboardingChat.logic";

describe("buildCv", () => {
  it("concatena todos os campos preenchidos em texto plano estruturado", () => {
    const cv = buildCv({
      name: "Maria Silva",
      currentRole: "Desenvolvedora Backend Pleno",
      years: "5",
      skills: "Python, SQL, AWS, Docker, React",
      achievements: "Reduzi tempo de query em 60%.",
      education: "Bacharel em CC pela USP.",
    });
    expect(cv).toContain("Maria Silva");
    expect(cv).toContain("Desenvolvedora Backend Pleno");
    expect(cv).toContain("5 anos de experiência");
    expect(cv).toContain("HABILIDADES:\nPython, SQL, AWS, Docker, React");
    expect(cv).toContain("CONQUISTAS:\nReduzi tempo de query em 60%.");
    expect(cv).toContain("FORMAÇÃO:\nBacharel em CC pela USP.");
  });

  it("respeita a ordem: nome -> cargo -> anos -> habilidades -> conquistas -> formacao", () => {
    const cv = buildCv({
      name: "Ana",
      currentRole: "PM",
      years: "3",
      skills: "Discovery",
      achievements: "Lancei MVP em 2 meses",
      education: "FGV",
    });
    const idxNome = cv.indexOf("Ana");
    const idxCargo = cv.indexOf("PM");
    const idxAnos = cv.indexOf("3 anos");
    const idxSkills = cv.indexOf("HABILIDADES");
    const idxConquistas = cv.indexOf("CONQUISTAS");
    const idxFormacao = cv.indexOf("FORMAÇÃO");
    expect(idxNome).toBeLessThan(idxCargo);
    expect(idxCargo).toBeLessThan(idxAnos);
    expect(idxAnos).toBeLessThan(idxSkills);
    expect(idxSkills).toBeLessThan(idxConquistas);
    expect(idxConquistas).toBeLessThan(idxFormacao);
  });

  it("pula campos vazios sem deixar secoes vazias no resultado", () => {
    const cv = buildCv({
      name: "Joao",
      currentRole: "Dev",
      years: "2",
      skills: "JS",
      achievements: "X",
      // education ausente — eh o campo opcional
    });
    expect(cv).not.toContain("FORMAÇÃO:");
    expect(cv).toContain("Joao");
    expect(cv).toContain("HABILIDADES:");
  });

  it("trata strings so com espacos como vazias (pula a secao)", () => {
    const cv = buildCv({
      name: "Bia",
      currentRole: "PO",
      years: "4",
      skills: "Product",
      achievements: "Sim",
      education: "   ",
    });
    expect(cv).not.toContain("FORMAÇÃO:");
  });

  it("aceita objeto vazio sem crashar", () => {
    expect(() => buildCv({})).not.toThrow();
    expect(buildCv({})).toBe("");
  });

  it("aceita undefined/null sem crashar", () => {
    expect(() => buildCv(undefined)).not.toThrow();
    expect(() => buildCv(null)).not.toThrow();
    expect(buildCv(undefined)).toBe("");
    expect(buildCv(null)).toBe("");
  });

  it("faz trim nos valores ao concatenar", () => {
    const cv = buildCv({
      name: "  Maria  ",
      currentRole: " Dev ",
      years: " 5 ",
      skills: " Python ",
      achievements: " Foo ",
      education: " Bar ",
    });
    // Nao deve sobrar trailing/leading space nas linhas geradas
    expect(cv).toMatch(/^Maria/);
    expect(cv).toContain("Dev\n");
    expect(cv).toContain("5 anos de experiência");
    expect(cv).toContain("HABILIDADES:\nPython");
    expect(cv).toContain("CONQUISTAS:\nFoo");
    expect(cv).toContain("FORMAÇÃO:\nBar");
  });
});

describe("QUESTIONS", () => {
  it("tem entre 5 e 8 perguntas (escopo do MVP)", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(5);
    expect(QUESTIONS.length).toBeLessThanOrEqual(8);
  });

  it("cada pergunta tem id (string nao vazia), text e inputType valido", () => {
    const validTypes = new Set(["text", "textarea"]);
    for (const q of QUESTIONS) {
      expect(typeof q.id).toBe("string");
      expect(q.id.length).toBeGreaterThan(0);
      expect(typeof q.text).toBe("string");
      expect(q.text.length).toBeGreaterThan(0);
      expect(validTypes.has(q.inputType)).toBe(true);
      expect(typeof q.required).toBe("boolean");
    }
  });

  it("nao ha ids duplicados (impediria buildCv de funcionar)", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("inclui pelo menos as perguntas essenciais (name, currentRole, skills, achievements)", () => {
    const ids = new Set(QUESTIONS.map((q) => q.id));
    expect(ids.has("name")).toBe(true);
    expect(ids.has("currentRole")).toBe(true);
    expect(ids.has("skills")).toBe(true);
    expect(ids.has("achievements")).toBe(true);
  });

  it("todas as perguntas obrigatorias vem antes das opcionais (UX: nao bloqueia no final)", () => {
    // Garante que se chegar ate a ultima pergunta, ela eh opcional OU
    // todas anteriores tambem foram obrigatorias. Simplificacao: se ha
    // alguma opcional, nao pode haver uma obrigatoria depois dela.
    let sawOptional = false;
    for (const q of QUESTIONS) {
      if (!q.required) sawOptional = true;
      else if (sawOptional) {
        throw new Error(`Pergunta obrigatoria "${q.id}" vem depois de uma opcional`);
      }
    }
  });
});
