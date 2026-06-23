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
//
// Campos UI-only (nao mudam payload nem schema):
// - intro: descricao curta (ja existia).
// - howTo: 3 dicas curtas de como pensar nas respostas (mostrado na pagina).
// - palette: "indigo" | "positive" | "attention" — define qual variavel CSS
//   dominante. Usado pra colorir card/hero/ícone sem hardcodar cor no JSX.
// - iconKind: "matrix" | "star" | "circles" — qual componente SVG renderizar.
// - narrative (DISC): texto interpretativo por quadrante dominante.
// - valueGroups (VALORES): combinacoes hardcoded -> narrativa + cargos
//   sugeridos. narrativeFor() faz match por overlap.
// - ikigaiSynthesis(answers): sintese textual baseada no nivel de completude.

export const DISC_LITE = {
  kind: "DISC_LITE",
  title: "Estilo comportamental no trabalho",
  intro:
    "12 perguntas pra mapear seu estilo em 4 quadrantes: Dominância (D), Influência (I), Estabilidade (S) e Conformidade (C). Resultado é informativo, não diagnóstico clínico.",
  palette: "indigo",
  iconKind: "matrix",
  howTo: [
    "Pense no seu estilo no dia a dia, não no que você acha que deveria ser.",
    "Não existe quadrante melhor — cada um tem força em contextos diferentes.",
    "Responda rápido: a primeira impressão costuma ser mais honesta que a racionalizada.",
  ],
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
  // informativa (nao diagnostica) ao lado do score. narrative = paragrafo de
  // sintese; careerHints = 3 bullets concretos de "como isso se traduz".
  quadrantLabels: {
    D: {
      name: "Dominância",
      desc: "Foco em resultado, autonomia, decisão rápida.",
      narrative:
        "Você tende a tomar decisões rápido, ser direto e gostar de desafios concretos. Em carreira, pode brilhar em ambientes de alta autonomia e ritmo — onde valorizam quem assume o resultado em vez de esperar consenso.",
      careerHints: [
        "Funções com autonomia e ownership claro (líder de squad, founder, gerência).",
        "Ambientes de alta velocidade — startup, time de growth, projetos com prazo curto.",
        "Cuidado: pode atropelar processo. Vale parear com alguém C ou S no time.",
      ],
    },
    I: {
      name: "Influência",
      desc: "Foco em pessoas, persuasão, energia social.",
      narrative:
        "Você se energiza com pessoas, comunica bem e convence sem esforço. Em carreira, costuma se destacar em papéis de articulação — vendas, gestão de stakeholders, evangelização de produto — onde rede e influência valem mais que cálculo solitário.",
      careerHints: [
        "Vendas, customer success, parcerias, dev advocacy, gestão de produto.",
        "Cargos que exijam network e pitch público — eventos, comunidades, mídia.",
        "Cuidado: pode subdimensionar follow-up. Sistema de tracking ajuda.",
      ],
    },
    S: {
      name: "Estabilidade",
      desc: "Foco em harmonia, consistência, apoio.",
      narrative:
        "Você gosta de previsibilidade, tem paciência pra processos longos e segura o time quando todo mundo está acelerado. Em carreira, sustenta operações complexas — produto maduro, plataforma, gestão de pessoas — onde consistência vale mais que improviso.",
      careerHints: [
        "Plataforma, infra, SRE, gestão de pessoas, operações maduras.",
        "Empresas estabelecidas, times grandes, ciclos de planejamento longos.",
        "Cuidado: pode evitar mudança quando ela é necessária. Force-se a opinar.",
      ],
    },
    C: {
      name: "Conformidade",
      desc: "Foco em precisão, dados, processo.",
      narrative:
        "Você confia em dado, gosta de detalhe e prefere analisar antes de agir. Em carreira, costuma ser quem evita erro caro e desenha sistemas que escalam — engenharia de dados, segurança, compliance, qualidade.",
      careerHints: [
        "Engenharia, dados, segurança, compliance, QA, finanças técnicas.",
        "Empresas com regulação forte, produto crítico, baixa tolerância a erro.",
        "Cuidado: pode atrasar decisão buscando dado perfeito. Defina cutoff.",
      ],
    },
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

// Grupos de valores hardcoded. Cada grupo tem ids "tipicos" + narrativa +
// cargos sugeridos. narrativeFor() faz match por overlap (maior intersecao
// ganha). Se nenhum bater bem (>= 2 ids comuns), cai num fallback generico.
//
// IMPORTANTE: ids usam o mesmo nome dos options (saude_mental nao saude-mental).
export const VALUE_GROUPS = {
  explorador: {
    match: ["autonomia", "criatividade", "aprendizado", "impacto", "proposito"],
    narrative:
      "Seu padrão sugere um perfil explorador — energizado por liberdade pra experimentar, aprender rápido e gerar impacto. Tende a se entediar em ambiente engessado e a brilhar quando tem espaço pra criar.",
    cargos: ["Product designer", "Tech lead em squad autônomo", "Founder/co-founder", "Pesquisador aplicado"],
  },
  estavel: {
    match: ["estabilidade", "equilibrio", "remuneracao", "saude_mental", "colaboracao"],
    narrative:
      "Seu padrão sugere um perfil estável — você valoriza qualidade de vida, previsibilidade financeira e times que colaboram sem drama. Trabalho não precisa ser sua identidade pra valer a pena.",
    cargos: ["Gestor sênior em produto maduro", "Especialista plataforma", "Consultor interno", "Tech lead em time estabelecido"],
  },
  lider: {
    match: ["lideranca", "reconhecimento", "desafio", "remuneracao", "impacto"],
    narrative:
      "Seu padrão sugere um perfil de liderança — você quer puxar gente, ser reconhecido pelo resultado e enfrentar problema duro. Tende a se frustrar quando não tem espaço pra dirigir o jogo.",
    cargos: ["Diretor de engenharia", "Gerente de área", "Head de produto", "Founder técnico"],
  },
  artesao: {
    match: ["desafio", "aprendizado", "autonomia", "criatividade", "reconhecimento"],
    narrative:
      "Seu padrão sugere um perfil artesão — você quer dominar um ofício, ser referência técnica e ter liberdade pra fazer bem-feito. Trade-offs são parte do prazer, não obstáculo.",
    cargos: ["Staff/principal engineer", "Arquiteto de soluções", "Especialista de domínio", "IC sênior em big tech"],
  },
  impacto: {
    match: ["impacto", "proposito", "diversidade", "colaboracao", "aprendizado"],
    narrative:
      "Seu padrão sugere um perfil de impacto — propósito, causa e gente são âncoras. Você costuma escolher empresa pela missão antes do salário, e tem energia pra puxar conversas difíceis.",
    cargos: ["Tech for good", "ONG/setor público", "Diversity & inclusion", "Educação/EdTech"],
  },
  inovador: {
    match: ["inovacao", "criatividade", "desafio", "autonomia", "aprendizado"],
    narrative:
      "Seu padrão sugere um perfil inovador — fronteira tecnológica, problema novo, e espaço pra arriscar. Você prefere construir algo que ainda não existe a operar algo já pronto.",
    cargos: ["R&D / labs", "Early-stage startup", "AI/ML engineer", "Tech preview / 0-to-1"],
  },
};

// Faz match dos ids selecionados contra cada grupo. Retorna { group, narrative,
// cargos, score } do melhor match. Se nenhum tiver pelo menos 2 ids em comum,
// retorna um fallback generico baseado nos primeiros 2 selecionados.
export function narrativeFor(selected) {
  if (!Array.isArray(selected) || selected.length === 0) {
    return {
      group: "indefinido",
      narrative:
        "Sem valores selecionados ainda. Escolha 5 e voltamos com uma leitura.",
      cargos: [],
      score: 0,
    };
  }
  const sel = new Set(selected);
  let best = null;
  Object.entries(VALUE_GROUPS).forEach(([key, group]) => {
    const overlap = group.match.filter((id) => sel.has(id)).length;
    if (!best || overlap > best.score) {
      best = { group: key, ...group, score: overlap };
    }
  });
  // Threshold: pelo menos 2 ids em comum pra dar narrativa especifica. Senao,
  // vira fallback generico (evita "vendedor" mostrando narrativa de "lider"
  // quando so bateu 1 id).
  if (!best || best.score < 2) {
    return {
      group: "misto",
      narrative:
        "Seu conjunto é eclético — não se encaixa num arquétipo fechado, e isso pode ser uma força. Vale revisitar os 5 e ver se algum não está ali por costume.",
      cargos: [],
      score: best?.score || 0,
    };
  }
  return best;
}

export const VALORES = {
  kind: "VALORES",
  title: "Seus valores mais fortes",
  intro:
    "Escolha até 5 valores que mais te representam no trabalho. Não há hierarquia entre eles. Sem certo ou errado — só reflexão sobre o que importa pra você.",
  palette: "positive",
  iconKind: "star",
  howTo: [
    "Pense no que você sentiria falta se sumisse — não no que soa bonito.",
    "Se ficar entre 6 e 7, pergunta: qual desses eu negocio? O que sobra é o seu núcleo.",
    "Não precisa ser estável pra vida toda. É um snapshot de agora.",
  ],
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

// Sintese textual do Ikigai baseada no nivel de completude. Recebe answers
// (objeto { ama, fazBem, mundoPrecisa, pagar }) e devolve string em pt-BR.
// 4 dimensoes cobertas -> sintese mais ousada; menos -> aponta lacuna.
const IKIGAI_DIMS = [
  { id: "ama", label: "paixão (o que ama)" },
  { id: "fazBem", label: "talento (o que faz bem)" },
  { id: "mundoPrecisa", label: "necessidade (o que o mundo precisa)" },
  { id: "pagar", label: "vocação econômica (pelo que pagariam)" },
];

export function ikigaiSynthesis(answers) {
  const filledIds = IKIGAI_DIMS.filter(
    (d) => String(answers?.[d.id] || "").trim().length >= 20,
  ).map((d) => d.id);
  const missing = IKIGAI_DIMS.filter((d) => !filledIds.includes(d.id));

  if (filledIds.length === 0) {
    return "Nenhuma das 4 dimensões foi preenchida ainda. Comece por uma — a mais fácil pra você — e siga adiante.";
  }
  if (filledIds.length === 4) {
    return "Você cruzou as 4 dimensões — paixão, talento, necessidade e vocação econômica. Quando todas se encontram, costuma emergir uma direção concreta: pense num projeto, papel ou problema que combina pelo menos 3 dessas respostas ao mesmo tempo. Esse é seu próximo passo.";
  }
  if (filledIds.length === 3) {
    const lacking = missing[0].label;
    return `Você cobriu 3 das 4 dimensões. Falta refletir sobre ${lacking} — sem isso, fica fácil acabar num trabalho que ama mas não sustenta, ou num que paga mas drena. Vale voltar.`;
  }
  if (filledIds.length === 2) {
    const lackingNames = missing.map((m) => m.label).join(" e ");
    return `Você refletiu sobre 2 das 4 dimensões. Falta cobrir ${lackingNames}. As 4 juntas formam o ikigai — com só 2, ainda é cedo pra sintetizar uma direção. Volte quando puder.`;
  }
  const dim = IKIGAI_DIMS.find((d) => d.id === filledIds[0])?.label || filledIds[0];
  return `Você começou pela ${dim}. É um primeiro passo — mas o ikigai aparece na intersecção. Sem as outras 3 dimensões, fica difícil tirar conclusão. Continue a reflexão quando puder.`;
}

export const IKIGAI = {
  kind: "IKIGAI",
  title: "Seu Ikigai — propósito profissional",
  intro:
    "Quatro perguntas abertas mapeando as 4 dimensões do Ikigai: o que você ama, o que faz bem, o que o mundo precisa, e pelo que pagariam. Reflita com calma — não há resposta certa.",
  palette: "attention",
  iconKind: "circles",
  howTo: [
    "Escreva como se contasse pra um amigo — sem polir, sem corrigir.",
    "Use exemplos concretos: projeto, momento, situação. Abstrato esconde a verdade.",
    "Tudo bem não responder as 4 hoje. Volte depois — o ikigai aparece na intersecção, não no campo.",
  ],
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
