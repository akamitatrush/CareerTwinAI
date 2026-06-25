# Architecture Review — Saruman — 2026-06-25

Escopo: estrutura, modularidade, escalabilidade, manutenibilidade.
**RESEARCH-ONLY** — nenhum arquivo fora deste documento foi modificado.
Não duplica achados de Sauron (vulnerabilidades) nem Galadriel (controles defensivos).

---

## Executive Summary

- **Stack está em JavaScript puro, sem TypeScript** (`jsconfig.json:1`, ausência de `tsconfig.json`, zero arquivos `*.ts` em código de produção). Para uma base com 55.9k linhas JS e 30 rotas API tocando Prisma + Stripe + LLM, falta de tipos estáticos é a maior fonte de dívida estrutural — vai cobrar caro a partir de ~80k LOC.
- **Discrepância de versão Next**: README/comentários referenciam Next 15, mas `package.json:21` fixa `"next": "^14.2.35"`. Decisões arquiteturais (CSP sem nonce em `middleware.js:13-19`, `dynamic = "force-dynamic"` no root layout) são justificadas por Next 14, mas o discurso interno aponta pra Next 15. Alinhar a narrativa ou migrar.
- **`lib/career-paths.js` (1021 linhas) e `lib/jobs/providers/fixtures.js` (815 linhas) são dados estáticos no bundle de runtime** — deveriam ser JSON em `/data` carregados via `import` server-side ou `next/cache`. Como hoje, bloat a árvore de chunks server e aumenta cold-start de qualquer rota que (transitivamente) importe.
- **`app/globals.css` tem 6470 linhas / 224k** — é um god-stylesheet. Concentra tokens + temas + design lab + landing + dashboard. Refactor pra módulos CSS por rota ou Tailwind reduziria CSS shipping ~70%.
- **Schema Prisma maduro (24 modelos, 38 indexes), LGPD bem modelado (TTL em rawCv, cascade em User)** — esse é o ponto mais forte do projeto. Manter. A maior dívida no DB é o uso intensivo de `Json?` (5 colunas) sem schema validation em leitura.

---

## Strengths

1. **Boundaries de domínio em `lib/` claros** (`lib/billing/`, `lib/jobs/`, `lib/knowledge/`, `lib/assessments/`, `lib/email/`, `lib/scoring/`, `lib/concursos/`, `lib/estagios/`). Cada feature de negócio cresce em sua própria pasta — não há indício de "utils.js" balde-de-lixo. (`lib/` listado em ls).
2. **LLM provider abstraído de verdade**. `lib/llm.js:230-298` define `completeJSONWithUsage` único, com switch interno Anthropic/OpenAI por env (`LLM_PROVIDER`). Streaming separado em `lib/llm-stream.js`. Trocar provider é mexer em 1 lugar.
3. **Tiering Standard vs Fast (Sonnet vs Haiku) explícito**. `lib/llm.js:19-20` + `completeJSONFast` (linha 283-289). Rotas leves (parsing LinkedIn, perguntas curtas) consomem Haiku 4.5 com custo 1/4 — decisão econômica embutida no design, não em comentário.
4. **Token usage + cost tracking integrado ao billing**. `lib/llm.js:80-84` computa custo USD por modelo, `trackTokenUsage` em `lib/billing/enforce.js:228-256` persiste em `UsageMeter.costUsd` (Decimal(10,6)), `checkDailyBudget` (linha 274-299) hard-caps por plano. Toda chamada LLM contabilizada e capada — raro nesse estágio de projeto.
5. **TOCTOU fix em billing via Serializable transaction** (`lib/billing/enforce.js:174-219`). Race entre N requests paralelas é serializada pelo Postgres. Comentário (linha 131-141) documenta por que e como — exemplar.
6. **safe-fetch com IP pinning anti-SSRF/DNS-rebinding** (`lib/safe-fetch.js:1-28`). Para `portfolio/import`, importante. Implementação correta usando `http.request` com `lookup` custom em vez de gambiarra com `Agent`.
7. **Idempotency baked-in onde importa**: `BillingEvent.stripeEventId @unique` (`schema.prisma:463`), `Achievement (userId, kind) @@unique` (linha 618), `DailyQuest (userId, questDate) @@unique` (linha 667), `UsageMeter (userId, feature, periodKey) @@unique` (linha 446). Stripe retry + double-submit não corrompem estado.

---

## Concerns & Risks

### Critical

