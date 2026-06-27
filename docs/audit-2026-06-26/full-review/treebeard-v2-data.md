# Treebeard v2 — Data layer audit (2026-06-26)

Escopo: `prisma/schema.prisma`, 21 migrations, ~50 rotas com Prisma, pipeline RAG (pgvector + Voyage), pool de conexoes, retencao LGPD. Read-only.

## TL;DR
- **Issues criticos: 4** (FunnelEntry sem model, Gap sem indice (snapshot,completedAt), schema.embedding sem JsonProtocol indexes, health check com EXPECTED_MIGRATIONS=15 != 21).
- **Risco perf: 6** (admin findMany sem take, scoreSnapshot include gaps sem limit, dashboard carrega 30 snapshots com gaps+planItems, opportunities sem indice por (userId,createdAt) em Outcome com filtros via relacao, daily-briefing nested where via relation).
- **LGPD/retention: 2** (linkedinRaw legados sem TTL backfill, BillingEvent.payload limpo OK mas storage limitation no AuditLog ausente).
- **HNSW: OK** — restaurado em `20260629100000_restore_knowledge_embedding_idx`.

---

## Schema

- Total models: **23** (User, Account, Session, VerificationToken, Profile, ScoreSnapshot, Gap, PlanItem, Application, ApplicationEvent, Consent, DataSource, Notification, AssessmentResult, Evidence, KnowledgeChunk, Subscription, UsageMeter, BillingEvent, TailoredCv, AuditLog, Outcome, Achievement, DailyQuest).
- Enums: 13.

### Indexes ausentes / risco perf
- `Gap` **NAO tem nenhum `@@index`** (`schema.prisma:158-170`). Em `app/api/gaps/[id]/complete/route.js:83-92` ha `prisma.gap.count({ where: { snapshot: { userId }, completedAt: { not: null } } })` — Postgres nao tem indice em `(snapshotId)` (PK so cobre `id`) nem em `completedAt`. Idem para `app/(app)/dashboard/page.js:60` (`include: { gaps: true }` em ate 30 snapshots).
  - **Fix:** `@@index([snapshotId, completedAt])`.
- `PlanItem` so tem `(snapshotId, semana)` (`schema.prisma:185`). Para `app/api/history/actions/route.js:58-65` (filtra `completedAt: { not: null }` em IN snapshotIds), falta `(snapshotId, completedAt)`.
- `KnowledgeChunk` tem `(topic)` e HNSW em `embedding`. Sem `tags` ou `audience`-indexes — busca atual nao filtra por estes campos no DB (so RRF in-memory) entao OK por enquanto.
- `Profile.rawCvExpiresAt` / `linkedinRawExpiresAt` sem indice. O cron `redact-cv` (`app/api/cron/redact-cv/route.js:54-84`) faz `findMany` com `OR/AND` em 4 colunas + `take: 500`. Em base pequena tudo OK; quando a base crescer >100k profiles, esse seq scan vira problema.
  - **Fix:** `@@index([rawCvExpiresAt])` e `@@index([linkedinRawExpiresAt])` (filtros parciais ideais, mas Prisma nao suporta — indice completo basta).

### Models declarados mas nao usados
Todos os 23 models tem usuario em codigo. Bem.

### Models USADOS mas NAO DECLARADOS  (CRITICO)
- **`FunnelEntry`** e chamado em 4 lugares:
  - `app/api/funnel/route.js:157` (`prisma.funnelEntry.upsert`)
  - `app/api/funnel/route.js:197` (`prisma.funnelEntry.findMany`)
  - `app/api/funnel/route.js:229` (idem)
  - `app/(app)/funil/page.js:40` (idem)
  - **Nao existe `model FunnelEntry`** em `prisma/schema.prisma` e **nao existe migration que crie a tabela `FunnelEntry`** em `prisma/migrations/`. A migration `20260625045109_add_funnel_and_welcome` so faz `DROP INDEX KnowledgeChunk_embedding_idx`, `ALTER TABLE BillingEvent ... DROP NOT NULL`, e adiciona `welcomeEmailSentAt` — nenhum `CREATE TABLE FunnelEntry`.
  - **Conclusao:** quem rodar `prisma generate` hoje quebra build (`prisma.funnelEntry` nao existe no client). E `/funil` e `POST /api/funnel` retornam 500 garantido. Bug de regressao de migration: ou alguem deletou o `CREATE TABLE` antes de commitar, ou existe em DB de prod mas nao no schema (drift).
  - **Severidade: P0** — recriar `model FunnelEntry` (cuid id, userId Cascade, weekStart Date, contadores, notes, @@unique([userId, weekStart]), @@index([userId, weekStart])).

