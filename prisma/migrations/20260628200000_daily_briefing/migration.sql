-- Daily Briefing — feature #3 do STRATEGY_ROADMAP. Substitui o "evento de
-- digest semanal" por briefing diario personalizado, reduzindo tempo entre
-- valor entregue ao user. Mantem digest semanal (segundas) como retrospectiva;
-- daily-briefing roda ter-dom (cobre os outros 6 dias).
--
-- Migrations:
--  1. Coluna User.lastDailyBriefingAt — cron checa pra nao spammar (debounce 18h).
--  2. AuditAction DAILY_BRIEFING_SENT — trace de envio (OWASP A09).
--  3. NotificationKind DAILY_BRIEFING — notification in-app que espelha o email.
--
-- ADD VALUE IF NOT EXISTS torna a migration idempotente (rodar 2x nao quebra).
-- Postgres exige cada ADD VALUE como statement separado (transactional restriction);
-- prisma migrate deploy aceita.

ALTER TABLE "User" ADD COLUMN "lastDailyBriefingAt" TIMESTAMP(3);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DAILY_BRIEFING_SENT';

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'DAILY_BRIEFING';