- **God-stylesheet `app/globals.css` (6470 linhas / 224k)** — todos os tokens de design, temas, animations, layout de landing+dashboard+admin+design-lab num arquivo só. Shipping pra todo cliente em todas as rotas (importado em `app/layout.js:1`). Impacto: TTFB+, FCP+, manutenção penosa (cada feature edita o mesmo arquivo → conflitos de merge constantes). Sugestão: extrair em `app/(app)/*/styles.module.css` + `components/site/styles.css` separados, ou migrar pra Tailwind. Mesmo split bruto por seção (`globals.tokens.css`, `globals.app.css`, `globals.site.css`) já reduz cognitivo.

- **Ausência de TypeScript** — projeto tem 30 rotas API, 24 modelos Prisma, contratos LLM (parseJSON em `lib/llm.js:208-214`), pricing/billing, RAG. Sem tipos: cada `prisma.user.findUnique` retorna `any`, cada `data.choices?.[0]?.message?.content` (linha 185) é shape implícito. Refactoring pesa N vezes mais. Sugestão: migração gradual — começar por `lib/billing/`, `lib/llm.js`, `lib/validators.js` (já usa Zod, fácil derivar `z.infer<typeof X>`). `jsconfig.json:1` já tem path alias — só virar `tsconfig.json` com `allowJs: true`.

### High

- **Dados estáticos enormes no bundle**:
  - `lib/career-paths.js` (1021 linhas, 38k) — roadmaps curados.
  - `lib/jobs/providers/fixtures.js` (815 linhas) — catálogo de vagas ilustrativas.
  - `lib/assessments/definitions.js` (363 linhas) — questionários.
  - `lib/skills-taxonomy.js` (181 linhas) — taxonomia.

  Hoje são módulos JS importados — embedam no chunk server. Ideal: mover pra `data/*.json`, importar via `import roadmaps from "./data/roadmaps.json"` (Webpack tree-shake melhor) ou ainda melhor, KnowledgeChunk no DB (já existe a infra). Hoje **toda rota que importa transitivamente `@/lib/career-paths` carrega 38k de dados estáticos**.

- **3 arquivos > 600 linhas em `app/(app)/` são páginas Server Components com lógica de negócio inline**:
  - `app/privacidade/page.js` (1189 linhas) — página estática gigante; pode ser quebrada em sections.
  - `app/(app)/transparencia/page.js` (953 linhas) — mesma coisa.
  - `app/(app)/dashboard/page.js` (698 linhas) — mistura Server Action `dismissWelcomeAction`, fetch de 3 entidades, score projection (linhas 82-99), 7+ blocos JSX. Refactor sugerido: extrair `lib/dashboard/projections.js` (pure functions) + sub-componentes server.

- **`app/api/profile/refresh/route.js` (608 linhas) duplica lógica de `app/api/analyze/route.js` (568 linhas)**. Mesmo prompt, mesmo pipeline LLM+jobs, mesma persistência, mesmo SSE pattern. Sugestão: extrair `lib/analysis/run-diagnosis.js` com a função `runDiagnosis({ userId, role, cv, snapshotId? })` e ambas rotas viram orquestradores finos (~80 linhas cada). Diff atual entre os dois é difícil de manter alinhado — cada novo prompt mexe em dois arquivos.

- **`PRICES` table duplicada em `lib/llm.js:69-74` e `lib/llm-stream.js:25-30`** — comentário em llm-stream:24 admite "mantenha sincronizado". Mudou preço do Sonnet em jul/2026? Mexe em dois lugares; esquecer um = logUsage emite `costUsd:null` e quebra `checkDailyBudget`. Sugestão: extrair pra `lib/llm/pricing.js` único, importado nos dois.

### Medium

- **Validação Zod aplicada em apenas 18 de 55 route.js** (~33%). `grep "z.object|safeParse" app/api → 18 files`. Rotas críticas (analyze, profile/refresh, tailor, chat, billing/webhook) usam, mas listing/notification/admin não. Para um produto que escala, parsing manual em rotas non-LLM é fonte garantida de bug. Pode aceitar tech debt se rotas restantes forem read-only sem body, mas vale auditar.

- **`withApiGuard` aplicado em apenas 11 de 55 rotas**. Sem ele, Prisma errors viram HTML response → cliente quebra com "Unexpected token <". `lib/api-handler.js:6-9` documenta o problema. Decisão: aplicar em **todas** as rotas exceto `/api/auth/*` (que é Auth.js) e `/api/billing/webhook` (que devolve status específico pro Stripe). Quick win — uma linha por rota.

