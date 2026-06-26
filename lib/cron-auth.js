// lib/cron-auth.js
// Autenticacao unificada pros crons. Vercel Cron (a partir de 2025) envia
// `Authorization: Bearer <CRON_SECRET>` automaticamente — o header
// custom `x-cron-secret` precisa ser configurado manualmente em cada job e
// nao e o default. Antes desse helper, os crons aceitavam APENAS
// `x-cron-secret`, o que potencialmente BLOQUEAVA execucao em prod quando
// o cron estava registrado no vercel.json padrao (sem header custom).
// Resultado: violacao de LGPD Art. 16 (CVs persistindo > 90 dias).
//
// Esta funcao aceita AMBOS os formatos:
//   1. `Authorization: Bearer <CRON_SECRET>` (default da Vercel)
//   2. `x-cron-secret: <CRON_SECRET>` (legado/manual)
//
// Defesa em camadas + retrocompat pra qualquer script manual existente.
// Comparacao constant-time via timingSafeEqual (mesmo padrao usado nos
// crons anteriormente — proteja contra timing attack via byte-by-byte
// inference do secret).

import { timingSafeEqual } from "node:crypto";

// Constant-time compare. Se lengths diferem, ainda gasta tempo proporcional
// a `a` antes de retornar false — evita leak via length.
function safeCompare(a, b) {
  if (!a || !b) return false;
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) {
    // Pad time para evitar timing leak de length. Compara A contra zerado.
    timingSafeEqual(A, Buffer.alloc(A.length));
    return false;
  }
  return timingSafeEqual(A, B);
}

// Extrai o token de `Authorization: Bearer <token>`. Tolera espacos extras
// e case insensitive no esquema (`bearer`, `Bearer`, `BEARER`). Retorna ""
// se header ausente ou nao comeca com "bearer ".
function extractBearer(headerVal) {
  if (!headerVal || typeof headerVal !== "string") return "";
  const trimmed = headerVal.trim();
  const m = /^bearer\s+(.+)$/i.exec(trimmed);
  return m ? m[1].trim() : "";
}

/**
 * Valida que a request vem de um cron autorizado (Vercel Cron ou chamada manual
 * com header secret). Aceita AMBOS:
 *   - `Authorization: Bearer <CRON_SECRET>` (Vercel default)
 *   - `x-cron-secret: <CRON_SECRET>` (manual/legado)
 *
 * @param {Request} req — fetch Request (Next.js route handler).
 * @returns {{ ok: boolean, code?: string }}
 *   - { ok: true } se autorizado
 *   - { ok: false, code: "CRON_NOT_CONFIGURED" } se env CRON_SECRET ausente
 *   - { ok: false, code: "FORBIDDEN" } se nenhum header bateu
 *
 * IMPORTANTE: nunca inclua o secret nem o valor recebido em mensagens de
 * erro ou logs — apenas o code.
 */
export function verifyCronAuth(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return { ok: false, code: "CRON_NOT_CONFIGURED" };
  }

  // Tenta os dois headers. Avaliamos ambos sempre (mesmo se o primeiro
  // bateu) pra nao vazar via timing qual header foi usado/aceito.
  const headerSecret = req.headers.get("x-cron-secret") || "";
  const bearerSecret = extractBearer(req.headers.get("authorization") || "");

  const headerMatch = safeCompare(headerSecret, expected);
  const bearerMatch = safeCompare(bearerSecret, expected);

  if (headerMatch || bearerMatch) {
    return { ok: true };
  }
  return { ok: false, code: "FORBIDDEN" };
}

// Exportado pra testes internos — nao usar em rotas.
export const _internal = { safeCompare, extractBearer };
