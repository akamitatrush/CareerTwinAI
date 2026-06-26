// Mapa de provider -> config de afiliado. Cada plataforma tem param
// diferente (?ref=X, ?refid=Y, ?affiliate_id=Z). Sem env configurada, o
// provider entra como SEM afiliado (URL crua) -- fail-safe pra dev/local.
//
// Como ativar em prod: configurar as env vars no Vercel. O link passa a
// vir decorado automaticamente. Sem custo de deploy adicional.
//
// IMPORTANTE: os param names abaixo sao por CONVENCAO publica (ref/referralCode/
// etc) -- cada plataforma so confirma o param exato no painel de afiliados.
// Antes de promover pra prod, valide com o programa de cada uma. Se um param
// estiver errado, o link continua funcionando (sem comissao) -- nao quebra UX.
//
// Estimativa de receita marginal:
//   0,5% conversion x R$1.500 ticket medio x 15% comissao = R$11/user/mes

export const AFFILIATE_PROVIDERS = {
  "Tera": {
    param: "ref",
    env: "TERA_AFFILIATE_ID",
    notes: "Programa de parceiros Tera. Contato: partnerships@somostera.com",
  },
  "Alura": {
    param: "ref",
    env: "ALURA_AFFILIATE_ID",
    notes: "Programa de afiliados via Hotmart (comissao 20-30%)",
  },
  "Rocketseat": {
    param: "ref",
    env: "ROCKETSEAT_AFFILIATE_ID",
    notes: "Programa de afiliados (comissao 15-20%)",
  },
  "Udemy": {
    param: "referralCode",
    env: "UDEMY_AFFILIATE_ID",
    notes: "Udemy Affiliate Program (oficial). Aprovacao em 1 semana",
  },
  "DIO": {
    param: "ref",
    env: "DIO_AFFILIATE_ID",
    notes: "Programa de parceiros DIO (agressivo, comissao 30%+)",
  },
  "Coursera": {
    param: "irclickid",
    env: "COURSERA_AFFILIATE_ID",
    notes: "Coursera Affiliate Program via Impact (comissao 10-20%)",
  },
  "Hashtag Treinamentos": {
    param: "ref",
    env: "HASHTAG_AFFILIATE_ID",
    notes: "Programa de afiliados Hashtag",
  },
  "Trybe": {
    param: "ref",
    env: "TRYBE_AFFILIATE_ID",
    notes: "Trybe Partner Program",
  },
  "PM3": {
    param: "ref",
    env: "PM3_AFFILIATE_ID",
    notes: "PM3 Programa de Embaixadores",
  },
};

// Retorna { param, id } ou null se provider sem afiliado configurado.
// Null em dois cenarios distintos -- ambos retornam URL crua (sem comissao):
//   1. Provider nao mapeado (ex: freeCodeCamp, MDN): nao tem programa.
//   2. Provider mapeado mas env vazia: ainda nao cadastrei no programa.
export function getAffiliateConfig(providerName) {
  if (!providerName) return null;
  const cfg = AFFILIATE_PROVIDERS[providerName];
  if (!cfg) return null;
  const id = process.env[cfg.env];
  if (!id) return null;
  return { param: cfg.param, id };
}
