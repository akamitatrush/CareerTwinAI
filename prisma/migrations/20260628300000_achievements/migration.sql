-- Achievements: gamificacao sutil — feature #8 do STRATEGY_ROADMAP.
-- Cada user pode ganhar cada kind no MAXIMO 1 vez (unique constraint).
-- Idempotencia: segundo INSERT do mesmo (userId, kind) lanca P2002 e o helper
-- grantAchievement devolve alreadyEarned: true sem efeito colateral.
-- Cascade no userId pra "apagar minha conta" levar conquistas junto.

CREATE TYPE "AchievementKind" AS ENUM (
  'FIRST_DIAGNOSIS',
  'FIRST_GAP_COMPLETED',
  'FIVE_GAPS_COMPLETED',
  'TEN_GAPS_COMPLETED',
  'FIRST_TAILOR',
  'FIRST_APPLICATION',
  'FIRST_INTERVIEW',
  'PROFILE_100_PERCENT',
  'ALL_ASSESSMENTS_COMPLETED',
  'STREAK_7_DAYS',
  'STREAK_30_DAYS',
  'SCORE_70',
  'SCORE_80',
  'SCORE_90',
  'FIRST_REFRESH',
  'FIRST_EVIDENCE',
  'COURSE_COMPLETED'
);

CREATE TABLE "Achievement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AchievementKind" NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Achievement_userId_kind_key" ON "Achievement"("userId", "kind");
CREATE INDEX "Achievement_userId_earnedAt_idx" ON "Achievement"("userId", "earnedAt");

ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona ACHIEVEMENT_UNLOCKED ao enum NotificationKind existente.
-- Cada grant dispara uma Notification pra que o sininho mostre toast/badge.
ALTER TYPE "NotificationKind" ADD VALUE 'ACHIEVEMENT_UNLOCKED';
