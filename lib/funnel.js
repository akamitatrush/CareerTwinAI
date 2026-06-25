// Funnel Analyzer — logica pura, sem LLM.
//
// Inspirado no caso real Jamar Martins (Sr/Group PM, 7 meses sem job). Toda
// historia de "candidato em transicao forcada que nao consegue avancar" cai
// num de 4 buracos:
//   1. CV/posicionamento  -> triagem rejeita 95%+ das candidaturas
//   2. Triagem -> HM       -> recrutador adora mas nao passa pra hiring manager
//   3. HM -> final         -> chega no HM mas nao convence
//   4. Final -> offer      -> chega no final mas nao recebe offer
//
// Sem isolar qual estagio, qualquer ferramenta de melhoria e tiro no escuro.
// Esta lib pega os numeros agregados e detecta deterministicamente em qual
// estagio o user esta parando — sem LLM, sem ambiguidade.
//
// Politica de severidade:
//   - "high"   = gargalo claro, taxa muito abaixo do esperado (=primary action)
//   - "medium" = sinal mas amostra pequena ou taxa razoavel
//   - "low"    = funil saudavel, foco em volume
//
// Limites tecnicos do funil (baselines empiricos do mercado tech BR/US 2024):
//   - triagem CV->callback:  >= 5%  e mediana saudavel
//   - callback->HM:           >= 30% e saudavel
//   - HM->final:              >= 30% e saudavel
//   - final->offer:           >= 40% e saudavel

// Threshold de volume minimo pra ter dados estatisticos. Abaixo disso, qualquer
// taxa e ruido. 5 vagas/semana e patamar minimo de busca ativa.
const MIN_APPLICATIONS = 5;

// Thresholds das taxas de conversao por estagio. Valores empiricos — quando
// user fica abaixo disso, e gargalo. Mantemos os limites como constantes
// nomeadas pra que tests/UI possam referenciar e nao haja drift de "numero
// magico" no codigo.
export const THRESHOLDS = {
  triagem: 0.05, // 5% callback rate e o piso aceitavel
  hm: 0.3, // 30% callback -> HM
  final: 0.3, // 30% HM -> final
  offer: 0.4, // 40% final -> offer
};

/**
 * Soma as ultimas N entries (ordenadas por weekStart desc — ou seja, [0] e a
 * mais recente). Aceita lista em qualquer ordem porque so soma; entries com
 * campos missing/null sao tratadas como 0.
 *
 * @param {Array} entries - lista de FunnelEntry
 * @param {number} n - quantas entries somar (default 4)
 * @returns {{applications,callbacks,hmConversations,finals,offers}}
 */
export function aggregateLastNWeeks(entries, n = 4) {
  // Defesa: aceita null/undefined/non-array sem explodir.
  const list = Array.isArray(entries) ? entries.slice(0, n) : [];
  const acc = {
    applications: 0,
    callbacks: 0,
    hmConversations: 0,
    finals: 0,
    offers: 0,
  };
  for (const e of list) {
    if (!e) continue;
    acc.applications += Number(e.applications) || 0;
    acc.callbacks += Number(e.callbacks) || 0;
    acc.hmConversations += Number(e.hmConversations) || 0;
    acc.finals += Number(e.finals) || 0;
    acc.offers += Number(e.offers) || 0;
  }
  return acc;
}

/**
 * Calcula taxas de conversao por estagio. Divisao por zero -> null pra rate
 * especifica (sem dado = nao da pra avaliar).
 *
 * Retorna fracoes (0..1), nao porcentagens. UI multiplica por 100 pra exibir.
 */
export function calculateRates(aggregated) {
  const a = aggregated || {};
  const apps = Number(a.applications) || 0;
  const cbs = Number(a.callbacks) || 0;
  const hms = Number(a.hmConversations) || 0;
  const fns = Number(a.finals) || 0;
  const ofs = Number(a.offers) || 0;

  return {
    triagemRate: apps > 0 ? cbs / apps : null,
    hmRate: cbs > 0 ? hms / cbs : null,
    finalRate: hms > 0 ? fns / hms : null,
    offerRate: fns > 0 ? ofs / fns : null,
  };
}

/**
 * Detecta o estagio gargalo (primeiro estagio com taxa abaixo do threshold,
 * lendo o funil de cima pra baixo).
 *
 * Recebe o agregado (nao a entry individual) — bottleneck so faz sentido com
 * volume agregado de algumas semanas (sample size pra estatistica).
 *
 * Retorna { stage, severity, suggestion, link, rates }.
 *
 *  stage    — id do estagio gargalo (volume|triagem|hm|final|offer|saudavel)
 *  severity — "low"|"medium"|"high" pra colorir UI
 *  suggestion — frase em PT-BR explicando o que provavelmente esta acontecendo
 *  link     — rota interna do CareerTwin com microacao relevante
 *  rates    — taxas calculadas (pra UI exibir junto)
 */
