# Backend Health Audit — Saruman — 2026-06-26

> Frente Wave 11 — RESEARCH-ONLY. Sem alterações de código, sem `prisma migrate`, sem `next build`.
> Branch `redesign/claude-design` em `/home/akametatron/Downloads/careertwin-aiV2/careertwin-ai`.
> Comparação com `docs/security/architecture-review-2026-06-25.md` (Saruman Wave 4).

---

## Executive Summary

- **Cron auth** consolidado: `lib/cron-auth.js` (timing-safe + aceita `Authorization: Bearer` E `x-cron-secret`) está em uso em **todos os 6 crons**. Não há comparação manual residual. Eixo 2 resolvido.
- **LinkedIn raw TTL** está fechado end-to-end: `Profile.linkedinRawExpiresAt` é setado no único ponto que escreve `linkedinRaw` (`app/api/linkedin/parse/route.js:168,178`); cron `redact-cv` filtra por ambos os TTLs em separado; `LINKEDIN_RAW_REDACTED` está presente no enum `AuditAction` (`prisma/schema.prisma:540`). Eixo 3 resolvido.
- **Regressão estrutural do RAG segue ativa** (Saruman Wave 4 já alertou). A migration nova `20260625045109_add_funnel_and_welcome/migration.sql:2` contém `DROP INDEX "KnowledgeChunk_embedding_idx";` e o restore subsequente (`20260629100000`) só recoloca o índice. Como `prisma/schema.prisma:384` declara a coluna como `Unsupported("vector(1024)")` sem `@@index`, **o próximo `prisma migrate dev` vai gerar outro DROP**. Loop estrutural não resolvido — P0 recorrente.
- Cobertura de defesas continua **muito heterogênea**: `withApiGuard` aplicado em apenas **11/55 rotas**; Zod `.parse/safeParse` em **18/55**; rate-limit em **17/55** (concentrado nas LLM-routes, OK por design). Detalhes na matriz.
- **Race conditions**: o padrão read-then-write fora de transaction continua espalhado (`applications/[id]` PATCH, `gaps/[id]/complete`, `plan-items/[id]/complete`, `notifications/[id]/read`). Em quase todos os casos o dano real é mitigado por idempotência aplicacional (achievements unique constraint, completedAt set fixo). Mas dois pontos abrem janelas funcionais: `applications` POST sem unique de dedup e PATCH sem optimistic lock.
- **EXPECTED_MIGRATIONS=15** em `app/api/health/route.js:31` está desalinhado com as **21 migrations atuais** no diretório → health.payload mente sobre `expected`, e o `ok>=` ainda passa por sorte.

---

## Cobertura de defesas — Matriz por rota

Legenda: **Y** = presente; **N** = ausente; **n/a** = não aplica (sem body/sem ação sensível); ★ = HMAC/signature ao invés de session.

