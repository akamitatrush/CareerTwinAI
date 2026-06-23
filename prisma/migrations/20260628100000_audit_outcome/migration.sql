-- Audit actions pra outcome tracking. ADD VALUE IF NOT EXISTS torna a migration
-- idempotente — rodar 2x nao quebra. Postgres exige cada ADD VALUE como
-- statement separado (transactional restriction); migrate deploy aceita.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OUTCOME_REPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OUTCOME_SURVEY_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OUTCOME_SURVEY_DECLINED';