- **JSON columns sem schema validation em leitura**: `Profile.perfilJson`, `Profile.linkedinJson`, `Profile.portfolioJson`, `ScoreSnapshot.perfilJson`, `AssessmentResult.scoresJson`, `BillingEvent.payload`. (`schema.prisma:106,141,314,465`). Hoje shape é "o que a LLM devolveu por último". Quando UI espera `perfilJson.skills` e LLM antiga gravou `perfilJson.habilidades`, render quebra silenciosamente. Sugestão: helpers `parseProfileJson(raw)` em `lib/validators.js` com Zod default-aware, chamar em todo SELECT.

- **N+1 evitado, mas opportunity for shared queries**: `app/(app)/dashboard/page.js:54-63` busca `profile + snapshots(30) + median` em Promise.all — bom. Porém `oportunidades/page.js`, `gaps/page.js`, `plano/page.js`, `conta/page.js` repetem o mesmo `prisma.scoreSnapshot.findFirst({ where: { userId }, orderBy, include: { gaps: true } })`. Sugestão: `lib/queries/snapshot.js#getLatestSnapshotWithGaps(userId)` — DRY + ponto único pra otimizar (ex: cache por request).

- **Logger PII filter é por chave-nome, não por value pattern**: `lib/logger.js:14-30` redige `email/cv/token` mas se alguém logar `{ debug: "email: foo@bar.com" }`, vaza. Pragmático pro MVP; em escala vale regex secundário pra emails+CPF+telefone no `sanitize`.

- **Sentry `tracesSampleRate: 0.1` no client / `0.05` no server** (`sentry.client.config.js:8`, `sentry.server.config.js:24`). Razoável pra agora, mas Sentry quota explode com daily-briefing+digest cron que faz LLM por user. Vale separar `tracesSampler` dinâmico por `req.url` — 1.0 em routes 5xx, 0.01 em routes ok.

- **`app/(app)/conta/page.js` (653 linhas)** tem 3 server actions inline + mixed concerns (settings + LGPD export + CV analyzer). Quebrar em sub-rotas (`/conta/dados`, `/conta/cv`, `/conta/seguranca`) ou ao menos extrair as actions pra `app/(app)/conta/actions.js`.

- **`force-dynamic` no root layout** (`app/layout.js:7-10`) — comentário admite o motivo (CSP nonce que não funciona). Resultado: **zero páginas estáticas** no projeto, mesmo `/termos` e `/privacidade` (1189 linhas de prosa estática). Custo: $/request + latência. Quando migrar pra Next 15 / Cache Components, removendo `force-dynamic`, todas as páginas marketing podem virar `prerender`.

### Hot Files (> 500 linhas)

| Arquivo | Linhas | Tipo | Refactor? |
|---|---|---|---|
| `app/privacidade/page.js` | 1189 | Static page | Sim — quebrar em sections components |
| `lib/career-paths.js` | 1021 | Static data | Sim — virar JSON |
| `app/(app)/transparencia/page.js` | 953 | Static page | Sim — sections |
| `lib/jobs/providers/fixtures.js` | 815 | Static data | Sim — virar JSON ou KnowledgeChunk |
| `app/(app)/autoconhecimento/[kind]/AssessmentClient.js` | 789 | Client component | Talvez — quebrar por step do quiz |
| `app/page.js` | 701 | Landing client | Sim — extrair OnboardingChat (já existe), sub-components de Report |
| `app/(app)/dashboard/page.js` | 698 | Server page | Sim — extrair `lib/dashboard/projections.js` + sub-components |
| `app/(app)/conta/page.js` | 653 | Server page + actions | Sim — sub-rotas |
| `app/api/profile/refresh/route.js` | 608 | API route | Sim — duplica analyze; extrair `lib/analysis/run-diagnosis.js` |
| `app/api/analyze/route.js` | 568 | API route | Sim — mesmo refactor acima |
| `lib/estagios/index.js` | 567 | Domain logic | Talvez — separar parsing de scraping |
| `app/(app)/estagios/page.js` | 563 | Server page | Talvez — filtros formam blocos coesos |
| `tests/unit/profile-refresh.test.js` | 543 | Test | OK — testes podem ser longos |

**Não preocupantes** (size justificado): `lib/validators.js` (395 — Zod schemas explícitos têm tamanho legítimo), `lib/assessments/definitions.js` (363 — dados de quiz curados), `lib/billing/enforce.js` (327 — domínio complexo, código denso e comentado), `lib/llm.js` (300 — provider switch já é o mínimo), `lib/auth.js` (284 — config NextAuth + audit hooks + rate-limit dedicado).

---

## Coupling & Cohesion Analysis