| Rota | auth() | Zod (.parse/safeParse) | withApiGuard | try/catch DB/LLM | Audit log | Rate-limit |
|---|---|---|---|---|---|---|
| `app/api/admin/usage/route.js` | Y (owner) | n/a (GET) | N | Y | N | N |
| `app/api/analyze/route.js` | Y (opt anon) | Y | Y | Y (9) | Y | Y |
| `app/api/applications/[id]/route.js` | Y | Y | N | Y (1) | N | N |
| `app/api/applications/route.js` | Y | Y (POST) | N | Y (2) | N | N |
| `app/api/assessments/[kind]/route.js` | Y | Y | N | Y (5) | N | N |
| `app/api/auth/[...nextauth]/route.js` | n/a (NextAuth) | n/a | n/a | n/a | n/a | n/a |
| `app/api/auth/welcome-sent/route.js` | Y | N (no body) | N | N | N | Y |
| `app/api/billing/checkout/route.js` | Y | N (whitelist manual) | N | Y (3) | N | N |
| `app/api/billing/plan/route.js` | Y | n/a (GET) | N | N | N | N |
| `app/api/billing/portal/route.js` | Y | N | N | Y (1) | N | N |
| `app/api/billing/webhook/route.js` | ★ HMAC Stripe | ★ via constructEvent | N | Y (3) | Y | N |
| `app/api/chat/route.js` | Y | Y | Y | Y (5) | Y | Y |
| `app/api/concursos/route.js` | Y | N (GET querystring) | Y | N | N | Y |
| `app/api/courses/click/route.js` | Y (opt) | Y | N | Y (1) | N | Y |
| `app/api/cron/daily-briefing/route.js` | ★ CRON_SECRET | n/a | N | Y (4) | Y | n/a |
| `app/api/cron/digest/route.js` | ★ CRON_SECRET | n/a | N | Y (1) | N | n/a |
| `app/api/cron/outcome-survey/route.js` | ★ CRON_SECRET | n/a | N | Y (2) | Y | n/a |
| `app/api/cron/redact-billing/route.js` | ★ CRON_SECRET | n/a | N | Y (1) | N | n/a |
| `app/api/cron/redact-cv/route.js` | ★ CRON_SECRET | n/a | N | Y (2) | Y | n/a |
| `app/api/cron/usage-cleanup/route.js` | ★ CRON_SECRET | n/a | N | Y (1) | N | n/a |
| `app/api/cv/analyze-bullets/route.js` | Y | Y | Y | Y (3) | Y | Y |
| `app/api/cv/upload/route.js` | Y | N (formData + magic bytes) | N | Y (4) | Y | N |
| `app/api/estagios/route.js` | Y | N (GET) | Y | N | N | Y |
| `app/api/evidence/[id]/route.js` | Y | Y | N | Y (3) | N | N |
| `app/api/evidence/route.js` | Y | Y | N | Y (2) | N | N |
| `app/api/funnel/route.js` | Y | Y | N | Y (2) | N | Y |
| `app/api/gaps/courses/route.js` | Y | Y | N | Y (2) | N | Y |
| `app/api/gaps/[id]/complete/route.js` | Y | n/a (path param) | N | Y (3) | N (achievements) | N |
| `app/api/gaps/requirements/route.js` | Y | N (GET) | N | Y (2) | N | N |
| `app/api/gaps/summary/route.js` | Y | N (GET) | N | Y (2) | N | N |
| `app/api/health/route.js` | n/a (público) | n/a | N | Y (7) | n/a | Y (cheap) |
| `app/api/history/actions/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/history/score/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/interview/route.js` | Y (opt anon) | Y | Y | Y (4) | Y | Y |
| `app/api/linkedin/parse/route.js` | Y (opt anon) | Y | Y | Y (4) | Y | Y |
| `app/api/me/daily-quest/complete/route.js` | Y | N (path) | N | Y (1) | N | Y |
| `app/api/me/daily-quest/route.js` | Y | n/a (GET) | N | Y (2) | N | Y |
| `app/api/me/export/route.js` | Y | n/a (GET) | N | Y (1) | Y (DATA_EXPORTED) | N |
| `app/api/me/outcome/route.js` | Y | Y | N | Y (2) | Y | Y |
| `app/api/me/preferences/route.js` | Y | Y (.strict()) | N | Y (2) | Y | N |
| `app/api/metrics/median/route.js` | n/a (público) | n/a | N | Y (1) | n/a | n/a (CDN cache) |
| `app/api/notifications/[id]/read/route.js` | Y | n/a (path) | N | Y (1) | N | N |
| `app/api/notifications/read-all/route.js` | Y | n/a | N | Y (1) | N | N |
| `app/api/notifications/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/opportunities/route.js` | Y (opt anon) | Y | Y | Y (6) | Y | Y |
| `app/api/plan-items/[id]/complete/route.js` | Y | n/a (path) | N | Y (2) | N | N |
| `app/api/portfolio/import/route.js` | Y | Y | Y | Y (9) | Y | Y |
| `app/api/profile/completeness/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/profile/onboarding/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/profile/refresh/route.js` | Y | Y | Y | Y (6) | Y | Y |
| `app/api/score/latest-with-history/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/tailor/route.js` | Y (opt anon) | Y | Y | Y (5) | Y | Y |
| `app/api/tailored-cvs/[id]/route.js` | Y | n/a (path) | N | Y (2) | N | N |
| `app/api/tailored-cvs/route.js` | Y | n/a (GET) | N | Y (1) | N | N |
| `app/api/_track/route.js` | Y (opt anon) | N (whitelist manual) | N | Y (2) | N | Y |

