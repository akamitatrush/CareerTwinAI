-- Profile.rawCv TTL (LGPD — principle of storage limitation).
--
-- rawCv e linkedinRaw sao textos brutos do CV/LinkedIn — nome, email, telefone,
-- CPF, endereco. Mantidos indefinidamente sem TTL, um vazamento de banco expoe
-- PII de todos os usuarios historicos. Solucao: TTL de 90 dias a partir do
-- ultimo upsert. Cron diario apaga rawCv/linkedinRaw quando expira e marca
-- rawCvRedactedAt. O perfilJson estruturado (skills, cargo) fica — esse e o
-- "gemeo" propriamente dito, sem PII raw.
--
-- Profiles existentes recebem TTL inicial de NOW() + 90d pra manter compat.

ALTER TABLE "Profile" ADD COLUMN "rawCvExpiresAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "rawCvRedactedAt" TIMESTAMP(3);

-- Backfill: Profiles ja existentes com rawCv ganham TTL de 90 dias a partir
-- de agora (nao retroativo — seria injusto apagar agora algo que estava OK).
UPDATE "Profile"
SET "rawCvExpiresAt" = NOW() + INTERVAL '90 days'
WHERE "rawCv" IS NOT NULL OR "linkedinRaw" IS NOT NULL;
