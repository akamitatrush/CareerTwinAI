-- LGPD storage limitation (Art. 16): linkedinRaw precisa de TTL proprio.
-- Antes, o schema mencionava TTL de 90 dias pra rawCv E linkedinRaw mas SO
-- existia rawCvExpiresAt — o cron redact-cv apagava linkedinRaw "de carona",
-- mas se o user atualizasse so o LinkedIn (sem CV), nao havia coluna pra
-- expirar somente o LinkedIn. Resultado: linkedinRaw podia persistir
-- indefinidamente. Red-team audit 2026-06-25 (P0).
--
-- Migration cria duas colunas analogas a rawCvExpiresAt/rawCvRedactedAt e
-- adiciona enum value LINKEDIN_RAW_REDACTED pro audit log.
--
-- Backfill: NAO setamos linkedinRawExpiresAt em registros existentes aqui.
-- O proximo update do user via /api/linkedin/parse setara o TTL corretamente
-- (Date.now() + 90 dias). Para registros legados nunca mais atualizados,
-- o cron pode ser estendido posteriormente com uma query suplementar
-- (linkedinRaw NOT NULL AND linkedinRawExpiresAt IS NULL AND createdAt
-- < now() - 90 days) — fora do escopo deste fix imediato.

ALTER TABLE "Profile" ADD COLUMN "linkedinRawExpiresAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "linkedinRawRedactedAt" TIMESTAMP(3);

ALTER TYPE "AuditAction" ADD VALUE 'LINKEDIN_RAW_REDACTED';
