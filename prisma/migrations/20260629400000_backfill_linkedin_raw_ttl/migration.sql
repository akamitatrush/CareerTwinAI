-- Backfill linkedinRawExpiresAt — fecha gap LGPD detectado por Treebeard v2.
-- Profiles legados com linkedinRaw populado mas linkedinRawExpiresAt NULL
-- ficavam fora do cron redact-cv (so apaga quando expiresAt < now).
-- Setamos expiresAt = (mais recente entre updatedAt e agora) + 90 dias.
-- Mais conservador que apagar imediatamente (user pode estar usando).

UPDATE "Profile"
SET "linkedinRawExpiresAt" = GREATEST("updatedAt", NOW()) + INTERVAL '90 days'
WHERE "linkedinRaw" IS NOT NULL
  AND "linkedinRawExpiresAt" IS NULL;
