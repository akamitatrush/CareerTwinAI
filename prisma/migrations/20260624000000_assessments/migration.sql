-- Mini-assessments de autoconhecimento (DISC-lite, Valores, Ikigai).
-- scoresJson tem shape variavel por kind (ver lib/assessments/definitions.js).
-- Cascade em userId pra "apagar minha conta" levar junto. Indice composto
-- (userId,kind,completedAt) atende a busca "ultimo resultado de cada tipo".

CREATE TYPE "AssessmentKind" AS ENUM ('DISC_LITE', 'VALORES', 'IKIGAI');

CREATE TABLE "AssessmentResult" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AssessmentKind" NOT NULL,
  "scoresJson" JSONB NOT NULL,
  "insights" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssessmentResult_userId_kind_completedAt_idx" ON "AssessmentResult"("userId", "kind", "completedAt");

ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