export function analyzeBottleneck(aggregated) {
  const a = aggregated || {};
  const apps = Number(a.applications) || 0;
  const rates = calculateRates(a);

  // 1. Volume baixo. Sem amostra, qualquer taxa e ruido.
  if (apps < MIN_APPLICATIONS) {
    return {
      stage: "volume",
      severity: "high",
      suggestion:
        "Volume baixo demais pra avaliar. Aumente pra pelo menos 5 candidaturas/semana — sem amostra, qualquer taxa e ruido estatistico.",
      link: "/oportunidades",
      rates,
    };
  }

  // 2. Gargalo CV/posicionamento. Triagem rejeita 95%+.
  if (rates.triagemRate !== null && rates.triagemRate < THRESHOLDS.triagem) {
    return {
      stage: "triagem",
      severity: "high",
      suggestion:
        "Gargalo no CV/posicionamento. Triagem esta rejeitando 95%+ — ou o CV nao bate com o que a vaga pede, ou voce esta aplicando pra vagas erradas. Comece refazendo o headline e os bullets de impacto.",
      link: "/cvs-adaptados",
      rates,
    };
  }

  // 3. Gargalo na conversa com recrutador. Callback mas sem HM.
  if (rates.hmRate !== null && rates.hmRate < THRESHOLDS.hm) {
    return {
      stage: "hm",
      severity: "high",
      suggestion:
        "Gargalo na conversa com recrutador. Voce passa na triagem mas nao avanca pro hiring manager — pode ser tag de overqualified, pitch desalinhado ou pretensao salarial fora da faixa. Revise como voce apresenta seu cargo-alvo e expectativa.",
      link: "/autoconhecimento",
      rates,
    };
  }

  // 4. Gargalo no hiring manager. Storytelling de impacto fraco.
  if (rates.finalRate !== null && rates.finalRate < THRESHOLDS.final) {
    return {
      stage: "final",
      severity: "high",
      suggestion:
        "Gargalo no hiring manager. Chega no HM mas nao avanca pro final — storytelling de impacto provavelmente esta fraco. Estruture cases com contexto-acao-resultado e metrica clara. Adicione mais Evidencias.",
      link: "/evidencias",
      rates,
    };
  }

  // 5. Gargalo no fechamento. Chega no final mas nao recebe offer.
  if (rates.offerRate !== null && rates.offerRate < THRESHOLDS.offer) {
    return {
      stage: "offer",
      severity: "medium",
      suggestion:
        "Gargalo no fechamento. Voce chega no final mas nao recebe offer — pode ser comp fora da faixa, fit cultural percebido ou negociacao. Treine entrevista final com cases similares ao seu cargo-alvo.",
      link: "/plano",
      rates,
    };
  }

  // 6. Funil saudavel. Volume baixo e o unico problema se for o caso.
  return {
    stage: "saudavel",
    severity: "low",
    suggestion:
      "Funil saudavel — taxas estao dentro do esperado em todos os estagios. Foque em aumentar volume de candidaturas qualificadas e mantenha o ritmo. Voce esta no caminho certo.",
    link: "/oportunidades",
    rates,
  };
}

/**
 * Calcula a segunda-feira 00:00 UTC da semana de uma data dada (ISO week).
 *
 * weekStart e um campo canonical: dado qualquer dia da semana N, sempre
 * retorna o mesmo timestamp (a Segunda dessa semana, em UTC). Isso permite
 * upsert atomico em (userId, weekStart) sem que o user crie duplicatas pra
 * mesma semana usando dias diferentes.
 *
 * Por que UTC: evitar drift por timezone. Se um user em SP submete domingo
 * 23:00 (que e Segunda 02:00 UTC), queremos que caia na MESMA semana que
 * uma submissao na Segunda local — semana ISO comeca na Segunda UTC.
 *
 * @param {Date} [date] - default Date.now()
 * @returns {Date}
 */
export function startOfWeekUTC(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date();
  // getUTCDay: 0=Domingo, 1=Segunda, ..., 6=Sabado.
  const day = d.getUTCDay();
  // Quantos dias voltar pra cair na Segunda. Se hoje e Segunda (1) -> 0.
  // Se Domingo (0) -> 6 (volta 6 dias pra Segunda da semana anterior).
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
