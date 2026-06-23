-- Sistema de notificacoes in-app. Cada user tem ate 20 visiveis no sininho.
-- readAt=null indica unread (badge counter). Cascade em userId pra "apagar tudo"
-- limpar junto. Indices: timeline por (userId,createdAt) e contador unread
-- por (userId,readAt).

CREATE TYPE "NotificationKind" AS ENUM (
  'GAP_COMPLETED',
  'PLAN_ITEM_COMPLETED',
  'SCORE_UPDATED',
  'DIGEST_SENT',
  'APPLICATION_STATUS',
  'WELCOME'
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "meta" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
