-- Cria model FunnelEntry — fecha P0 do audit Wave 11 (Treebeard v2).
--
-- POR QUE: a feature de funnel tracker semanal (caso Jamar Martins) ja estava
-- 100% codada em app/api/funnel/route.js, app/(app)/funil/page.js e lib/funnel.js,
-- usando prisma.funnelEntry.upsert/findMany. Mas o model nunca foi adicionado
-- ao schema, nem migration criada. Resultado: /funil e POST /api/funnel
-- retornavam 500 garantido em prod (PrismaClientValidationError: Property
-- 'funnelEntry' does not exist).
--
-- ESTRUTURA: user reporta 5 numeros semanais (applications -> callbacks ->
-- hmConversations -> finals -> offers) + notes opcional. weekStart e segunda
-- 00:00 UTC calculada no servidor (anti-tampering). Default 0 nas colunas
-- numericas pra que upsert com create parcial nao quebre.
--
-- INDICES:
--   UNIQUE (userId, weekStart) — habilita o upsert atomico do POST.
--   INDEX (userId, weekStart DESC) — acelera findMany ordenado das 4 e 12
--                                    semanas mais recentes (hot paths).
--
-- CASCADE: onDelete CASCADE em userId — apagar conta de user leva entries junto.

CREATE TABLE "FunnelEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "applications" INTEGER NOT NULL DEFAULT 0,
  "callbacks" INTEGER NOT NULL DEFAULT 0,
  "hmConversations" INTEGER NOT NULL DEFAULT 0,
  "finals" INTEGER NOT NULL DEFAULT 0,
  "offers" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FunnelEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FunnelEntry_userId_weekStart_key"
  ON "FunnelEntry"("userId", "weekStart");

CREATE INDEX "FunnelEntry_userId_weekStart_idx"
  ON "FunnelEntry"("userId", "weekStart" DESC);

ALTER TABLE "FunnelEntry" ADD CONSTRAINT "FunnelEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
