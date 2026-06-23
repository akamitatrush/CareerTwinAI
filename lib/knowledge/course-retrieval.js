// Lookup deterministico de cursos por skill com matching tolerante a acento,
// caixa e palavra parcial. Estatico: catalogo curado em ./courses.json.
//
// Por que deterministico (sem LLM)?
//  - Custo zero por requisicao (chamado em SSR de /gaps e em endpoint frequente).
//  - Resposta previsivel e auditavel (a gente sabe o que esta sugerindo).
//  - Curadoria humana > recomendacao alucinada de LLM pra cursos reais.
//
// O catalogo prioriza materiais GRATUITOS e formatos curtos (<40h ideal). Sem
// affiliate por agora — quando virar, basta plugar em decorateUrl() abaixo.

import courses from "./courses.json";

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

// Hook pra affiliate futuro. Plugar tracking aqui (ex.: ?ref=careertwin) sem
// mexer em consumidor — TODO documentado no README do diretorio quando virar
// real. Por agora retorna URL crua pra nao quebrar nada e pra deixar claro que
// nenhum dado do usuario vaza pro provider via querystring.
export function decorateUrl(url /*, { userId } = {} */) {
  return url;
}

// Score simples e estavel:
//  - skill alvo bate na lista c.skills (substring tolerante nos dois sentidos):
//    +10. Captura "python" -> ["python", "programacao", "fundamentos"] e
//    "programacao" -> mesmo curso.
//  - skill alvo aparece no titulo: +5 (fallback pra cursos que mencionam algo
//    fora do array skills, ex.: nome do framework no titulo).
//  - curso gratuito: +2 (preferencia explicita do produto). Empate sempre
//    pende pra opcao gratis.
//
// Retorna apenas cursos com score > 0; sem match, lista vazia (caller decide).
export function suggestCoursesForSkill(skillQuery, { limit = 3 } = {}) {
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
    if (c.free) score += 2;
    return { course: c, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));

  return scored.map((s) => ({
    ...s.course,
    url: decorateUrl(s.course.url),
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
