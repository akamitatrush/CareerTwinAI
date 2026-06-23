# Audit DB + Infra — CareerTwin AI

> Data: 2026-06-23 — Branch: redesign/claude-design

## Resumo executivo

Schema bem modelado (19 models, cascade LGPD-correto, índices compostos nas queries quentes). Migrations lineares. Raw SQL pgvector usa template-tag parametrizada — **sem injection**. A dor está na infraestrutura: `build` roda `migrate deploy` (acopla deploy a banco UP), **falta `directUrl`** (Neon pooler indistinguível), **rate limit é in-memory** (em serverless multiplica por instância), CI não roda lint nem security scan, PITR/restore não documentados.

## Achados por severidade

### Crítico
1. **Rate limit em memória num runtime serverless** — `lib/rate-limit.js:8` Map em escopo de módulo; em Vercel cada lambda tem o seu Map. Defesa anti-abuso LLM efetivamente neutralizada.
2. **`prisma migrate deploy` no build** — `package.json:8`. Cada Preview/Production aplica migrations em prod. PRs simultâneos com migrations divergentes → race. Rollback impossível porque build consome a migration.
3. **Sem `directUrl`** — `prisma/schema.prisma:9-12`. Em Neon, `migrate` precisa do unpooled. Hoje funciona "por sorte"; dev colando URL pooled vê migration travar.

### Alto
4. **`$queryRawUnsafe("SELECT 1")` no health** — `app/api/health/route.js:29`. Literal estática, seguro, mas mau padrão. Trocar por `$queryRaw\`SELECT 1\``.
5. **`.env.example` falta `NEXT_PUBLIC_ENV` e `DIRECT_URL`** — `sentry.client.config.js:11` lê `NEXT_PUBLIC_ENV` não documentado.
6. **CI só roda vitest** — `.github/workflows/ci.yml`. Sem `next lint`, `prisma validate`, `npm audit`, Dependabot.
7. **Sem PITR/restore documentado** — `docs/OBSERVABILITY.md` cobre Sentry/PostHog/UptimeRobot mas **nada sobre Neon backup**. RTO/RPO indefinidos.
8. **Vercel deploya mesmo se CI falhar** — sem gate GitHub→Vercel. Push pra main vira deploy independente do `ci.yml`.

### Médio
9. **`vercel.json` mínimo** — sem `regions`, sem `functions.*.maxDuration` global. Rotas LLM-heavy (`analyze`, `tailor`, `chat`, `interview`) **não declaram `maxDuration`** — herdam 10s Hobby/60s Pro silenciosamente. Só `app/api/opportunities/route.js:15` declara.
10. **N+1 no digest cron** — `app/api/cron/digest/route.js:75-119` itera serial sobre users. OK pra 200, estoura quando passar de ~100 reais.
11. **Sem `select` projetando** em `app/api/score/latest-with-history/route.js:25-33` e `lib/data-export.js`. `include: { gaps, planItems }` puxa textos longos (`porque`, `microacao`). Over-fetching.
12. **`KnowledgeChunk` sem índice em `tags`/`audience`** — `schema.prisma:359`. Só `topic`.
13. **`BillingEvent.payload` sem retenção** — `schema.prisma:432`. Webhook Stripe replicado sem TTL.

### Baixo
14. **`String[]` em skills/tags** perde normalização. Duplicatas case-diferente vistas em `lib/skills-taxonomy.js`.
15. **`$transaction` 1x só** (`analyze/route.js:298`). Nested writes do Prisma cobrem o resto.
16. **Build faz `prisma generate` 2x** (`postinstall` + `build`). Tempo morto.

## Detalhamento Database

**Schema** (`prisma/schema.prisma`, 19 models): Cascade `onDelete` em 17 relações (LGPD: `prisma.user.delete()` apaga tudo via `lib/data-export.js:54`). 2 SetNull intencionais: `TailoredCv.applicationId`, `BillingEvent.userId`. Índices compostos cobrem queries por user+tempo (`ScoreSnapshot`, `Application`, `Notification`, `Evidence`, `TailoredCv`, `UsageMeter`). JSONB onde shape varia (`subScores`, `scoresJson`, `payload`). Moeda: `Application.salario String?` (texto livre), sem bug Float.

