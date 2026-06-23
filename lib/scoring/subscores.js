// lib/scoring/subscores.js
// Calculo deterministico dos 4 sub-scores que compoem o Career Health Score.
//
// Por que existe: o pitch central do produto e "numero = calculo auditavel,
// texto = explicacao com fonte". Se a LLM gerar os numeros, o numero perde
// auditabilidade (LLM nao e deterministica) e a tela /transparencia mente.
// Entao: a LLM so explica/contextualiza; QUEM CALCULA E ESTE MODULO.
//
// Cada funcao e pura (sem side effects, sem fetch, sem prisma). Recebe o
// perfil estruturado + insumos (vagas, role) e devolve { valor, _meta }
// onde _meta carrega os insumos usados no calculo — util pra auditoria/UI.

import { extractSkills } from "@/lib/skills-taxonomy";
import { computeCompleteness } from "@/lib/metrics/completeness";
import { WEIGHTS } from "@/lib/score";

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function lower(s) {
  return String(s || "").toLowerCase();
}

/**
 * 1. ADERENCIA A VAGAS (peso 40%)
 * Mede quanto o perfil cobre as skills exigidas pelo mercado para o cargo-alvo.
 *
 * Algoritmo: TF-like ponderado por frequencia.
 *  - Pra cada vaga, extrai skills canonicas via extractSkills(titulo+descricao).
 *  - Conta quantas vagas pedem cada skill (freq).
 *  - Score = soma(freq das skills que o user TEM) / soma(freq de todas as skills) * 100.
 *
 * Por que peso por frequencia: skill pedida em 90% das vagas conta mais que
 * skill pedida em 5%. Reflete "quanto o mercado real exige". Coerente com
 * /api/gaps/summary (mesma filosofia: total ponderado).
 */
