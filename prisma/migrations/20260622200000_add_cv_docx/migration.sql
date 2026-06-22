-- Adiciona CV_DOCX ao enum ConsentSource pra suportar upload de .docx.
-- ALTER TYPE ... ADD VALUE e idempotente via IF NOT EXISTS (Postgres 12+).
ALTER TYPE "ConsentSource" ADD VALUE IF NOT EXISTS 'CV_DOCX';