**Migrations** (10, 405 linhas SQL): `20260621034958_init` → `20260626000000_billing`. `migration_lock.toml` ok. Usam `IF NOT EXISTS` (`add_cv_docx`, `knowledge_chunks`). Sem down-migrations (prática Prisma) → restore = PITR.

**Raw SQL** (3 sites): `lib/knowledge/retrieval.js:110-124` e `scripts/ingest-knowledge.mjs:147-170` usam template-tag — **seguros**. `app/api/health/route.js:29` usa `Unsafe` com literal (achado #4). Cast `::vector` em string `[v1,...]` montada de `Array.join(",")` sobre `number[]` — sem injection.

**Performance**: `app/api/history/actions/route.js:33-78` é exemplo positivo (`findMany({ where: { in } })` em vez de iterar; comentário linhas 17-21). Falta select em rotas pesadas. Transactions só em `analyze/route.js`.

**Backup**: PITR Neon presumido (free 24h), não documentado. Sem DB staging separado.

## Detalhamento Infrastructure

**Vercel** (`vercel.json`): 1 cron `/api/cron/digest` `0 12 * * 1` (09:00 BRT — sane). Sem `regions`, sem `functions.maxDuration`. ~30 routes Node runtime (correto p/ Prisma).

**Build**: `package.json:8` = `prisma generate && prisma migrate deploy && next build`. Build falha em DB-down; migrate acoplado a deploy (achado #2).

**Secrets**: 29 env vars usadas; `.env.example` lista ~27 — faltam `NEXT_PUBLIC_ENV`, `DIRECT_URL`. Sem hard-coded keys em código.

**Observability**: `/api/health` profundidade OK (DB real, demais são presença de env — sem call externa). `beforeSend` Sentry filtra PII em rotas sensíveis (`sentry.server.config.js:14-26`). PostHog `autocapture:false`, respeita DNT. **Logs não-estruturados** (`console.error` texto livre) — busca em incidente frágil.

**CI/CD**: `ci.yml` (vitest) + `e2e.yml` (Playwright + Postgres service). E2E só em push main ou PR label `e2e`. **Sem** Dependabot, typecheck/lint, security scan, Vercel deploy gate.

## Recomendações priorizadas

1. **(Crítico)** Tirar `prisma migrate deploy` do `build`. Mover pra GitHub Action de release manual antes do Vercel deploy.
2. **(Crítico)** Trocar rate limit em-memória por Upstash Redis. Manter interface `guardLLM/tooMany`.
3. **(Crítico)** `directUrl` no schema + `DIRECT_URL` no `.env.example`.
4. **(Alto)** `$queryRawUnsafe` → `$queryRaw` template tag em `health/route.js:29`.
5. **(Alto)** `.github/dependabot.yml` + `npm audit --audit-level=high` no `ci.yml`.
6. **(Alto)** Documentar PITR Neon + restore. Definir RTO/RPO.
7. **(Médio)** `functions.*.maxDuration` global (30s) em `vercel.json` + 60s em `/api/{chat,tailor,interview,analyze}`.
8. **(Médio)** `select` projetando em `score/latest-with-history` e `data-export` paginado.
9. **(Médio)** `npm run lint` no `ci.yml`. Gate Vercel em CI green.
10. **(Baixo)** Logger estruturado.

## Métricas

- **Models**: 19. **Migrations**: 10 (405 linhas SQL). **Enums**: 7.
- **Índices compostos**: 14. **Cascade**: 17 / **SetNull**: 2.
- **Routes API**: ~30. Com `maxDuration` declarado: **1**.
- **Raw SQL**: 3 sites (2 seguros, 1 `Unsafe` com literal).
- **Env vars em código**: 29. **Em `.env.example`**: ~27.
- **CI workflows**: 2. Sem Dependabot, sem typecheck/lint, sem security scan.
