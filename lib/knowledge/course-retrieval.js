// Lookup deterministico de cursos por skill com matching tolerante a acento,
// caixa e palavra parcial. Estatico: catalogo curado em ./courses.json.
//
// Por que deterministico (sem LLM)?
//  - Custo zero por requisicao (chamado em SSR de /gaps e em endpoint frequente).
//  - Resposta previsivel e auditavel (a gente sabe o que esta sugerindo).
//  - Curadoria humana > recomendacao alucinada de LLM pra cursos reais.
//
// O catalogo prioriza materiais GRATUITOS e formatos curtos (<40h ideal).
// Affiliate hook plugado: decorateUrl() agora consulta affiliate-config.js
// e adiciona o param de cada plataforma SE a env var correspondente estiver
// setada (sem env = link cru, comportamento backward-compat).

import courses from "./courses.json";
import { getAffiliateConfig } from "./affiliate-config";

// Normalizacao espelhando lib/skills-taxonomy.js: lowercase + strip de marcas
// combinantes Unicode. Reaproveita o mesmo range pra manter consistencia (se
// um dia trocarmos a normalizacao, troca nos dois lados). Tambem aplica trim
// pra defender contra payload com espacos sobrando.
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const ALL_COURSES = Array.isArray(courses) ? courses : [];

// Decora URL com param de afiliado SE a plataforma estiver mapeada em
// affiliate-config.js E a env var correspondente estiver setada. Sem isso,
// retorna URL crua -- preserva comportamento legacy.
export function decorateUrl(url, { provider, userId } = {}) {
  if (!url || typeof url !== "string") return url;

  const cfg = getAffiliateConfig(provider);
  if (!cfg) return url;

  try {
    const u = new URL(url);
    // Nao sobrescreve param existente (defesa: alguma URL pode ja ter ?ref
    // de campanha interna do proprio provider).
    if (!u.searchParams.has(cfg.param)) {
      u.searchParams.set(cfg.param, cfg.id);
    }
    return u.toString();
  } catch {
    // URL malformada: retorna como veio sem decorar (nao quebra UX).
    return url;
  }
}

// Score simples e estavel:
//  - skill alvo bate na lista c.skills (substring tolerante nos dois sentidos):
//    +10. Captura "python" -> ["python", "programacao", "fundamentos"] e
//    "programacao" -> mesmo curso.
//  - skill alvo aparece no titulo: +5 (fallback pra cursos que mencionam algo
//    fora do array skills, ex.: nome do framework no titulo).
//  - curso gratuito: +1 (preferencia leve do produto). Empate pende pra gratis
//    mas paido nao fica suprimido na lista.
//
// Mix de free + pago: quando { mix: true } e ha ambos tipos no catalogo,
// garante que retorno inclua >=1 curso de cada tipo (independente do score).
// Default true porque produto precisa mostrar alternativas pagas em plataformas
// conhecidas (Tera/Alura/Rocketseat/DIO/Udemy/Coursera/PM3/Hashtag/Trybe)
// alem das gratuitas (Coursera audit/freeCodeCamp/YouTube/MDN).
//
// Retorna apenas cursos com score > 0; sem match, lista vazia (caller decide).
export function suggestCoursesForSkill(skillQuery, { limit = 3, mix = true } = {}) {
  if (!skillQuery) return [];
  const target = normalize(skillQuery);
  if (!target) return [];

  const scored = ALL_COURSES.map((c) => {
    const skillMatch = (c.skills || []).some((s) => {
      const ns = normalize(s);
      if (!ns) return false;
      return ns.includes(target) || target.includes(ns);
    });
    const titleMatch = normalize(c.title).includes(target);
    // Sem nenhum match real (skill OU titulo), curso nao entra. Free isolado
    // nao basta — senao "skill-que-nao-existe" voltaria todo curso gratis.
    if (!skillMatch && !titleMatch) return { course: c, score: 0 };
    let score = 0;
    if (skillMatch) score += 10;
    if (titleMatch) score += 5;
    if (c.free) score += 1;
    return { course: c, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  let picked;
  if (mix && limit >= 2) {
    // Garante mix: pega o melhor free + melhor pago, depois preenche restante
    // pela ordem de score original.
    const free = scored.filter((s) => s.course.free === true);
    const paid = scored.filter((s) => s.course.free !== true);

    if (free.length > 0 && paid.length > 0) {
      const pickedIds = new Set();
      const out = [];
      // Topo de cada lista garante mix; depois preenche restante pelo score.
      out.push(free[0]);
      pickedIds.add(free[0].course.id);
      out.push(paid[0]);
      pickedIds.add(paid[0].course.id);
      for (const s of scored) {
        if (out.length >= limit) break;
        if (pickedIds.has(s.course.id)) continue;
        out.push(s);
        pickedIds.add(s.course.id);
      }
      picked = out.slice(0, limit);
    } else {
      // So existe um tipo; usa ordem de score puro.
      picked = scored.slice(0, limit);
    }
  } else {
    picked = scored.slice(0, Math.max(0, limit));
  }

  return picked.map((s) => ({
    ...s.course,
    url: decorateUrl(s.course.url, { provider: s.course.provider }),
  }));
}

// Agrupa por skill. Aceita formatos diferentes de gap pra ser robusto a quem
// chama daqui (Gap do Prisma usa "habilidade"; outros lugares podem ter "skill"
// ou "name"). Limite duplo: por gap (perGapLimit) e total (totalLimit) — evita
// payload gigantesco quando o usuario tem 20+ gaps abertos.
export function suggestCoursesForGaps(
  gaps,
  { perGapLimit = 2, totalLimit = 8 } = {}
) {
  if (!Array.isArray(gaps) || gaps.length === 0) return {};

  const result = {};
  let total = 0;
  for (const gap of gaps) {
    if (total >= totalLimit) break;
    const skill = gap?.habilidade || gap?.skill || gap?.name;
    if (!skill) continue;
    // Skip duplicados (dois gaps com mesma habilidade nao geram duas entradas).
    if (result[skill]) continue;
    const remaining = totalLimit - total;
    const found = suggestCoursesForSkill(skill, {
      limit: Math.min(perGapLimit, remaining),
    });
    if (found.length > 0) {
      result[skill] = found;
      total += found.length;
    }
  }
  return result;
}