Totalizadores:
- **withApiGuard**: 11/55 (mantém vs Wave 4 = 11/55).
- **Zod**: 18/55 com schema explícito; ≈30 são GETs sem body legítimos. Apenas `billing/checkout` parseia body manualmente (whitelist `planId`).
- **Audit**: 14/55, concentrado em ações LGPD/sec sensíveis. **Billing flows não emitem audit** — gap relevante (P2).
- **Rate-limit**: 17/55 — todas as rotas LLM cobertas; ações idempotentes/baratas não.

---

## Findings

### P0 — Quebrado / Inseguro

#### P0.1 — Loop estrutural do HNSW index em `KnowledgeChunk` (recorrente, Wave 4 ainda válido)

- **Evidência**: `prisma/migrations/20260625045109_add_funnel_and_welcome/migration.sql:2` contém `DROP INDEX "KnowledgeChunk_embedding_idx";`. Cronologia das migrations (`20260625045109` ≺ `20260629100000_restore_knowledge_embedding_idx`) faz com que `prisma migrate` aplique drop → restore, resultado final ok hoje.
- **Problema persistente**: `prisma/schema.prisma:384` declara `embedding Unsupported("vector(1024)")?` SEM um índice declarável (Prisma não suporta `@@index` em `Unsupported`). Logo, qualquer próximo `prisma migrate dev` que detecte drift entre schema e DB **vai gerar nova migration com `DROP INDEX KnowledgeChunk_embedding_idx`**, repetindo Wave 5.
- **Impacto**: cada regressão derruba RAG vector path pra sequential scan (lib/knowledge/retrieval.js:115,122 — operador `<=>`), inflando latência e custo Voyage.
- **Mitigação durável (recomendada, requer ação)**:
  1. Padrão `migration_lock.toml` para o índice OU
  2. Pre-commit hook que rejeita migration nova contendo `DROP INDEX "KnowledgeChunk_embedding_idx"` sem o `CREATE INDEX` correspondente OU
  3. Script `prisma generate` wrapped que falha CI se gerar drop do índice.
- **Status**: PRECISA TESTE EM PROD/STAGING (rodar `prisma migrate dev --create-only` em sandbox e observar se nova migration vazia surge com drop).

#### P0.2 — `EXPECTED_MIGRATIONS` desincronizado

- **Evidência**: `app/api/health/route.js:31` `const EXPECTED_MIGRATIONS = 15;` vs `ls prisma/migrations | wc -l` = 21 (20 dirs + lock).
- **Impacto**: payload `health.migrations.expected` mente; o `ok = count >= 15` passa por acidente (deploy em prod com 21 ainda dá `ok: true`). MAS se prod tiver `count < 21` (rollback parcial), saúde aparece OK falsamente.
- **Risk class**: monitoring blind spot (não exploit). Classificado P0 só por ser trivial de corrigir e ter sido explicitamente perguntado.

### P1 — Risco médio

#### P1.1 — TOCTOU em `applications/[id]` PATCH (Sauron Wave 4 P1 ainda aberto)

- **Evidência**: `app/api/applications/[id]/route.js:60` `prisma.application.findFirst` → `:89` `prisma.application.update` SEM transaction e SEM cláusula `where: { id, status: current.status }` (optimistic lock).
- **Race**: dois PATCH paralelos `A→B` e `A→C` ambos passam ownership, ambos criam `ApplicationEvent`. Um dos events vai ter `fromStatus` errado (vê o pre-update do outro). `appliedAt/rejectedAt/offerAt` sets condicionais (`if !current[dateField]`) também são lidos antes — pode dobrar/ignorar.
- **Fix sugerido**: `prisma.$transaction` Serializable ou update com `where: { id, userId, status: current.status }` + retry se `count===0`.