**Acoplamento entrada (`@/lib/X` mais importados em `app/`)**:
- `@/lib/auth` (66) — esperado (RBAC everywhere)
- `@/lib/db` (61) — esperado, prisma client global
- `@/lib/rate-limit` (19), `@/lib/audit` (19) — alta reutilização, sinal positivo (segurança cross-cutting)
- `@/lib/validators` (13), `@/lib/api-handler` (11), `@/lib/llm` (10), `@/lib/billing/enforce` (10)

**Observações**:
- Não existe ciclo aparente: `lib/auth.js` evita importar `lib/rate-limit` (cita o motivo em `lib/auth.js:21-24`, define rate-limit interno duplicado). Isolamento intencional, mas duplica ~70 linhas (`_authMemBuckets` + `checkAuthRate`). **Aceitar tech debt** — alternativa (extrair `lib/rate-limit-core.js`) carrega risco de regredir o ciclo.
- `lib/jobs/index.js:8-44` faz **dynamic import por env** dos providers — design correto pra opt-in de ATS (sem `ADZUNA_APP_ID`, o módulo nunca entra no graph). Modelo replicável para qualquer plugin futuro.
- `lib/llm.js` e `lib/llm-stream.js` são paralelos mas independentes — comentário em `llm-stream.js:6-10` justifica. Aceitar; talvez extrair `lib/llm/pricing.js` + `lib/llm/usage-logger.js` compartilhados.
- `lib/billing/` é o cluster mais coeso do projeto (3 arquivos, 460 LOC total, single responsibility).

**Boundary violation suave**: `app/api/profile/refresh/route.js` e `app/api/analyze/route.js` espelham a mesma lógica core. Não há `lib/` dono dessa lógica. Já cobrado em "High".

**Server vs Client split**: 43 arquivos com `"use client"`, 5 com `"use server"` (rotas explícitas). Server Components dominam — bom. `"use server"` é usado em actions inline em `dashboard/page.js`, `conta/page.js` — padrão idiomático Next 14 quando action é local; quando action vira reused (chat envia para 3 rotas), promover pra `lib/actions/X.js` com `"use server"` no topo.

---

## LLM Architecture Review

**Forte:**
- Camada provider-agnostic em `lib/llm.js:230-298` — switch Anthropic/OpenAI por env, cache key por modelo (linha 244), graceful degradation se cache falha (linhas 254-257).
- Streaming separado em `lib/llm-stream.js` com timeout 60s (mais generoso que JSON 45s em `lib/llm.js:25`), justificativa correta no comentário (linhas 14-15).
- Cost tracking + budget guardrails: `checkDailyBudget` (linha 274 enforce.js) bloqueia ANTES do LLM rodar quando user passou de cap diário ($0.10 free, $5 pro). Defesa real contra runaway cost.
- Cache LLM com Redis em prod, Map em dev (`lib/llm-cache.js:30-40`), TTL 1h, key SHA-256(model+system+user) — correto para inputs determinísticos (parsing LinkedIn, opportunities porques). Opt-out explícito (`cache: false`) em rotas user-specific (`app/api/analyze/route.js:169`).
- Retry com backoff exponencial e shouldRetry seletivo (408, 425, 429, 5xx) — `lib/llm.js:33-66`. **Sem retry em streaming** (justificado: streaming não é idempotente, linha 15 llm-stream.js).
- Timeout 45s no JSON (linha 25) — ajustado de 15s após observar Sonnet 4.6 lento sob carga. Documento de aprendizado no próprio código.

**Pontos de atenção:**

- **`PRICES` table duplicado** entre `lib/llm.js:69-74` e `lib/llm-stream.js:25-30` — JÁ cobrado em High.

- **Sem evals automatizados além de RAG**. `package.json:18-20` define `eval:rag` script (`tests/eval/rag/run-eval.mjs`). Recall@3 ≥ 70% gateado. **Falta eval pros prompts LLM** (analyze, tailor, opportunities) — quando o prompt em `lib/prompts.js` muda, não há regressão automática. Para feature crítica (score do user depende do output), vale criar `tests/eval/llm/*.js` com fixtures de CV → diagnóstico esperado (similarity ≥ 0.85).

- **Streaming não tem retry** (justificado), mas também **não tem reconnection client-side documentado**. Se o stream cair no meio, user vê resposta truncada. Aceitar tech debt se streaming for usado só em chat (best-effort UX), mas documentar.

- **`completeJSON` wrapper legacy** (`lib/llm.js:294-297`) ainda existe. Migrar callers (`cron/daily-briefing` em `app/api/cron/daily-briefing/route.js:308`) pra `completeJSONWithUsage` + `trackTokenUsage` — sem isso, custo de cron não conta no budget e dashboard de admin não enxerga.

