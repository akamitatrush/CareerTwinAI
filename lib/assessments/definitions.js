// 3 mini-assessments de autoconhecimento.
//
// IMPORTANTE: NENHUM destes assessments e validado clinicamente. Sao
// inspirados em DISC, modelos de valores ocupacionais (Schein/Holland) e
// Ikigai — mas servem APENAS pra reflexao informacional. Nao substituem MBTI/
// DISC oficial, nem avaliacao psicologica profissional. O disclaimer aparece
// em TODAS as telas do modulo (listagem + cada assessment + resultado).
//
// computeScore() recebe `responses` (livre por tipo) e retorna `scores` (JSON
// que vai no AssessmentResult.scoresJson). Validacao basica de shape acontece
// na rota /api/assessments/[kind] — invalid input vira 400, nunca explode.

export const DISC_LITE = {
  kind: "DISC_LITE",
  title: "Estilo comportamental no trabalho",
  intro:
    "12 perguntas pra mapear seu estilo em 4 quadrantes: Dominância (D), Influência (I), Estabilidade (S) e Conformidade (C). Resultado é informativo, não diagnóstico clínico.",
  type: "likert",
  scale: { min: 1, max: 5, labels: ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"] },
  questions: [
    { id: "d1", text: "Gosto de tomar decisões rápidas e assumir o controle.", weights: { D: 1 } },
    { id: "d2", text: "Prefiro um trabalho desafiador que exija resultados rápidos.", weights: { D: 1 } },
    { id: "d3", text: "Sou direto/a ao ponto, mesmo que isso desagrade.", weights: { D: 1 } },
    { id: "i1", text: "Tenho facilidade em conhecer pessoas novas.", weights: { I: 1 } },
    { id: "i2", text: "Prefiro trabalhar em equipe a sozinho/a.", weights: { I: 1 } },
    { id: "i3", text: "Convenço facilmente os outros das minhas ideias.", weights: { I: 1 } },
    { id: "s1", text: "Sou paciente e tenho tolerância pra processos longos.", weights: { S: 1 } },
    { id: "s2", text: "Valorizo estabilidade e previsibilidade.", weights: { S: 1 } },
    { id: "s3", text: "Apoio colegas mesmo quando não me pedem.", weights: { S: 1 } },
    { id: "c1", text: "Sigo regras e procedimentos rigorosamente.", weights: { C: 1 } },
    { id: "c2", text: "Sou detalhista e busco precisão nos detalhes.", weights: { C: 1 } },
    { id: "c3", text: "Prefiro analisar dados antes de tomar decisão.", weights: { C: 1 } },
  ],
  // Espelha textos curtos por quadrante pra UI mostrar interpretacao
  // informativa (nao diagnostica) ao lado do score.
  quadrantLabels: {
    D: { name: "Dominância", desc: "Foco em resultado, autonomia, decisão rápida." },
    I: { name: "Influência", desc: "Foco em pessoas, persuasão, energia social." },
    S: { name: "Estabilidade", desc: "Foco em harmonia, consistência, apoio." },
    C: { name: "Conformidade", desc: "Foco em precisão, dados, processo." },
  },
  computeScore(responses) {
    // responses esperado: { d1: 1-5, d2: 1-5, ... }
    if (!responses || typeof responses !== "object") {
      throw new Error("responses_invalid");
    }
    const totals = { D: 0, I: 0, S: 0, C: 0 };
    this.questions.forEach((q) => {
      const raw = Number(responses[q.id]);
      // Clamp 1-5 (fail-safe). Se faltar = 0 (nao penaliza, apenas nao soma).
      const ans = Number.isFinite(raw) ? Math.max(1, Math.min(5, raw)) : 0;
      Object.entries(q.weights).forEach(([k, w]) => {
        totals[k] += ans * w;
      });
    });
    // Normaliza: 3 perguntas por quadrante, max=3*5=15, escala pra 0-100.
    Object.keys(totals).forEach((k) => {
      totals[k] = Math.round((totals[k] / 15) * 100);
    });
    return totals;
  },
};

export const VALORES = {
  kind: "VALORES",
  title: "Seus valores mais fortes",
  intro:
    "Escolha até 5 valores que mais te representam no trabalho. Não há hierarquia entre eles. Sem certo ou errado — só reflexão sobre o que importa pra você.",
  type: "multiselect",
  maxSelections: 5,
  options: [
    { id: "autonomia", label: "Autonomia" },
    { id: "criatividade", label: "Criatividade" },
    { id: "impacto", label: "Impacto social" },
    { id: "aprendizado", label: "Aprendizado contínuo" },
    { id: "estabilidade", label: "Estabilidade" },
    { id: "remuneracao", label: "Remuneração" },
    { id: "reconhecimento", label: "Reconhecimento" },
    { id: "equilibrio", label: "Equilíbrio vida-trabalho" },
    { id: "lideranca", label: "Liderança" },
    { id: "colaboracao", label: "Colaboração" },
    { id: "desafio", label: "Desafio técnico" },
    { id: "proposito", label: "Propósito maior" },
    { id: "autonomia_financeira", label: "Autonomia financeira" },
    { id: "saude_mental", label: "Saúde mental" },
    { id: "diversidade", label: "Diversidade" },
    { id: "inovacao", label: "Inovação" },
  ],
  computeScore(responses) {
    // responses esperado: array de ids (strings). Aceitamos { selected: [...] }
    // tambem (frontend pode mandar nos dois formatos).
    const arr = Array.isArray(responses)
      ? responses
      : Array.isArray(responses?.selected)
        ? responses.selected
        : null;
    if (!arr) throw new Error("responses_invalid");
    const validIds = new Set(this.options.map((o) => o.id));
    // Filtra ids invalidos (anti-injection: client mandar id nao listado).
    const selected = arr
      .filter((id) => typeof id === "string" && validIds.has(id))
      .slice(0, this.maxSelections); // teto duro
    return { selected };
  },
};

export const IKIGAI = {
  kind: "IKIGAI",
  title: "Seu Ikigai — propósito profissional",
  intro:
    "Quatro perguntas abertas mapeando as 4 dimensões do Ikigai: o que você ama, o que faz bem, o que o mundo precisa, e pelo que pagariam. Reflita com calma — não há resposta certa.",
  type: "openText",
  questions: [
    {
      id: "ama",
      text: "O que você AMA fazer?",
      hint: "Atividades, contextos, problemas que te energizam. Não precisa ser profissional.",
    },
    {
      id: "fazBem",
      text: "O que você FAZ BEM?",
      hint: "Habilidades reconhecidas pelos outros, conquistas concretas, feedbacks recorrentes.",
    },
    {
      id: "mundoPrecisa",
      text: "Que necessidade do MUNDO faz sentido pra você atender?",
      hint: "Causas, problemas sociais, dores de clientes, lacunas que você nota.",
    },
    {
      id: "pagar",
      text: "Pelo que o mercado/empresa estaria disposto a PAGAR você?",
      hint: "Habilidades comercializáveis, áreas em demanda, problemas com orçamento associado.",
    },
  ],
  computeScore(responses) {
    if (!responses || typeof responses !== "object") {
      throw new Error("responses_invalid");
    }
    // Score = completude. Resposta valida = >= 20 chars (evita "a", "sim").
    // Teto por campo = 4000 chars (anti-DoS, alinhado com outros validators).
    const out = {};
    let completion = 0;
    this.questions.forEach((q) => {
      const raw = String(responses[q.id] ?? "").trim().slice(0, 4000);
      out[q.id] = raw;
      if (raw.length >= 20) completion += 1;
    });
    return {
      answers: out,
      completion,
      total: this.questions.length,
      percent: Math.round((completion / this.questions.length) * 100),
    };
  },
};

export const ALL_ASSESSMENTS = [DISC_LITE, VALORES, IKIGAI];

export function getByKind(kind) {
  return ALL_ASSESSMENTS.find((a) => a.kind === kind);
}

// Ids permitidos como path param. Centralizado pra rota e UI lerem o mesmo
// conjunto e nada virar string magica.
export const ALLOWED_KINDS = ALL_ASSESSMENTS.map((a) => a.kind);

// Mapeia slug (path lowercase) -> kind (DB enum). UI usa /autoconhecimento/disc_lite.
export function kindFromSlug(slug) {
  if (typeof slug !== "string") return null;
  const upper = slug.toUpperCase();
  return ALLOWED_KINDS.includes(upper) ? upper : null;
}

export function slugFromKind(kind) {
  return typeof kind === "string" ? kind.toLowerCase() : "";
}