#### P1.2 — `applications` POST dedup race (sem unique constraint)

- **Evidência**: `app/api/applications/route.js:75-105` busca `findFirst({ userId, titulo, empresa })` → cria. Schema `prisma/schema.prisma:215-238` modelo `Application` NÃO tem `@@unique([userId, titulo, empresa])`.
- **Impacto**: duplo clique em "Salvar vaga" gera 2 `Application` idênticas. Achievement `FIRST_APPLICATION` ainda funciona via unique de achievements, mas funil fica duplicado.
- **Fix sugerido**: adicionar `@@unique([userId, titulo, empresa])` em migration nova OU usar `upsert` com chave composta.

#### P1.3 — Race em `gaps/[id]/complete` dispara notification duplicada

- **Evidência**: `app/api/gaps/[id]/complete/route.js:45,57,69` — check `gap.completedAt` null, update, depois `notify(...)`.
- **Race**: dois POST simultâneos passam o check, ambos updates (idempotente no DB), ambos disparam `notify` → 2 notificações duplicadas no sininho. `grantAchievement` é safe via unique `(userId, kind)` (`lib/achievements.js:625`).
- **Severidade**: cosmético em UX. Fix com `updateMany({ where: { id, completedAt: null }, ... })` e checar `count===1` antes do notify.

#### P1.4 — `plan-items/[id]/complete` mesmo padrão

- **Evidência**: `app/api/plan-items/[id]/complete/route.js:43-65`. Sem notify externa, apenas update idempotente. Sem dano funcional, mas TOCTOU presente.

#### P1.5 — Cron `digest` sem outer try/catch ou `withApiGuard`

- **Evidência**: `app/api/cron/digest/route.js` tem apenas 1 try/catch (no allSettled interno linha 78). Bloco `handle()` exterior pode lançar (ex: `searchJobs` provider falha não-rejected pelo allSettled) e devolver HTML pro Vercel Cron retry.
- **Impacto**: Vercel Cron interpreta HTML 500 como falha e retry, podendo refazer batch de digest e duplicar emails.
- **Mitigação atual**: `Promise.allSettled` cobre maioria dos paths. Resta o pré-batch (linha 76 — `uniqueRoles.map(searchJobs)`).
- **Fix**: envolver `handle()` em `withApiGuard` ou try/catch externo. Mesma observação vale para `usage-cleanup` e `redact-billing` (1 try cada, mas blocos simples e curtos).

#### P1.6 — Billing endpoints sem audit log

- **Evidência**: `checkout/route.js`, `portal/route.js`, `plan/route.js` — nenhum tem `audit(...)`. Stripe webhook (`webhook/route.js`) audita. Mas iniciar checkout/abrir portal são ações sensíveis com efeito financeiro.
- **Risk**: rastreabilidade pós-incident e LGPD (Art. 37 — registro de operações).
- **Fix**: adicionar `audit({ action: "BILLING_CHECKOUT_INITIATED", target: User:..., req, meta:{planId}})`.

### P2 — Hardening recomendado

#### P2.1 — Schema sem `.strict()` em vários Zod

Não auditei todos os schemas em `lib/validators.js`, mas spot-check:
- `EvidencePatchBody`, `ApplicationCreateBody`, `ApplicationPatchBody` — verificar se cada um termina em `.strict()` para defesa anti mass-assignment. Sauron Wave 4 já citou. `me/preferences` faz certo (`route.js:54: .strict()`).
- **Ação**: pull request descritivo simulando "adicionei `cpf: 'x'`" e ver se passa pra hardening.

#### P2.2 — `score/latest-with-history` puxa payload superdimensionado