- **Sem circuit breaker no provider**. Se Anthropic ficar 500ing 10min seguidos, todo request roda os 2 retries de 45s — userland percebe latência alta. `withRetry` em `lib/retry.js` é genérico; não há tracking de healthcheck do provider. Pra escala futura, considerar gateway tipo Vercel AI Gateway ou helper interno que monitora taxa de erro por modelo e abre breaker.

- **System prompt isolation**: bom (linha 6 llm.js documenta). Mas não há sanitização de user input antes de injetar no prompt template (`lib/prompts.js`). Sauron deve já ter cobrado prompt injection — minha visão arquitetural: separar `lib/prompts/templates.js` (puros) de `lib/prompts/sanitize.js` (defesas). Hoje tudo em `prompts.js` único.

- **Sem tier de modelos por usuário/plano**. Free vs Pro hoje usam o mesmo Sonnet/Haiku. Diferencial de plano atualmente é só *quantidade* (limites em `lib/billing/plans.js`). Margem maior se Pro for `claude-opus-4-7` (já listado em PRICES) — decisão de produto, mas arquitetura já comporta (basta `meta.model` por plano em `completeJSON*`).

---

## Database & Prisma Review

**Schema (`prisma/schema.prisma`, 680 linhas, 24 modelos):**

- **Bem normalizado.** User é o "raiz" do grafo, com cascades agressivos (`onDelete: Cascade`) em quase tudo que pendura — LGPD compliance integrado ao schema, não a um job de cleanup. Exceto onde faz sentido preservar histórico (`BillingEvent.userId @relation onDelete: SetNull` linha 468, `AuditLog onDelete: SetNull` linha 512, `TailoredCv.applicationId onDelete: SetNull` linha 490). Decisões corretas.

- **Indexes (38 totais)**: bem cobertos para queries listadas:
  - `ScoreSnapshot @@index([userId, createdAt])` (linha 148) — atende `findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })` que aparece em ~7 rotas.
  - `Application @@index([userId, status])` + `@@index([userId, updatedAt])` (linhas 229-230) — kanban + timeline.
  - `Notification` duplo: `(userId, createdAt)` + `(userId, readAt)` (linhas 290-291) — listing + unread counter.
  - `UsageMeter @@unique([userId, feature, periodKey])` (linha 446) — atende upsert atômico + lookup do month.
  - `AuditLog @@index([action, createdAt])` (linha 515) — atende dashboards de admin.

- **Index possivelmente faltando**:
  - `BillingEvent (type, processedAt)` existe (linha 471) — bom.
  - `Outcome (kind, occurredAt)` existe (linha 583) — bom.
  - **`Profile.rawCvExpiresAt`** — cron `/api/cron/redact-cv` faz `WHERE rawCvExpiresAt < now`. Sem index, full-scan. Verificar a query do cron; se mata bem, OK; se mais de 10k profiles, criar `@@index([rawCvExpiresAt])`.
  - **`User.lastDigestAt`/`User.lastDailyBriefingAt`** — crons fazem `WHERE digestEnabled = true AND OR(lastDigestAt IS NULL, lastDigestAt < cutoff)` (`api/cron/digest/route.js:70-73`). Sem index, mesma preocupação. Compor `@@index([digestEnabled, lastDigestAt])`.

- **JSON columns sem schema validation** — já cobrado em Medium.

- **`KnowledgeChunk.embedding Unsupported("vector(1024)")`** (linha 377) — Prisma não tem mapping nativo. Acesso via `$queryRaw` em `lib/knowledge/retrieval.js:110-124`. Comentário em schema (linhas 365-368) documenta. Aceitar — não há alternativa hoje.

- **`KnowledgeChunk_embedding_idx` foi removido na migration `20260625045109_add_funnel_and_welcome`** (`migration.sql:2`). Significa que a busca vetorial faz scan sequencial? Verificar se há outro index sendo criado dinamicamente (ex: HNSW via SQL manual fora do Prisma). Se não, queries de RAG são O(n) na tabela toda — funciona pra 1k chunks, não pra 100k. **High concern** ao escalar a base.

**Migrations (19 totais):**
- Todas atômicas — nenhuma > 200 linhas.
- 1 destrutiva: `20260625045109_add_funnel_and_welcome` (`DROP INDEX KnowledgeChunk_embedding_idx`). Cobrar replano de index estratégia.
- Naming convention temporal correto (`YYYYMMDDHHMMSS_descricao`).
- Schema drift defense: `lib/api-handler.js:32-39` captura `P2022/P2025` (column missing/record not found) e devolve 503 explicando "migration pendente". Bom.

