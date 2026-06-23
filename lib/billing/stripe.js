// Wrapper do SDK Stripe. NUNCA exporta a chave pro client; tudo aqui roda em
// node runtime (server-side). Singleton lazy — so instancia quando alguem
// chama stripe(), evitando crash no build sem STRIPE_SECRET_KEY.
//
// SEGURANCA: nada de STRIPE_SECRET_KEY em NEXT_PUBLIC_*. Sem fallback default
// — se chave nao existe, lanca explicitamente. Rotas conferem isStripeConfigured()
// antes e retornam 503 amigavel.

import Stripe from "stripe";

let _stripe = null;

export function stripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY nao configurada");
  _stripe = new Stripe(key, {
    apiVersion: "2025-09-30.acacia",
    typescript: false,
    timeout: 8000,
    maxNetworkRetries: 2,
  });
  return _stripe;
}

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}