- **Evidência**: `app/api/score/latest-with-history/route.js:25-33` busca 30 snapshots com `include: { gaps: true, planItems: ... }` apenas para usar `[0]`, `[1]` e `[length-1]` linhas 45-47.
- **Impacto**: 30 × (gaps[~10] + planItems[~12]) por request — possivelmente centenas de KB serializadas em JSON pra calcular 2 deltas.
- **Fix**: separar em 3 queries (latest com include, prev sem include, first selecionando só `overall+createdAt`) com `Promise.all`.

#### P2.3 — `enforceUsage` não cobre algumas rotas LLM

- `chat` usa `checkDailyBudget` + `trackTokenUsage` separado do `enforceUsage`. Diferente dos outros LLM endpoints. Documentado no comentário. Aceitável.
- `funnel`/`concursos`/`estagios` não rodam LLM (são scrapers/queries), só guardLLM. OK.

#### P2.4 — Cache de embeddings ausente

- `lib/llm-cache.js` cacheia respostas LLM (system+user → output). Não cacheia embeddings.
- `lib/knowledge/retrieval.js:95` chama `embedQuery(query)` a cada request, mesmo pra queries idênticas.
- **Impacto**: cada chamada de RAG consome Voyage AI ($). Para queries repetidas (mesma intent), waste.
- **Fix**: cache em Redis com key `embed:sha256(text)` TTL 24h.

#### P2.5 — `evidence/[id]` PATCH read-then-update fora de transaction

- **Evidência**: `evidence/[id]/route.js:74` find ownership → `:96` update.
- **Impacto**: cosmético. Owner verificado, sem dupla escrita de side effect. Aceitável mas inconsistente com padrão `deleteMany({id, userId})` na linha 118.
- **Fix**: usar `updateMany({ where: { id, userId }, data })` e checar count.

### P3 — Polish

#### P3.1 — Comentários de "audit Wave 4" desatualizados

`schema.prisma`, comentários em vários routes ainda apontam "red-team 2026-06-25 P0". Cosmetic, mas vamos manter limpo.

#### P3.2 — `extractBearer` regex tolerante demais

`lib/cron-auth.js:41` `/^bearer\s+(.+)$/i` aceita qualquer whitespace incluindo `\t\n`. Aceitável (Bearer só vem por header HTTP que strip CR/LF), mas `\t` tecnicamente passa. Não-issue prático.

#### P3.3 — `console.error` em `welcome-email` único caso a auditar

`lib/email/send-welcome.js:124`: `console.error("[welcome-email] falhou:", e?.message || e)`. Se `e` for objeto Anthropic/Resend com `email` no detail, pode vazar PII em logs. Mitigado por `e?.message ||` que prefere string. Aceitável.

---

## Saúde por área

### 1. Cron auth helper (Eixo 2) — ✅ OK

- `lib/cron-auth.js`: timingSafe + length-pad + aceita ambos headers. Implementação correta.
- 6/6 crons usando o helper. Nenhuma comparação manual residual.
- Únicos hits a `x-cron-secret` no codebase são comentários históricos.

### 2. LinkedIn raw TTL (Eixo 3) — ✅ OK

- Único ponto que escreve `linkedinRaw`: `app/api/linkedin/parse/route.js:166,176`. Ambos setam `linkedinRawExpiresAt: ttlExpiresAt` (90 dias). ✅
- `app/api/cron/redact-cv/route.js:65-69`: filtro `linkedinRawExpiresAt: { lt: now, not: null }` + `linkedinRawRedactedAt: null`. ✅
- `LINKEDIN_RAW_REDACTED` no enum: `prisma/schema.prisma:540`. ✅
- `redact-cv` emite audit `LINKEDIN_RAW_REDACTED` separado de `CV_DELETED` (linhas 142-148). ✅

### 3. RAG / KnowledgeChunk (Eixo 4) — ⚠️ Loop ativo