**Query patterns:**
- Não há N+1 evidente (`grep "for/forEach/map" + await prisma` retornou vazio na busca top-level). `Promise.all` ou `findMany + include` em todo lugar.
- 91 ocorrências de `select:` — bom hábito de não puxar tudo.
- 9 ocorrências de `include: { gaps: true }` — esperado (gaps são pequenos, snapshot owns). Não enxergo problema.
- `data-export.js:43-50` faz 4 findMany em Promise.all (linha 43-50) — correto.

**`prisma.$transaction` Serializable** em `lib/billing/enforce.js:175,203` é o único uso explícito — exatamente onde precisa (anti TOCTOU). Bom criterio.

---

## Testing Strategy Review

**Cobertura (82 unit tests, 6 e2e specs, 1 eval RAG):**

| Hot area | Cobertura observada | Avaliação |
|---|---|---|
| Auth | `auth-rate-limit.test.js` | Razoável |
| Billing | `billing-plans`, `billing-enforce`, `api-billing-checkout`, `api-billing-webhook`, `api-billing-portal-plan` | **Forte** |
| LLM | `api-analyze`, `api-analyze-streaming`, `api-chat`, `api-chat-streaming`, `api-tailor`, `api-interview`, `api-cv-analyze` | **Forte** |
| LGPD | `api-me-export`, `lgpd-export-delete.spec.js` (e2e) | Razoável |
| Validators | `validators-pitch.test.js`, `assessments.test.js` | Médio (falta cobrir AnalyzeBody, OppBody, ChatBody explicitamente) |
| Crons | `api-daily-briefing`, `api-daily-quest` | Médio |
| ATS providers | `ats-providers-extra.test.js`, `estagios-provider.test.js` | Médio |

**Padrões observados:**
- `tests/helpers/api.js` define `makeReq`, `setupAuthSession`, `mockPrisma` reutilizáveis — fixture/factory pattern correto. Mock plano com todos os models (linha 42-142). Reset helper (linha 146-166). Modelo replicável.
- `vitest.config.js` configura coverage v8 com `include: lib/, app/api/` — bem definido. Sem threshold mínimo (linha 12) — decisão pragmática mas vale subir progressivamente.
- E2E em Playwright (`playwright.config.js`) com `webServer` auto-start. 6 specs cobrem onboarding, lgpd, login, navigation, theme, persist+erase. **Faltam**: billing end-to-end (checkout → webhook → enforce), opportunities full flow, profile refresh.
- Eval RAG separado (`tests/eval/rag/run-eval.mjs`) com gate recall@3 ≥ 70% — exemplar. Replicar pra LLM diagnoses.

**Gaps:**
1. **Sem eval automatizado pros prompts LLM principais** (analyze, tailor). Mudança em `lib/prompts.js` não tem regressão; alto risco.
2. **Sem snapshot test pro schema Prisma** — pode capturar drift acidental (`prisma format --check` no CI ajuda mas não pega lógica de relação).
3. **E2E para billing flow** — checkout falso → webhook idempotência → enforce.
4. **Sem load/stress test** — `enforceUsage` Serializable retry behavior em concorrência real (centenas de requests no mesmo bucket) é teorica.

---

## Performance & Scalability

**Forte:**
- `Promise.all` em rotas críticas — `dashboard/page.js:54-63`, `app/api/analyze/route.js:169` (LLM + searchJobs paralelos, comentário linha 60-62 documenta os 3s economizados), `data-export.js:43-50`.
- `lib/jobs/index.js:8-44` dynamic-imports providers sob demanda — providers não-configurados nunca entram no graph.
- `searchJobs` com cache em `lib/jobs/cache.js`.
- Rate-limit em Redis compartilhado entre lambdas (`lib/rate-limit.js:55-80`).
- `Stripe()` singleton lazy (`lib/billing/stripe.js:12-23`), `_redis` singleton (`lib/rate-limit.js:22-32`), Prisma singleton via global (`lib/db.js:3-13`). Padrão correto pra serverless cold-start.
- `revalidate = 3600 + stale-while-revalidate=21600` em `app/api/metrics/median/route.js:25,32-34` — CDN-cacheable corretamente para o único endpoint público sem PII.