### Cascade behaviors
- Auditados em 19 FKs. `User -> *` usa `Cascade` (correto pra "apagar tudo").
- `Application -> TailoredCv` usa `SetNull` (`schema.prisma:497`) — correto (apagar candidatura nao remove historico de tailor).
- `User -> BillingEvent` usa `SetNull` (`schema.prisma:475`) — correto (LGPD permite reter rastro de cobranca).
- `User -> AuditLog` usa `SetNull` (`schema.prisma:519`) — correto (LGPD legitimate retention).
- **Bem.**

### Fields com nullable suspeito
- `User.email` e nullable (`schema.prisma:19`) — Auth.js permite OAuth sem email, OK.
- `Profile.rawCv: String?` correto pos-TTL.
- `Outcome.scoreAtTime: Int?` — null quando user reporta sem snapshot ainda, OK.
- **OK.**

### N+1 explicito em query (sem `include`/`select` adequado)
- `app/(app)/dashboard/page.js:56-61` — `findMany` ate **30 snapshots** com `include: { gaps: true, planItems: ... }`. Se um user faz 30 diagnosticos (raro mas possivel), serializa 30*(N gaps+M planItems) por SSR. Latencia escala linear. Limite `take: 5` seria suficiente pra UI atual.
- `app/api/opportunities/route.js:118` — `include: { gaps: true }` no findFirst do snapshot. OK (1 snapshot so).

---

## Migrations recentes

| Migration | Safe? | Reversivel? | Observacao |
|---|---|---|---|
| 20260626000000_billing | Sim | Sim (DROP TABLE) | Cria Subscription/UsageMeter/BillingEvent. payload originalmente `NOT NULL`. |
| 20260626100000_usage_meter_tokens | Sim | Sim | ADD COLUMN com DEFAULT — backfill implicito, safe online. |
| 20260626200000_audit_log | Sim | Sim | CREATE TYPE/TABLE — atomico. |
| 20260626300000_rawcv_ttl | Sim | Sim | ADD COLUMN + UPDATE backfill 90 days. SAFE — nao dropa coluna. |
| 20260628000000_outcome | Sim | Sim | CREATE TYPE/TABLE. |
| 20260628100000_audit_outcome | Sim | Nao (ALTER TYPE ADD VALUE) | Postgres nao permite drop enum value sem recriar — esperado. `IF NOT EXISTS` idempotente. |
| 20260628200000_daily_briefing | Sim | Parcial | ADD COLUMN + 2 ALTER TYPE ADD VALUE. |
| 20260628300000_achievements | Sim | Parcial | CREATE TYPE + TABLE + ALTER TYPE NotificationKind ADD VALUE 'ACHIEVEMENT_UNLOCKED' SEM `IF NOT EXISTS` — vai quebrar se rerun em DB que ja tem o value. **Bug menor**: re-rodar a migration em ambiente onde foi parcialmente aplicada falha. |
| 20260629000000_daily_quest | Sim | Sim | CREATE TYPE/TABLE. |
| 20260629100000_restore_knowledge_embedding_idx | **Sim** | Sim | DROP IF EXISTS + CREATE HNSW — idempotente. Resolve gap do Wave 5. |
| 20260629200000_add_linkedin_raw_ttl | Sim | Sim (parcial) | ADD COLUMN + ALTER TYPE ADD VALUE sem `IF NOT EXISTS` (linha `ALTER TYPE "AuditAction" ADD VALUE 'LINKEDIN_RAW_REDACTED';`) — mesma issue do achievements. |

