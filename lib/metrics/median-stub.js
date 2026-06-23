/**
 * Mediana de contratados — stub.
 *
 * Por que existe: a UI do dashboard precisa mostrar "voce esta a X pontos da
 * mediana de quem foi contratado pro cargo-alvo". Ainda nao temos dataset
 * real de outcomes (precisa rotular candidaturas com hired=true|false e
 * agregar score historico no momento da contratacao).
 *
 * Estrategia: hardcode unico ponto de leitura. Quando a tabela de outcomes
 * existir, basta trocar essa constante por um query agregada
 * (por role, ou por role+seniority). Componentes nao precisam mudar.
 *
 * NUNCA expor isso como "valor confirmado de mercado" no marketing — o copy
 * no UI sempre carrega "estimativa em construcao" pra deixar honesto.
 */
export const HIRED_MEDIAN = 78;