**Pontos de atenção:**
- **`force-dynamic` global** — JÁ cobrado em Medium. Custo direto: nenhuma página tira benefício de ISR/PPR.
- **`globals.css` 224k servido em toda rota** — JÁ cobrado em Critical.
- **`career-paths.js` 38k no bundle server** — JÁ cobrado em High.
- **`next/image` zero usos** — `grep "<Image"` retornou 0. Assets (`/public/`?) e fotos de blog (se houver) provavelmente são `<img>` direto. Para produto que mostra screenshots/logos no marketing (landing tem hero/features/etc), `next/image` é quick win (otimização automática + lazy load).
- **Bundle observability heavy**: PostHog (`posthog-js@^1.391.3`) + Sentry (`@sentry/nextjs@^10.59.0`) ambos no client. Bundle client-side certamente passa 500KB gzipped. Sentry tem `tunnelRoute: "/monitoring"` (`next.config.mjs:30`) — bom pra contornar adblockers, mas adiciona um proxy interno. PostHog sem lazy-load.
- **`Profile.rawCv String? @db.Text`** — CVs colados de 40k chars (linha 42 validators) somados a 10k users = 400MB. Cron de redact-cv reduz, mas durante a janela de 90 dias inflar storage rapidamente. Considerar mover pra blob storage com referência (URL no DB). Aceitar tech debt até ~5k users.
- **`KnowledgeChunk` sem HNSW index ativo** (já cobrado em DB) — escala vetorial linear vai cobrar.

---

## Deployment & DevOps

**Forte:**
- `vercel.json` com 6 crons claramente nomeados (`/digest`, `/daily-briefing`, `/usage-cleanup`, `/redact-cv`, `/outcome-survey`, `/redact-billing`). Schedules sensatos (digest 12h segunda, daily-briefing 11h dom+ter-sex).
- `.env.example` (7.8k) é o **mais completo que eu vi em projeto pre-seed** — cada var tem comentário explicando o que é, onde configurar, qual o fallback. Sergio fez certo aqui.
- CI (`.github/workflows/ci.yml`) com `npm test`, `prisma validate`, `npm audit --audit-level=high --omit=dev` gateando — bom.
- `package.json:13` `postinstall: prisma generate` — evita "esqueci de gerar o client" em deploy.
- `instrumentation.js` (Sentry registration) — usa hook oficial.

**Pontos de atenção:**
- **CI pula lint** (`ci.yml:42` `continue-on-error: true`). Aceitar tech debt mas planejar baseline cleanup.
- **CI pula prisma format check** (`ci.yml:24` `continue-on-error: true`). Cosmético; aceitar.
- **E2E só roda em PR com label `e2e`** (`e2e.yml:5-7`). Justificado (caro + depende de secrets). Considerar smoke E2E rodando em todo PR (login + dashboard básico) e full E2E só com label.
- **Sem deploy preview gating por testes** — se test job rodar, mas Vercel já deu preview, isso não bloqueia merge se "Required Checks" GitHub não estiver configurado. Verificar branch protection rules.
- **`docker-compose.yml`** (595 bytes) — Postgres + Mailpit local. Bom DX. Vale adicionar Upstash mock (testcontainers) ou aceitar que dev local roda sem rate-limit distribuído.

---

## Documentation Gaps

**O que existe é bom:**
- `ARCHITECTURE.md` (33k) com ADRs, stack, diagrama, RAG, billing, observability, segurança, CI/CD, backup. Substancial.
- `docs/audits/` com 8 audits (backend, frontend, db, appsec, AI, palette, mobile, reaudit).
- `docs/reviews/` com hierarchy, dark mode, implementation.
- `docs/RELIABILITY.md`, `docs/OBSERVABILITY.md`, `docs/RAG.md`, `docs/ALGORITHMS.md`.
- `CHANGELOG.md` (20k) — mantido.
- Comentários inline são **excepcionalmente bons** — cada arquivo crítico (`lib/billing/enforce.js`, `lib/llm.js`, `middleware.js`, `lib/safe-fetch.js`) tem narrativa explicando *por que* (não só *o que*). Trade-offs documentados. Saruman aprova.

**Gaps:**
- **Não existe ADR formal por decisão**. `ARCHITECTURE.md` tem seção "Decisoes arquiteturais (ADRs)" mas é uma lista, não ADRs separados em `docs/adr/0001-*.md`. Pra equipe crescer, ADRs versionados ajudam onboard.
- **Sem `RUNBOOK.md`** explicando incident response: "se Anthropic cair, o que acontece?", "se webhook Stripe atrasar 4h, o que fazer?", "como pausar cron de daily-briefing rapidamente?". `RELIABILITY.md` tem fragmentos mas não é runbook.
- **Sem `CONTRIBUTING.md`** — como rodar local? como nomear branches? convenção de commits? Comentário "Skill seguranca-careertwin" no MEMORY do user é interno; precisa ser comitado pra equipe Tera.
- **Schema Prisma documentado em comentários inline** — bom, mas não há **diagrama ER**. Para 24 modelos, vale renderizar com `prisma-erd-generator` ou similar no `npm build` e versionar `docs/schema.svg`.
- **LLM prompts não documentados externamente** — `lib/prompts.js` (289 linhas) tem todos os system prompts inline. Quando QA pergunta "qual prompt geramos pro analyze?", não há referência. Vale extrair `docs/prompts/` com 1 arquivo por prompt (Markdown), e `lib/prompts.js` apenas referencia.