- HNSW restaurado em `20260629100000`. ✅ hoje.
- Migration `20260625045109_add_funnel_and_welcome` ainda contém o DROP (committed por Pippin em `11ae58b`). Não regressão nova, mas a *causa raiz* (Prisma não sabe do índice) **continua não tratada**.
- Operador `<=>` (cosine) ainda em `lib/knowledge/retrieval.js:112,115,120,122` — match com index `vector_cosine_ops`. ✅
- Sem cache de embeddings (`embedQuery` re-roda toda vez). Hardening P2.4.

### 4. Race conditions (Eixo 5) — ⚠️ Patterns repetidos

- `enforceUsage`: Serializable transaction ✅ (`lib/billing/enforce.js:175-204`).
- `applications/[id]` PATCH: TOCTOU sem TX (P1.1).
- `applications` POST dedup: race sem unique constraint (P1.2).
- `gaps/[id]/complete`: TOCTOU, notify pode duplicar (P1.3). Achievement safe via unique.
- `plan-items/[id]/complete`: TOCTOU sem dano material (P1.4).
- `notifications/[id]/read`: TOCTOU sem dano (`readAt` set fixo).
- `evidence/[id]` PATCH: TOCTOU sem dano (P2.5).
- Stripe webhook idempotente via `BillingEvent.stripeEventId` unique. ✅

### 5. Error handling (Eixo 6) — ⚠️ Inconsistente

- `withApiGuard` em 11/55. Rotas sem ele que throw inesperado retornam HTML 500 (Next default). Frontend pega `Unexpected token '<'`.
- LLM: timeout 45s + AbortController ✅ (`lib/llm.js:25,37`).
- Resposta de erro genérica fallback presente nas LLM-routes principais.
- PII em logs: spot-check OK. Único caso questionável é `welcome-email` (P3.3).
- `metrics/median` faz failsafe stub em 200 — aceitável pra dashboard.

### 6. Performance (Eixo 7) — ⚠️ Pontos isolados

- N+1 clássico não encontrado em rotas centrais.
- `Promise.all` / `Promise.allSettled` bem usado em `analyze`, `chat`, `daily-briefing`, `digest`, `notifications` GET, `health`, `me/daily-quest`, `opportunities`.
- `score/latest-with-history` puxa 30 snapshots+gaps+planItems pra usar 3 (P2.2).
- Cache de embeddings ausente (P2.4).
- `daily-quest` e `daily-briefing` paralelizam search providers via allSettled — bom padrão.

### 7. Middleware / routing pós Wave 10A (Eixo 8) — ✅ OK

- `/candidaturas` agora em `app/(app)/candidaturas/`. Route group `(app)` é invisível em URL — pathname continua `/candidaturas`. ✅
- `lib/auth-protected-paths.js:27` lista `/candidaturas`. ✅
- Middleware (`middleware.js:107`) matcher `["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"]` continua válido.
- `isProtected()` semantics correta (`pathname === p || pathname.startsWith(p + "/")` — anti prefix-collision).
- Redirects para `/candidaturas`: `app/meus-dados/page.js:135`, `app/experimentar/page.js:329,683`, `app/(app)/evidencias/page.js:23 (comentário)`. Todos como links absolutos `/candidaturas` — funcionam normais. ✅
- Sem rotas órfãs.

### 8. Migrations health (Eixo 9) — ⚠️ Drift

- `npx prisma validate` ✅ ("schema is valid").
- `npx prisma format --check` BLOQUEADO (sandbox permite só leitura). PRECISA TESTE LOCAL.
- 21 migration dirs vs `EXPECTED_MIGRATIONS=15` no health (P0.2).
- Ordem cronológica respeitada (todas `2026MMDDhhmmss_nome`).
- `20260625045109_add_funnel_and_welcome` contém DROP do HNSW (P0.1 raiz).
- Campos órfãos: `Profile.linkedinRawExpiresAt` declarado e em uso ✅. Schema enxuto.

---

## Comparação com Architecture Review Wave 4

