// Helper pra registrar acoes em AuditLog. Resolve gap A09 do audit OWASP
// (Security Logging & Monitoring Failures).
//
// Politica de privacidade:
//  - IP nao e armazenado raw — sha256 com salt (AUDIT_IP_SALT). Trade-off:
//    perdemos lookup reverso, ganhamos LGPD-compliance (IP e dado pessoal).
//  - meta deve ser sanitizado pelo CALLER antes de passar — sem CV, sem
//    payload raw, sem email/CPF. So coisas tipo {feature, size, reason}.
//  - target e string livre formatada "Tipo:id" pra rastreio sem JOIN.
//
// Falha silenciosa: se a insercao no AuditLog falhar (DB down, schema drift),
// logamos no console mas NAO derrubamos o request principal. Audit log que
// quebra fluxos de usuario e contraproducente.
//
// Uso tipico:
//   import { audit } from "@/lib/audit";
//   await audit({ userId, action: "ACCOUNT_DELETED", target: `User:${userId}`, req });

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.AUDIT_IP_SALT || "ct-default-salt-change-me";
  // Trunca em 32 chars (sha256 -> 64 hex). 128 bits sao mais que suficientes
  // pra unicidade dentro do volume esperado, e poupa storage.
  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

function getActorIp(req) {
  if (!req) return null;
  // Suporta tanto Headers (Web Standard) quanto objeto plain em testes.
  const get = (h) =>
    typeof req.headers?.get === "function"
      ? req.headers.get(h)
      : req.headers?.[h] ?? null;
  const xff = get("x-forwarded-for");
  if (xff) return String(xff).split(",")[0].trim();
  return get("x-real-ip") || null;
}

/**
 * Registra audit event. Sanitize meta antes de chamar (sem PII raw).
 *
 * @param {Object} args
 * @param {string} [args.userId] userId (null pra anon/system)
 * @param {string} args.action uma das AuditAction enum values
 * @param {Request} [args.req] pra extrair IP automaticamente
 * @param {string} [args.actorIp] IP raw (sera hasheado)
 * @param {string} [args.target] ex: "User:cuid123"
 * @param {Object} [args.meta] payload sanitizado (sem PII raw)
 */
export async function audit({ userId, action, req, actorIp, target, meta } = {}) {
  if (!action) {
    console.error("audit: action obrigatoria");
    return;
  }
  try {
    const ip = actorIp || getActorIp(req);
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        actorIp: hashIp(ip),
        action,
        target: target || null,
        meta: meta ?? null,
      },
    });
  } catch (e) {
    // Falha silenciosa — nao quebra request principal. Log pro Sentry/console.
    console.error("audit log falhou:", e?.message);
  }
}

// Exportado pra testes — nao usar fora.
export const _internal = { hashIp, getActorIp };
