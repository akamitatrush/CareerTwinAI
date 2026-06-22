// Discriminador de ambiente real.
// Vercel seta NODE_ENV="production" em qualquer deploy (incluindo preview),
// entao nao da pra confiar nele pra distinguir prod real. VERCEL_ENV existe
// pra isso e tem 3 valores: "production", "preview", "development".
//
// Em self-hosted (sem Vercel), VERCEL_ENV nao existe — caimos no NODE_ENV.
//
// Uso principal: liberar AUTH_DEV_CREDENTIALS em preview deploys (pra
// owner testar sem precisar configurar Resend) mas manter o gate em prod.

export function isRealProduction() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

export function isVercelPreview() {
  return process.env.VERCEL_ENV === "preview";
}
