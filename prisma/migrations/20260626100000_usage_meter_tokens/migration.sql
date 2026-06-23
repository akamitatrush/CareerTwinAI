-- Adiciona telemetria de custo LLM por user/feature/periodo. Defende contra
-- cost amplification (P1 audit): atacante usa LLM em loop, sem hard-cap
-- diario o custo escala linearmente ($576/dia/user no pior caso).
--
-- tokensIn/tokensOut: contadores cumulativos por periodo (mes ou dia).
-- costUsd: Decimal(10,6) suporta fracoes < $0.000001 (Voyage @ $0.06/1M tokens).
-- Hard-cap aplicado em lib/billing/enforce.js#checkDailyBudget.

ALTER TABLE "UsageMeter" ADD COLUMN "tokensIn" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageMeter" ADD COLUMN "tokensOut" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageMeter" ADD COLUMN "costUsd" DECIMAL(10, 6) NOT NULL DEFAULT 0;