export function computeAderenciaVagas(profile, jobs) {
  const profileSkills = new Set(
    (Array.isArray(profile?.skills) ? profile.skills : []).map(lower).filter(Boolean)
  );
  if (profileSkills.size === 0 || !Array.isArray(jobs) || jobs.length === 0) {
    return { valor: 0, n_vagas: Array.isArray(jobs) ? jobs.length : 0, comuns: 0 };
  }

  // extractSkills retorna nomes CANONICOS (ex.: "SQL"). Comparamos lowercase
  // contra um set normalizado das skills do perfil. Pra cair em match temos
  // de incluir tanto a chave canonica quanto aliases — extractSkills no perfil
  // resolve isso de forma simetrica (extrai canonicos do texto do perfil).
  const canonicalProfileSkills = new Set(
    extractSkills(Array.from(profileSkills).join(" ")).map(lower)
  );
  // Garante que skills sem alias na taxonomia ainda entrem por string literal.
  for (const s of profileSkills) canonicalProfileSkills.add(s);

  const skillFreq = new Map(); // canonical_lower -> freq
  for (const j of jobs) {
    const text = `${j?.titulo || ""} ${j?.descricao || ""}`;
    const skills = extractSkills(text);
    for (const sk of skills) {
      const key = lower(sk);
      skillFreq.set(key, (skillFreq.get(key) || 0) + 1);
    }
  }

  if (skillFreq.size === 0) {
    return { valor: 0, n_vagas: jobs.length, comuns: 0 };
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  let comuns = 0;
  for (const [skill, freq] of skillFreq.entries()) {
    totalWeight += freq;
    if (canonicalProfileSkills.has(skill)) {
      matchedWeight += freq;
      comuns++;
    }
  }

  const raw = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0;
  return {
    valor: Math.round(clamp(raw, 0, 100)),
    n_vagas: jobs.length,
    comuns,
  };
}

/**
 * 2. RELEVANCIA DAS HABILIDADES (peso 30%)
 * Mede a QUALIDADE das skills declaradas, independente do mercado:
 *  - Count score (40%): quantas skills (satura em 10).
 *  - Validity score (40%): % das skills que sao reconheciveis na taxonomia.
 *  - Diversity score (20%): % de skills unicas (penaliza duplicacao).
 *
 * Por que 40/40/20: a quantidade e validez sao igualmente importantes
 * (10 skills "tudo igual" nao vale o mesmo que 10 skills validas e variadas).
 * Diversidade pesa menos porque ja e indiretamente medida pela validez.
 */
export function computeRelevanciaHabilidades(profile) {
  const skills = Array.isArray(profile?.skills) ? profile.skills.filter(Boolean) : [];
  if (skills.length === 0) {
    return { valor: 0, total: 0, validas: 0 };
  }

  // Count: satura em 10 skills (mais que isso vira ruido em CV/perfil).
  const countScore = Math.min(skills.length / 10, 1) * 100;

  // Validity: passa o texto consolidado pela taxonomia. Skills genericas
  // (ex.: "comunicacao") nao serao reconhecidas — isso e proposital.
  const recognized = extractSkills(skills.join(" "));
  const validity = skills.length > 0 ? Math.min(recognized.length / skills.length, 1) * 100 : 0;

  // Diversity: % de unicos. Lista com duplicatas ("Python, python, PYTHON")
  // baixa esse componente.
  const uniques = new Set(skills.map(lower)).size;
  const diversity = (uniques / skills.length) * 100;

  const raw = 0.4 * countScore + 0.4 * validity + 0.2 * diversity;
  return {
    valor: Math.round(clamp(raw, 0, 100)),
    total: skills.length,
    validas: recognized.length,
  };
}

/**
 * 3. OTIMIZACAO DO PERFIL (peso 20%)
 * Quao completo esta o perfil estruturado (CV, role-alvo, LinkedIn, GitHub etc).
 * Reusa computeCompleteness — fonte unica da verdade pra "completude".
 *
 * Se o perfil que chega aqui ainda nao foi persistido (caminho /api/analyze
 * efemero ou logado), montamos um perfil sintetico com os campos extraidos
 * pela LLM + os insumos disponiveis.
 */
export function computeOtimizacaoPerfil(profile) {
  const { percent, missing } = computeCompleteness(profile);
  return { valor: percent, missing_count: missing.length };
}

/**
 * 4. EXPERIENCIA DE MERCADO (peso 10%)
 * Estima anos de experiencia (parse de datas no CV) + match com o cargo-alvo.
 *  - Years score (60%): max(year) - min(year) no CV, satura em 10 anos.
 *  - Seniority match (40%): senioridade declarada x senioridade pedida no role.
 *
 * Por que 60/40: anos sao um sinal mais forte que senioridade declarada
 * (que e auto-rotulada e ruidosa). Limitacao: regex de 4 digitos pega datas
 * "20XX" — funciona pra ~90% dos CVs em PT/EN mas falha em "junho/24" ou
 * "abril de 2020". Aceitavel pra Fase 2.
 */
export function computeExperienciaMercado(profile, targetRole) {
  const cv = String(profile?.rawCv || "");
  const currentYear = new Date().getFullYear();
  const yearMatches = cv.match(/(19\d{2}|20\d{2})/g) || [];
  const years = yearMatches
    .map(Number)
    .filter((y) => y >= 1990 && y <= currentYear);

  let totalYears = 0;
  if (years.length >= 2) {
    totalYears = Math.max(...years) - Math.min(...years);
    totalYears = clamp(totalYears, 0, 40);
  } else if (years.length === 1) {
    // So um ano no CV — conta o tempo desde entao (caso tipico: "iniciou em 2022").
    totalYears = clamp(currentYear - years[0], 0, 40);
  }

  // Satura em 10 anos: alem disso, anos extras nao melhoram empregabilidade
  // diretamente (mercado prefere skills atualizadas a tempo de servico).
  const yearsScore = Math.min(totalYears / 10, 1) * 100;

  // Match senioridade declarada vs implicada no cargo-alvo.
  const sen = lower(profile?.senioridade);
  const role = lower(targetRole);
  let seniorityMatch = 50; // baseline neutro: sem dado suficiente pros 2 lados.

  const roleSenior = /\b(senior|sr\.?|lead|head|staff|principal|coord|gerent|diret|chief)/.test(role);
  const roleJunior = /\b(junior|jr\.?|estagi|trainee|aprendiz)/.test(role);

  const userSenior = /sen|especial|lead|coord|gerent|diret|chief|head/.test(sen);
  const userJunior = /jun|estag|trainee|aprendiz/.test(sen);
  const userPleno = /pleno|mid|mid-level/.test(sen);

  if (roleSenior && userSenior) seniorityMatch = 100;
  else if (roleJunior && userJunior) seniorityMatch = 100;
  else if (userPleno && !roleSenior && !roleJunior) seniorityMatch = 90;
  else if (userSenior && roleJunior) seniorityMatch = 60; // over-qualified
  else if (userJunior && roleSenior) seniorityMatch = 25; // under-qualified
  else if (sen && !roleSenior && !roleJunior) seniorityMatch = 75;
  else if (!sen) seniorityMatch = 40;

  const raw = 0.6 * yearsScore + 0.4 * seniorityMatch;
  return {
    valor: Math.round(clamp(raw, 0, 100)),
    anos_estimados: totalYears,
    senioridade: profile?.senioridade || null,
  };
}

/**
 * Orchestrator: computa os 4 sub-scores + overall ponderado.
 * Shape de retorno e compativel com ScoreSnapshot.subScores existente
 * (UI le `valor` e `explicacao` por sub-score — `explicacao` e mergeada
 * em /api/analyze a partir da LLM, NAO aqui).
 *
 * Nao e async — orchestrator puro, sem I/O. Caller (analyze route) ja
 * tem `jobs` em memoria via searchJobs.
 */
export function computeAllSubScores(profile, targetRole, jobs) {
  const aderencia = computeAderenciaVagas(profile, jobs);
  const relevancia = computeRelevanciaHabilidades(profile);
  const otimizacao = computeOtimizacaoPerfil(profile);
  const experiencia = computeExperienciaMercado(profile, targetRole);

  const overall = Math.round(
    aderencia.valor * WEIGHTS.aderencia_vagas +
      relevancia.valor * WEIGHTS.relevancia_habilidades +
      otimizacao.valor * WEIGHTS.otimizacao_perfil +
      experiencia.valor * WEIGHTS.experiencia_mercado
  );

  return {
    sub_scores: {
      aderencia_vagas: { valor: aderencia.valor, _meta: aderencia },
      relevancia_habilidades: { valor: relevancia.valor, _meta: relevancia },
      otimizacao_perfil: { valor: otimizacao.valor, _meta: otimizacao },
      experiencia_mercado: { valor: experiencia.valor, _meta: experiencia },
    },
    overall,
  };
}
