// lib/scoring/adherence.js
// Modulo unico para o calculo deterministico de aderencia (perfil x mercado).
//
// Existem DUAS metricas distintas — eram fundidas em "adherence" / "valor"
// antes da auditoria 2026-06-29 e isso quebrava o pitch "numero auditavel"
// porque /gaps mostrava um numero, /transparencia mostrava outro.
//
// Decisao pos-auditoria: aceitar que sao metricas distintas com semantica
// diferente, renomear, documentar, manter ambas. Vide
// docs/fluxos/auditoria/29062026/gandalf-auditoria-gaps.md secao 8+.
//
// adherenceTop   — peso cognitivo. "% das skills criticas que voce cobre".
//                  Janela top-N (default 18). Pondera por pct normalizado.
//                  Usado em /gaps KPI strip.
//
// adherenceMarket — peso estatistico. "% do mercado total que voce endereca".
//                   Pool inteiro. Pondera por freq bruta.
//                   Usado em ScoreSnapshot.sub_scores.aderencia_vagas (40%
//                   do Career Health Score).
//
// Ambas operam sobre o MESMO insumo (jobs[]) — agregamos UMA vez via
// _aggregateSkillFrequency() e derivamos as duas. Garante coerencia
// (mesmo pool, mesma extracao) e remove a duplicacao de 4 sites historica.

import { extractSkills } from "@/lib/skills-taxonomy";

function lower(s) {
  return String(s || "").toLowerCase();
}

function clamp01to100(n) {
  return Math.max(0, Math.min(100, n));
}

/**
 * Normaliza skills do perfil para set lower-case + canonicos via taxonomia.
 * Cobre o caso "skill em PT-BR no perfil, alias canonico nas vagas" (e
 * vice-versa) — extractSkills resolve ambos os lados pra mesma representacao.
 */
function buildProfileSkillSet(profileSkills) {
  const raw = (Array.isArray(profileSkills) ? profileSkills : [])
    .map(lower)
    .filter(Boolean);
  const set = new Set(raw);
  // Resolve aliases — "react.js" no perfil vira "React" canonico, etc.
  for (const c of extractSkills(raw.join(" "))) set.add(lower(c));
  return set;
}

/**
 * Agrega frequencia de skills pela colecao de vagas.
 * Retorna Map<skillLowerCase, { count, freq, pct }>.
 *   - count : numero de vagas que pedem a skill
 *   - freq  : alias para count (legacy nome usado em subscores)
 *   - pct   : count/totalJobs * 100 (inteiro)
 */
export function _aggregateSkillFrequency(jobs) {
  const map = new Map();
  const list = Array.isArray(jobs) ? jobs : [];
  for (const j of list) {
    const skills = extractSkills(`${j?.titulo || ""} ${j?.descricao || ""}`);
    for (const sk of skills) {
      const key = lower(sk);
      const cur = map.get(key) || { count: 0 };
      cur.count++;
      map.set(key, cur);
    }
  }
  const totalJobs = list.length;
  for (const v of map.values()) {
    v.freq = v.count;
    v.pct = totalJobs > 0 ? Math.round((v.count / totalJobs) * 100) : 0;
  }
  return map;
}

/**
 * adherenceTop — janela cognitiva (default top-18).
 * "% das skills criticas do mercado que voce cobre."
 *
 * Algoritmo:
 *   1. Agrega skill->count nas vagas.
 *   2. Ordena por count desc, corta em topN.
 *   3. adherence = Σ(pct das skills no topN que user TEM) / Σ(pct do topN total) * 100
 *
 * Pesa por pct (count normalizado). Skill em 90% das vagas pesa ~9x mais
 * que skill em 10%. Saturacao implicita pelo corte topN.
 *
 * Retorno:
 *   {
 *     adherence: number(0..100),  // metrica final
 *     requirements: [{ name, count, pct, status }, ...],  // topN ordenada
 *     skillsHave: number,
 *     skillsRequired: number,     // === requirements.length (≤ topN)
 *     highPriorityGaps: number    // skills no topN em >=hpThreshold% que user nao tem
 *   }
 */
export function computeAdherenceTop(profileSkills, jobs, opts = {}) {
  const topN = opts.topN ?? 18;
  const hpThreshold = opts.highPriorityThreshold ?? 70; // percentual
  const profileSet = buildProfileSkillSet(profileSkills);
  const agg = _aggregateSkillFrequency(jobs);

  const requirements = Array.from(agg.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      pct: v.pct,
      status: profileSet.has(name) ? "have" : "missing",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  const totalWeight = requirements.reduce((s, r) => s + r.pct, 0);
  const matchedWeight = requirements
    .filter((r) => r.status === "have")
    .reduce((s, r) => s + r.pct, 0);
  const adherence = totalWeight > 0
    ? Math.round(clamp01to100((matchedWeight / totalWeight) * 100))
    : 0;

  const skillsHave = requirements.filter((r) => r.status === "have").length;
  const highPriorityGaps = requirements.filter(
    (r) => r.status === "missing" && r.pct >= hpThreshold,
  ).length;

  return {
    adherence,
    requirements,
    skillsHave,
    skillsRequired: requirements.length,
    highPriorityGaps,
  };
}

/**
 * adherenceMarket — pool inteiro, pondera por freq bruta.
 * "% do mercado total que voce endereca."
 *
 * Algoritmo:
 *   1. Agrega skill->freq nas vagas (sem corte).
 *   2. adherence = Σ(freq das skills que user TEM) / Σ(freq total) * 100
 *
 * Captura long-tail (skill rara em 1 vaga ainda conta), mas com vies
 * conhecido: skill emergente em 1 vaga pesa 1/Σfreq do pool. Aceitavel
 * porque o overall Career Health Score ja tem 4 dimensoes que compensam.
 *
 * Retorno:
 *   {
 *     adherence: number(0..100),
 *     n_vagas: number,
 *     comuns: number  // skills do user que aparecem no pool
 *   }
 */
export function computeAdherenceMarket(profileSkills, jobs) {
  const profileSet = buildProfileSkillSet(profileSkills);
  const list = Array.isArray(jobs) ? jobs : [];

  if (profileSet.size === 0 || list.length === 0) {
    return { adherence: 0, n_vagas: list.length, comuns: 0 };
  }

  const agg = _aggregateSkillFrequency(list);
  if (agg.size === 0) {
    return { adherence: 0, n_vagas: list.length, comuns: 0 };
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  let comuns = 0;
  for (const [skill, v] of agg.entries()) {
    totalWeight += v.freq;
    if (profileSet.has(skill)) {
      matchedWeight += v.freq;
      comuns++;
    }
  }

  const adherence = totalWeight > 0
    ? Math.round(clamp01to100((matchedWeight / totalWeight) * 100))
    : 0;

  return { adherence, n_vagas: list.length, comuns };
}
