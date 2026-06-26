-- Outcome tracking — dataset proprietario pra mediana de contratados.
--
-- POR QUE: Daniel + Bianca (Tera) cobraram dado real. Hoje lib/metrics/median-stub
-- tem HIRED_MEDIAN = 78 hardcoded (vaporware). Sem outcomes, mediana fica chute.
-- Solucao: construir infra agora, dataset cresce com trafego, em 3-6 meses
-- temos mediana real. Threshold 50 outcomes HIRED pra significancia.
--
-- Cascade no userId garante que "apagar minha conta" leva outcomes junto.
-- Indices: (userId,occurredAt) pra timeline pessoal; (kind,occurredAt) pra
-- agregacao por kind (mediana usa kind in (HIRED, HIRED_DIFFERENT)).

CREATE TYPE "OutcomeKind" AS ENUM (
  'HIRED',
  'HIRED_DIFFERENT',
  'NOT_HIRED',
  'STILL_LOOKING',
  'PAUSED',
  'DECLINED_TO_ANSWER'
);

CREATE TYPE "SurveyKind" AS ENUM (
  'THIRTY_DAYS',
  'SIXTY_DAYS',
  'NINETY_DAYS',
  'SELF_REPORTED'
);

CREATE TABLE "Outcome" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "OutcomeKind" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scoreAtTime" INTEGER,
  "roleAtTime" TEXT,
  "monthsSearching" INTEGER,
  "evidence" TEXT,
  "surveyKind" "SurveyKind",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Outcome_userId_occurredAt_idx" ON "Outcome"("userId", "occurredAt");
CREATE INDEX "Outcome_kind_occurredAt_idx" ON "Outcome"("kind", "occurredAt");

ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
