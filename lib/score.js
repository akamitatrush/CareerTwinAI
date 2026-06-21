// Career Health Score — cálculo determinístico e auditável.
// O score NÃO é gerado por IA; é calculado aqui pela fórmula ponderada.
// O LLM apenas explica cada sub-score.

export const WEIGHTS = {
  aderencia_vagas: 0.40,
  relevancia_habilidades: 0.30,
  otimizacao_perfil: 0.20,
  experiencia_mercado: 0.10,
};

export const SS_META = {
  aderencia_vagas:        { label: "Aderência a vagas",          w: "40%" },
  relevancia_habilidades: { label: "Relevância das habilidades", w: "30%" },
  otimizacao_perfil:      { label: "Otimização do perfil",        w: "20%" },
  experiencia_mercado:    { label: "Experiência de mercado",      w: "10%" },
};

export function computeOverall(subScores) {
  let total = 0;
  for (const k in WEIGHTS) {
    const v = Number(subScores?.[k]?.valor) || 0;
    total += v * WEIGHTS[k];
  }
  return Math.round(total);
}