---

## Recommendations

### Quick wins (1-2 dias, alto impacto)

1. **Aplicar `withApiGuard` em todas as 44 rotas restantes** (exceto auth + webhook). Uma linha por rota, evita "Unexpected token <" no client. (`lib/api-handler.js` já existe.)
2. **Extrair `lib/llm/pricing.js`** com a tabela PRICES única, importada por `lib/llm.js` e `lib/llm-stream.js`. Resolve drift de custo.
3. **Adicionar indexes `Profile.rawCvExpiresAt` e `User.[digestEnabled,lastDigestAt]`** — proteção pré-escala dos crons.
4. **Migrar `cron/daily-briefing` de `completeJSON` (legacy) pra `completeJSONWithUsage` + `trackTokenUsage`** — cron passa a contar no budget e dashboard.
5. **Reabilitar index HNSW em `KnowledgeChunk.embedding`** ou documentar por que foi removido (`docs/RAG.md` deve refletir o estado real).

### Structural changes (1-2 semanas, transformador)

6. **Migração gradual pra TypeScript** começando por `lib/llm.js`, `lib/billing/`, `lib/validators.js`, `lib/jobs/types.js` (já tem types.js comentado-como-tipo!). Setup `tsconfig.json` com `allowJs: true` — não é big-bang. Cada PR converte 1-2 arquivos.
7. **Extrair `lib/analysis/run-diagnosis.js`** com a função compartilhada por `/api/analyze` e `/api/profile/refresh`. Reduz ~400 linhas duplicadas e elimina drift.
8. **Quebrar `app/globals.css`** em 3-4 arquivos (`tokens.css`, `app.css`, `site.css`, `admin.css`). Loading condicional via layout específico de cada `app/(group)/`.
9. **Mover dados estáticos do bundle pro DB ou JSON**: `lib/career-paths.js` → `KnowledgeChunk` com topic `career-path` (já tem infra), `lib/jobs/providers/fixtures.js` → `data/job-fixtures.json` carregado por `import` com tree-shake.
10. **Schema validation de Json columns na borda** — `lib/validators.js` exporta `ProfileJsonShape`, `PerfilJsonShape`, `ScoresJsonShape`. Helpers `parseProfileJson(raw)` em todo SELECT. Defesa contra drift de shape entre versões de LLM.

### Strategic (1-3 meses, valor de longo prazo)

11. **Evals LLM automatizados** — espelhar o que `tests/eval/rag/` faz pra prompts críticos. Fixtures de CV+role → diagnóstico esperado (similarity ≥ 0.85). Gate em CI.
12. **ADRs versionados** em `docs/adr/000X-titulo.md` separados — facilita onboard, dá histórico decisional.
13. **`RUNBOOK.md` + `CONTRIBUTING.md`**.
14. **Migração pra Next 15** — vai destravar nonce-based CSP (remove `unsafe-inline` em script-src), Cache Components, PPR (`/termos`, `/privacidade`, `/transparencia` viram prerender). Combinado com #8, reduz CSS/JS shipping de várias rotas em ~60%.
15. **Circuit breaker LLM provider + Vercel AI Gateway** — para escala +10k MAU.

---

## Closing

A arquitetura está acima da média pro estágio. Comentários inline são tese de mestrado em "por que tomei essa decisão" — Sergio fez engenharia, não código. Os concerns que listei não são quebras de design; são pontos onde a base, ao crescer, vai exigir disciplina pra não regredir.

O maior risco arquitetural NÃO é técnico — é que o projeto continua em JS puro enquanto carrega billing, LLM, LGPD, RAG, Stripe webhooks. Quando equipe Tera entrar com 3+ devs, refactors vão custar 3x mais sem tipos.

A maior alavanca de melhoria *imediata* é split do `globals.css` + migração pra TS gradual. As duas combinadas reduzem cognitive load do projeto em ~40% sem mudar funcionalidade.

— Saruman, o Branco