**Nenhuma migration dropa coluna sem backfill.** Bem.

- `migration_lock.toml`: provider `postgresql`. OK.

### Aviso permanente (Wave 5)
`prisma migrate dev` continua quebrando HNSW. Documentar em `prisma/README.md` (nao existe) ou no topo do `schema.prisma`. Adicionar no `package.json` um script `postmigrate` que aplica `prisma/migrations/.../restore-hnsw.sql` defensivamente NAO E FACIL porque a migration ja existe; o risco e DESENVOLVEDOR rodar `prisma migrate dev --create-only` e Prisma gerar nova migration que dropa o HNSW de novo. **Acao recomendada:** comentario em `model KnowledgeChunk` lembrando, mais hook git pre-commit que falha se aparecer `DROP INDEX "KnowledgeChunk_embedding_idx"` em arquivo novo de migration.

---

## Hot queries (N+1, paginacao)

| # | Local | Issue | Fix |
|---|---|---|---|
| 1 | `app/api/gaps/[id]/complete/route.js:83` | `gap.count({ where: { snapshot: { userId } } })` — filtra via relacao. Sem indice em Gap. | Adicionar `@@index([snapshotId, completedAt])` em Gap. |
| 2 | `app/(app)/dashboard/page.js:56-61` | `findMany take:30` com include de 2 tabelas. | Reduzir `take` pra 5; `include: { gaps: true }` so para latest. |
| 3 | `app/api/cron/daily-briefing/route.js:85-128` | Filtro via relacao aninhada (`profile.is { ... rawCv NOT NULL, rawCvRedactedAt NULL }`) + `select.snapshots take 1 include gaps`. | Profile-by-Profile depois nao escala — quando >1k profiles ativos, recomendado ETL/materialized view de "users elegiveis pra briefing". |
| 4 | `app/api/cron/outcome-survey/route.js:185-208` | `where outcomes: { none: { surveyKind } }` — usa anti-join. Performante ate ~100k users. | OK; com index `Outcome (userId, surveyKind)` (nao existe) ficaria melhor. |
| 5 | `app/admin/page.js:225-249` | `user.findMany take:50` com `_count` (4 contagens via relacao). | OK (admin manual). |
| 6 | `app/api/applications/route.js:18-22` | `take: 200`. Bem. | OK. |
| 7 | `app/api/evidence/route.js:21-26` | `take: 200`. Hard-cap aplicado. | OK. |
| 8 | `app/api/notifications/route.js:24-42` | `PAGE_SIZE = 20` + count paralelo. **Best practice.** | OK. |
| 9 | `app/api/opportunities/route.js:356-368` | `deleteMany` + `createMany` sem transacao (intencional, ver comentario). | OK (comment explica trade-off pgbouncer). |
| 10 | `app/api/funnel/route.js:157-200` | **QUEBRA EM RUNTIME** — model nao existe. | Recriar model FunnelEntry. |

### findMany sem `take` (full table scan risk)
Grep: 0 `findMany` sem `take` em rotas user-facing publicas. Todas tem limite. **Bem.**

### `select` faltando (overfetching)
- `app/api/applications/route.js:18` — sem `select`, retorna todas as colunas inclusive `notes` (text). Pra listagem na UI nao precisa.
- `app/api/evidence/route.js:21` — idem, retorna `description` Text completa. UI mostra preview.
- Restante usa `select` adequadamente.

---

## RAG pipeline

### Ingest (`scripts/ingest-knowledge.mjs`)
- Hash do conteudo: `sha256(content).slice(0..32)` (`scripts/ingest-knowledge.mjs:33`). Idempotente.
- Pre-filtra ja-existentes via `contentHash IN (...)` query — economiza chamadas a Voyage.
- Cost: $0.00036 por 30 chunks. Negligivel.

