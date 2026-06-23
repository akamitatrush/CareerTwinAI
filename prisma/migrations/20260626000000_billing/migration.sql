-- Billing (Stripe Phase 1+2): Subscription, UsageMeter, BillingEvent.
--
-- Subscription: 1:1 com User (userId UNIQUE). stripeCustomerId/stripeSubscriptionId
-- nullables (user pode existir sem nunca ter cobrado), mas UNIQUE quando setados
-- pra acelerar lookup no webhook. Cascade no userId pra "apagar minha conta"
-- limpar junto. Status default ACTIVE atende o caso plano free implicito.
--
-- UsageMeter: contador por (userId, feature, periodKey). UNIQUE composto permite
-- upsert atomico no enforce.js (race-safe). Cron mensal apaga registros >3 meses.
--
-- BillingEvent: log idempotente de webhooks Stripe. stripeEventId UNIQUE bloqueia
-- reprocessamento. userId nullable + SetNull preserva auditoria pos-delete (LGPD).

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
  'PAUSED'
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "planId" TEXT NOT NULL DEFAULT 'free',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "trialEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "UsageMeter" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "periodKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageMeter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageMeter_userId_feature_periodKey_key"
  ON "UsageMeter"("userId", "feature", "periodKey");
CREATE INDEX "UsageMeter_userId_periodKey_idx" ON "UsageMeter"("userId", "periodKey");

ALTER TABLE "UsageMeter" ADD CONSTRAINT "UsageMeter_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE INDEX "BillingEvent_userId_idx" ON "BillingEvent"("userId");
CREATE INDEX "BillingEvent_type_processedAt_idx" ON "BillingEvent"("type", "processedAt");

ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
