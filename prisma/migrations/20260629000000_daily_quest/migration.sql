-- Daily Quest: 1 acao curta sugerida AO DIA com base no estado do user.
-- Habit loop (feature #10 do STRATEGY_ROADMAP) — razao concreta pra voltar.
-- Lazy creation (GET cria se nao existir); sem cron. Unique (userId, questDate)
-- garante 1/dia. Cascade no userId pra "apagar minha conta" levar junto.

CREATE TYPE "QuestKind" AS ENUM (
  'CV_BULLET_REWRITE',
  'LINKEDIN_HEADLINE',
  'EVIDENCE_ADD',
  'SKILL_RESEARCH',
  'INTERVIEW_PREP',
  'NETWORK_OUTREACH',
  'MARKET_RESEARCH',
  'REFLECTION'
);

CREATE TABLE "DailyQuest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questDate" DATE NOT NULL,
  "kind" "QuestKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL DEFAULT 5,
  "rewardPoints" INTEGER NOT NULL DEFAULT 5,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DailyQuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyQuest_userId_questDate_key" ON "DailyQuest"("userId", "questDate");
CREATE INDEX "DailyQuest_userId_completedAt_idx" ON "DailyQuest"("userId", "completedAt");

ALTER TABLE "DailyQuest" ADD CONSTRAINT "DailyQuest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