### Embedding (`lib/embeddings.js`)
- Padrao: **Voyage AI** `voyage-3` (1024 dim, $0.06/1M tokens).
- Fallback: OpenAI `text-embedding-3-small` (1536 nativo, truncado a 1024 via param `dimensions`).
- Timeout duro 8s (`lib/embeddings.js:25`).
- Retry 429/5xx ate 2x com backoff exponencial 600ms (`lib/embeddings.js:64`).
- Free tier Voyage: 3 RPM / 10K TPM — risco em traffic spike. Mensagem de erro instruita sugere upgrade ou OpenAI fallback. **Bem.**

### Retrieval (`lib/knowledge/retrieval.js`)
- **Operator `<=>`** (cosine distance pgvector) — bate com `vector_cosine_ops` do HNSW. **Correto.**
- `LIMIT limit*2` (default `limit=3`, busca 6 do vector, 6 do keyword, RRF fusion).
- `inputType: "query"` no Voyage — otimiza recall (correto, diferente do `"document"` no ingest).
- Lazy import do `@/lib/db` (`lib/knowledge/retrieval.js:85-90`) — evita custo em build/test.
- Fallback graceful em 4 camadas: sem provider -> sem DB -> Voyage falhou -> tudo OK = RRF fusion. **Bem.**
- Latencia esperada: 200-500ms (embedding API + query DB), claim na linha 188. Sem instrumentacao real ainda — adicionar `performance.now()` antes do `prisma.$queryRaw` seria barato.

### Risco: top-K
Limite hard-coded `limit*2` (6 candidatos de cada lado, 3 finais). HNSW costuma precisar `ef_search > k`. Postgres pgvector default `hnsw.ef_search=40` cobre. OK enquanto chunks for <10k.

---

## Pool / conexoes

### Singleton (`lib/db.js`)
```js
export const prisma = globalForPrisma.__prisma ?? new PrismaClient({...});
if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;
```
- Singleton em dev (HMR safe). Em prod, cada lambda/edge cria sua instancia (`globalForPrisma.__prisma` so e setado em non-prod) — **isto e intencional pra Vercel Functions** mas significa cold-start = nova conexao DB toda vez. Risco em traffic spike de exaurir Neon pool.

### `DATABASE_URL`
- Nao ha menção a pgbouncer / pooler em `.env` ou config visivel — esperado pra Neon (pool integrado na URL via `pooler`).
- `app/api/opportunities/route.js:349` comentario menciona "pgbouncer transaction-mode trava uma conexao do pool durante toda a duracao" — evidencia que a equipe sabe do trade-off e ja evitou tx longa intencionalmente. **Bem.**
- **Recomendado:** documentar em README a obrigatoriedade de URL com `?pgbouncer=true&connection_limit=1` em Vercel + URL direta (sem pooler) pra `prisma migrate`.

### Cold start
- `prisma generate` ja roda no build (Vercel default). Sem `@prisma/client/edge` — todas as rotas usam `runtime = "nodejs"` (verificado). OK.

---

## LGPD

### `rawCvExpiresAt` + cron redact-cv (`app/api/cron/redact-cv/route.js`)
- TTL de 90 dias. Cron diario `0 6 * * *` (`vercel.json`).
- Query separa rawCv e linkedinRaw em ORs independentes (`route.js:54-84`). **Correto pos Wave 5/Eowyn fix.**
- Backfill da migration `20260626300000_rawcv_ttl` aplicou `NOW() + 90d` em profiles ja existentes. **Correto.**
- Take 500 por run — proxima execucao pega o resto se houver backlog.

