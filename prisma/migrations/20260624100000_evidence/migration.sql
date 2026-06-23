-- Evidencias de competencia (skills-first): usuario demonstra com cases/
-- projetos/metricas concretos em vez de apenas declarar a skill.
-- Cascade no userId pra "apagar minha conta" levar tudo junto.
-- Indice (userId,createdAt) atende a listagem ordenada por mais recente.

CREATE TYPE "EvidenceKind" AS ENUM ('PROJECT', 'CASE', 'PUBLICATION', 'CERTIFICATION', 'AWARD', 'CONTRIBUTION');

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "EvidenceKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metricLabel" TEXT,
  "metricValue" TEXT,
  "url" TEXT,
  "whenLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Evidence_userId_createdAt_idx" ON "Evidence"("userId", "createdAt");

ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
