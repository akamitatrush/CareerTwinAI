-- Audit Log (OWASP A09 — Security Logging & Monitoring Failures).
--
-- Trace auditavel de eventos sensiveis: login/logout, criacao/exclusao de
-- conta, export de dados, billing, upload/delete de CV, eventos de seguranca.
-- userId nullable + ON DELETE SET NULL preserva auditoria quando user e
-- apagado (LGPD: retencao de rastros minimos legitimos pra defesa de direitos
-- e investigacao ANPD). actorIp e hash sha256 do IP (NAO raw — privacy-by-design).
-- meta JSONB pra payload sanitizado; target string livre tipo "User:cuid123".
--
-- Indices:
--  - (userId, createdAt) — historico por user (export LGPD, troubleshooting).
--  - (action, createdAt) — alerting / agregacoes por tipo de evento.

CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN',
  'LOGOUT',
  'PASSWORD_RESET',
  'ACCOUNT_CREATED',
  'ACCOUNT_DELETED',
  'DATA_EXPORTED',
  'CONSENT_GRANTED',
  'CONSENT_REVOKED',
  'PROFILE_UPDATED',
  'BILLING_SUBSCRIPTION_CREATED',
  'BILLING_SUBSCRIPTION_CANCELED',
  'BILLING_PAYMENT_FAILED',
  'CV_UPLOADED',
  'CV_DELETED',
  'SECURITY_RATE_LIMIT_HIT',
  'SECURITY_BUDGET_EXCEEDED',
  'SECURITY_INVALID_WEBHOOK'
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "actorIp" TEXT,
  "action" "AuditAction" NOT NULL,
  "target" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