### `linkedinRaw` TTL (`app/api/cron/redact-cv/route.js:62-69`)
- Coluna `linkedinRawExpiresAt` adicionada em `20260629200000_add_linkedin_raw_ttl`.
- **Risco residual:** a migration **NAO faz backfill** para profiles legados que ja tinham `linkedinRaw` antes — o comentario admite explicitamente que cabe um cron suplementar futuro. Hoje, registros antigos com `linkedinRaw NOT NULL AND linkedinRawExpiresAt IS NULL` ficam fora do redact pra sempre, viola Art. 16 da LGPD.
- **Fix:** adicionar migration de backfill `UPDATE Profile SET linkedinRawExpiresAt = COALESCE(linkedinRawExpiresAt, NOW() + INTERVAL '30 days') WHERE linkedinRaw IS NOT NULL` (margem 30 dias pra dar tempo de cron pegar).

### `BillingEvent.payload` (`app/api/cron/redact-billing/route.js`)
- Cron mensal `0 4 1 * *` — limpa payload >12 meses. **Correto.**

### `AuditLog` retention
- **NAO HA CRON DE EXPURGO.** AuditLog cresce indefinidamente, especialmente eventos `SECURITY_RATE_LIMIT_HIT` (alta cardinalidade). LGPD/Art. 16 demanda retencao por tempo necessario pra finalidade — 6-24 meses tipico pra auditoria.
- **Fix:** adicionar cron `redact-audit` ou `prune-audit` que apaga eventos >24 meses (definir politica). Indice `@@index([action, createdAt])` ja existe, query suportada.

---

## Top 5 alavancas

1. **CRITICO — Recriar `model FunnelEntry`** em `prisma/schema.prisma` + migration `CREATE TABLE`. Codigo em `app/api/funnel/route.js` + `app/(app)/funil/page.js` quebra em runtime. Sem isso `POST /api/funnel` e `/funil` page retornam 500 garantido.

2. **PERF — Adicionar `@@index([snapshotId, completedAt])` em Gap e PlanItem.** Pelo menos 3 hot paths fazem count/findMany com `completedAt: { not: null }`. Sem indice, full scan da tabela toda vez (`app/api/gaps/[id]/complete/route.js:83`, `app/api/history/actions/route.js:46`, `app/(app)/plano/page.js:36`).

3. **LGPD — Backfill `linkedinRawExpiresAt` para profiles legados.** A migration `20260629200000` adiciona a coluna mas nao popula registros existentes — viola Art. 16. Migration corretiva 1-liner. 30min de trabalho.

4. **OPS — Atualizar `EXPECTED_MIGRATIONS = 15` em `app/api/health/route.js:30`.** Hoje sao 21 migrations, health vai reportar drift permanente. Ou melhor: trocar por checagem dinamica de `_prisma_migrations` count.

5. **LGPD — Implementar cron `prune-audit`** com retencao 18-24 meses no AuditLog. Hoje cresce sem limite e `SECURITY_RATE_LIMIT_HIT` infla rapido. Adicionar entrada em `vercel.json` (`0 5 1 * *` mensal) + rota.

---

## Apendice

### Idempotencia de ALTER TYPE
2 migrations recentes adicionam ALTER TYPE sem `IF NOT EXISTS`:
- `20260628300000_achievements`: `ALTER TYPE "NotificationKind" ADD VALUE 'ACHIEVEMENT_UNLOCKED';`
- `20260629200000_add_linkedin_raw_ttl`: `ALTER TYPE "AuditAction" ADD VALUE 'LINKEDIN_RAW_REDACTED';`

Padrao adotado em outras (`20260628100000_audit_outcome`) usa `IF NOT EXISTS` — recomendado padronizar. Rodar `prisma migrate deploy` em DB ja-migrado seria seguro (Prisma checa `_prisma_migrations`), mas se alguem aplicar manualmente o SQL 2x, quebra. Risco baixo, fix trivial em proximas migrations.

### Resumo de queries auditadas
- ~50 arquivos com chamadas `prisma.*` em `app/` + `lib/`.
- 0 findMany sem `take`.
- 21 findMany com `take` <= 200.
- 8 `include` com relacao + 1 nivel (sem N+2).
- 0 loop com `await prisma.*` dentro (sem N+1 classico).
- 4 chamadas a `prisma.funnelEntry` apontam pra **model inexistente**.
