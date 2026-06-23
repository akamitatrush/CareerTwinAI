// Configuracao dos planos. STRIPE_PRICE_* sao IDs do Stripe Dashboard.
// Limites por feature aplicados em lib/billing/enforce.js.
//
// IMPORTANTE: este arquivo e a unica fonte de verdade dos limites/precos
// logicos. Mudar plano = editar aqui + criar Price no Stripe Dashboard +
// setar env STRIPE_PRICE_*. NAO ha UI ainda (espera ICP), entao mudancas
// nao quebram tela.

const PRO_LIMITS = {
  analyze: Infinity,
  tailor: Infinity,
  opportunities: Infinity,
  interview: Infinity,
};
const PRO_FEATURES = {
  priorityLLM: true,
  noBranding: true,
  teamSeats: 0,
};

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceBRL: 0,
    stripePriceId: null,
    interval: null,
    limits: {
      analyze: 3, // por mes
      tailor: 1, // por mes
      opportunities: 5, // por dia
      interview: 5, // por mes
    },
    features: {
      priorityLLM: false,
      noBranding: false,
      teamSeats: 0,
    },
  },
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro (mensal)",
    priceBRL: 29,
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly_placeholder",
    interval: "month",
    limits: PRO_LIMITS,
    features: PRO_FEATURES,
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "Pro (anual)",
    priceBRL: 290,
    stripePriceId: process.env.STRIPE_PRICE_PRO_YEARLY || "price_pro_yearly_placeholder",
    interval: "year",
    limits: PRO_LIMITS,
    features: PRO_FEATURES,
  },
  team_monthly: {
    id: "team_monthly",
    name: "Team (B2B)",
    priceBRL: 99, // por seat
    stripePriceId: process.env.STRIPE_PRICE_TEAM_MONTHLY || "price_team_monthly_placeholder",
    interval: "month",
    perSeat: true,
    limits: {
      analyze: Infinity,
      tailor: Infinity,
      opportunities: Infinity,
      interview: Infinity,
    },
    features: {
      priorityLLM: true,
      noBranding: true,
      teamSeats: Infinity,
    },
  },
};

// getPlan: NUNCA retorna null — fail closed pra free. Defesa contra planId
// invalido no DB (cenario raro mas possivel: rollback de codigo apos cobranca).
export function getPlan(planId) {
  if (planId && Object.prototype.hasOwnProperty.call(PLANS, planId)) {
    return PLANS[planId];
  }
  return PLANS.free;
}

// periodKey: YYYY-MM pro usage meter mensal. Muda automaticamente no virar do
// mes — nao precisa cron de reset (e isso e proposital, evita race entre
// midnight e contador). Datas em UTC pra consistencia entre fusos.
export function periodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// dayKey: YYYY-MM-DD pro usage meter diario (opportunities). UTC tambem.
export function dayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