| Eixo | Wave 4 | Hoje (Wave 11) |
|---|---|---|
| HNSW dropado em migrate | P0 ativo | P0 latente — restaurado, mas causa raiz não-tratada → próximo `migrate dev` repete |
| Zod em /55 | 18/55 | 18/55 (sem regressão, sem melhoria) |
| withApiGuard em /55 | 11/55 | 11/55 (sem mudança) |
| Cron secret manual | Comparação ad-hoc | **Resolvido** — `lib/cron-auth.js` adotado em todos os 6 |
| LinkedIn raw TTL | Faltava coluna/cron | **Resolvido** — migration + cron + audit + setter |
| TOCTOU em applications/gaps | P1 ativo | Mantido (P1.1, P1.3, P1.4) — não tratado |
| `safeExternalUrl` em courses/click | Faltava | **Resolvido** — `lib/validators.js:9` + `courses/click/route.js:39` |
| `god-stylesheet`, JS sem TS | Polish backlog | Não tocado (fora do escopo backend) |
| `EXPECTED_MIGRATIONS` | n/a | **Novo gap** — 15 vs 21 |
| Billing audit log | n/a | **Novo gap** — checkout/portal sem audit |

**Resumo**: Wave 5 acertou em 3/3 dos itens explicitamente prometidos (cron-auth, LinkedIn TTL, safeExternalUrl). Wave 4 ainda tem 3 itens P0/P1 abertos no backend (HNSW root cause, applications PATCH TOCTOU, dedup race). Wave 11 adiciona 2 P0/P1 menores (migrations count, billing audit).

---

## Recomendações priorizadas

### Resolver imediatamente (ordem decrescente de risco)

1. **Bloquear a regressão do HNSW de uma vez por todas** (P0.1). 3 opções pareceram viáveis na auditoria:
   - Adicionar nota em `schema.prisma` + git pre-commit hook detectando o pattern `DROP INDEX.*KnowledgeChunk_embedding` sem CREATE pareado.
   - Mover o índice para um `prisma/manual-indexes.sql` aplicado por script idempotente fora do fluxo Prisma.
   - Bem custoso: trocar `Unsupported("vector(1024)")` por um wrapper SQL view (não recomendado nesse ciclo).
2. **Sincronizar `EXPECTED_MIGRATIONS`** (P0.2) — uma linha em `app/api/health/route.js:31`. Ou dinamicamente: contar via `import.meta.glob` de `prisma/migrations/*`.
3. **`applications/[id]` PATCH em transaction** (P1.1) — adicionar Serializable ou optimistic lock.
4. **Unique constraint em `Application(userId, titulo, empresa)`** (P1.2) — migration + adaptar handler pra `upsert`.

### Endurecer (próximo ciclo)

5. **Outer `try/catch` em todos os crons** (P1.5) — proteger Vercel Cron retry loop.
6. **Audit log em billing flows** (P1.6) — checkout/portal/plan.
7. **`gaps/[id]/complete` updateMany com filtro completedAt:null** (P1.3) — evita notify duplicada.
8. **Optimizar `score/latest-with-history`** (P2.2) — 3 queries pequenas em paralelo.

### Backlog

9. Cache de embeddings em Redis (P2.4).
10. Auditar `.strict()` em todos os schemas Zod (P2.1).
11. Padronizar update-with-where em `evidence/[id]` PATCH (P2.5).

---

## Caveats de método

- Auditoria foi grep/Read estática; não rodei testes nem `prisma migrate` (read-only). Race conditions identificadas são plausíveis pelo padrão de código mas exigem reprodução com carga concorrente para confirmar exploit real. PRECISA TESTE EM PROD/STAGING para confirmar P0.1 (rodando `prisma migrate dev --create-only` num clone do DB).
- `npx prisma format --check` foi BLOQUEADO pelo sandbox; `npx prisma validate` passou. Confirmação visual do `format` precisa de execução local pelo Sérgio.
- Não inspecionei integralmente `lib/validators.js` — spot-check apenas em `safeExternalUrl` e `PreferencesBody`. P2.1 pede revisão dirigida.
