# Audit Backend — CareerTwin AI

> Data: 2026-06-23
> Branch: redesign/claude-design
> Auditor: backend code review agent

## Resumo executivo

Backend acima da media de MVP: Zod, IDOR-safe, rate-limit em LLM, error handling defensivo. Top 3: (1) **rate-limit/cache em memoria nao escalam em serverless** — N processos zeram o Map, bypass trivial; (2) **cron digest serializa 200 users com 2-3 awaits/iter** — estoura timeout; (3) **transacao gigante em /opportunities** trava pool. Proximos passos: Upstash, batch-paralelizar cron, `createMany`.

## Achados por severidade

### Critico
- **lib/rate-limit.js:8** — `Map` por processo nao funciona em serverless. Atacante com 10 IPs efetivos multiplica limite por N. Custo: tokens LLM.
- **lib/jobs/cache.js:5** — mesma classe: cada instancia bate APIs externas (Adzuna 250/mes free) independente.
- **app/api/opportunities/route.js:268-284** — `$transaction([deleteMany, ...plano.flatMap(create)])` cria 30+ INSERTs serializados num unico tx. Em pgbouncer transaction-mode, trava pool. Usar `createMany`.

### Alto
- **app/api/cron/digest/route.js:75-119** — loop serial; pior caso 200 users * (searchJobs ~2s + sendEmail ~500ms) ≈ 500s. Sem batching, sem deduplicar `searchJobs` por `role`. Estoura cron Vercel (60s/300s).
- **app/api/analyze/route.js:242-292** — 4 queries serial pos-create (count + findFirst + count(WELCOME) + 2 notifies). Independentes — `Promise.all`.
- **app/api/portfolio/import/route.js:66-78** — `safeLookup` resolve DNS mas `fetch` faz lookup proprio (TOCTOU classico). Comentario admite "mitigacao parcial" mas o gap e maior do que sugere. Para fechar: custom agent com `lookup` no fetch.
- **lib/jobs/index.js:89-101** — fan-out aninhado (role + relaxedRole) serializado por provider. Paraleliza entre providers, mas dentro de cada provider sequencial.

### Medio
- **opportunities/route.js** (297) e **analyze/route.js** (329) — extrair helpers.
- **lib/llm.js:7** — comentario diz "3 tentativas" mas `MAX_RETRIES=2`.
- **lib/llm.js:133** — `PRICES` desatualiza; custos logados podem mentir.
- **cron/digest/route.js:18** — `safeCompare` reimplementa `crypto.timingSafeEqual`; branch `a.length !== b.length` vaza length.
- **/me/export** — sem rate-limit num endpoint custoso (8 queries + stringify). DoS trivial.
- **history/actions/route.js:35** — 4 queries serial; 3 ultimas independentes.
- **lib/notifications.js** — failure-silent sem observability; debt invisivel.
- **lib/embeddings.js:113** — fallback Voyage->OpenAI nao checa OpenAI antes do erro Voyage.

### Baixo
- **profile/{completeness,onboarding}** — sem `runtime = "nodejs"`.
- **lib/auth.js:53** — throw em module load com mensagem ambigua.
- **jobs/providers/{ashby,lever,workable}** — `isBrazil`/`tokenize`/`normalize` duplicados.
- **Magic numbers** `take:200`/`take:30` espalhados.
- **opportunities/route.js:131** — regex `/[̀-ͯ]/g` cryptic; usar `\p{M}`.

## Detalhamento por area

### API routes (32)
- **Zod:** 12/32 (POSTs/PATCHes). GETs nao precisam.
- **Error handling:** try/catch em ~95% das areas com I/O. Mensagens em PT pro user, detalhe so no log. Status codes corretos — 404 pra IDOR, 413/415/422/502 semanticos.
- **Idempotencia:** `gaps/[id]/complete`, `plan-items/[id]/complete`, `notifications/[id]/read` com `alreadyDone:true`.
- **Timeouts:** llm 45s, embeddings 8s, providers 4-8s, portfolio 6s. Coerente.

### lib/ helpers
- **rate-limit.js / jobs/cache.js**: single-node, critico em prod.
- **llm.js**: retry exponential + jitter, AbortController, log JSON, fallback provider. Solido.
- **embeddings.js**: graceful Voyage->OpenAI com mensagens acionaveis.
- **notifications.js**: enum allowlist, clamp, fail-silent (com ressalva — sem observability).
- **data-export.js**: `Promise.all` em 8 queries. Bom.
- **scoring/subscores.js**: puro, sem I/O. Admite limitacao regex de datas.

### Middleware
- CSP pragmatica documentada (nonce nao funciona em Next 14+Vercel). `frame-ancestors 'none'`, `object-src 'none'`. Sem HSTS/Referrer/Permissions-Policy (fora do escopo).
- Matcher exclui assets e api/auth. OK.

### Performance / N+1
- **`include`** em `score/latest-with-history` (gaps + planItems) — single JOIN. OK.
- **N+1**: nenhum nas routes. Em cron, users com mesmo `role` poderiam memoizar `searchJobs`.

### Error patterns
- Sem stack/PII vazando. Sentry `beforeSend` strip body em sensitive routes.
- Logging estruturado so em `lib/llm.js:146`. Resto `console.error(string)`.

### Code quality
- 2 funcoes >270 linhas (`analyze`, `opportunities`).
- Duplicacao em `jobs/providers/{ashby,lever,workable}` (helpers BR/tokenize).

## Recomendacoes priorizadas

| Issue | Arquivo:linha | Sev | Esforco |
|---|---|---|---|
| Rate-limit memory bypass serverless | lib/rate-limit.js:8 | Critico | M (4h) |
| Cache de jobs in-memory | lib/jobs/cache.js:5 | Critico | M (4h) |
| Transacao gigante /opportunities | app/api/opportunities/route.js:268 | Critico | S (1h) |
| Cron digest sem batching | app/api/cron/digest/route.js:75 | Alto | M (3h) |
| analyze: 4 queries serial | app/api/analyze/route.js:242 | Alto | S (30m) |
| SSRF portfolio: lookup TOCTOU | app/api/portfolio/import/route.js:108 | Alto | M (2h) |
| /me/export sem rate-limit | app/api/me/export/route.js:8 | Medio | S (15m) |
| history/actions queries serial | app/api/history/actions/route.js:35 | Medio | S (30m) |
| Routes >270 linhas | analyze + opportunities | Medio | M (6h) |
| safeCompare custom no cron | app/api/cron/digest/route.js:18 | Medio | S (10m) |
| Comentario llm.js obsoleto | lib/llm.js:7 | Baixo | XS (5m) |
| Duplicacao jobs/providers | lib/jobs/providers/*.js | Baixo | M (2h) |

## Metricas

- LOC backend: **~7920** (api 3307, lib 4537, middleware 77)
- Endpoints: **32 route.js** (~50 handlers)
- Sem rate-limit: **24** — 8 LLM tem; `/me/export` deveria; GETs OK
- Sem Zod: **20** — quase todos GETs sem body
- Try/catch coverage: **~95%** das areas com I/O
- `runtime="nodejs"`: **30/32**

## Remediacao 2026-06-23 — Rate-limit/cache serverless + custo

Status: **resolvido** os 2 criticos de memoria em serverless + custo amplification.

- **lib/rate-limit.js**: reescrito com fallback `@upstash/redis` (HTTP REST, funciona em edge). Sem `UPSTASH_REDIS_REST_URL` setado cai pra Map local (dev/CI). `guardLLM`/`checkLimit` agora **async** — todas as 8 rotas LLM atualizadas (`await guardLLM(...)`).
- **lib/jobs/cache.js**: mesma estrategia. `cacheGet`/`cacheSet` async, callers em `lib/jobs/index.js` atualizados.
- **lib/billing/enforce.js**: `enforceUsage` AGORA INCREMENTA ATOMICAMENTE dentro de `$transaction({ isolationLevel: "Serializable" })`. Fix TOCTOU: routes que chamavam `enforceUsage` + `trackUsage` (4 rotas) tiveram o segundo removido. `trackUsage` mantido como legacy pra back-compat. Novas helpers: `trackTokenUsage(userId, feature, {tokensIn, tokensOut, costUsd})` e `checkDailyBudget(userId, planId)` com hard-cap por plano (`free=$0.10/dia`, `pro=$5/dia`, `team=$20/dia`) — defende contra runaway cost.
- **Migration `20260626100000_usage_meter_tokens`**: adiciona `tokensIn` (Int), `tokensOut` (Int), `costUsd` (Decimal(10,6)) em `UsageMeter`.
- **Testes**: `tests/unit/rate-limit.test.js` (novo, 10 testes — fallback in-memory + isolamento por bucket). `billing-enforce.test.js` cobre TOCTOU (10 reqs paralelas com used=0, limit=3 → exatamente 3 passam) + `trackTokenUsage` + `checkDailyBudget`.
- **Setup prod**: `.env.example` documenta como criar Upstash Redis free tier + setar vars em Vercel.

Itens restantes (sem mudanca): cron digest batching, opportunities transacao gigante, /me/export rate-limit, helpers duplicados em providers.

## Remediacao 2026-06-23 — Cron batching + SSRF TOCTOU + chat ownership + auth rate-limit

- [x] **Cron digest serial -> batching paralelo + role dedup** — `app/api/cron/digest/route.js` reescrito. `BATCH_SIZE=10` com `Promise.allSettled` por lote, pre-fetch de `searchJobs` por role unico (de 200 chamadas pra N roles unicos). Tempo pior caso: ~500s -> ~60s, dentro do timeout Vercel Cron. `safeCompare` agora usa `crypto.timingSafeEqual` nativo (antes branch `a.length !== b.length` vazava length).
- [x] **SSRF TOCTOU em portfolio/import** — Novo helper `lib/safe-fetch.js` com `safeFetchExternal()` que faz DNS lookup, valida IP, e FIXA o IP no socket via `lookup` custom em `node:http`/`node:https`. Fecha gap entre `safeLookup` antigo e o novo lookup do socket fetch. Route atualizada pra usar `safeFetchExternal` em `fetchSiteText`. Tabela ampliada de IPs reservados (CGNAT, multicast, IPv4-mapped). Testes: `tests/unit/safe-fetch.test.js` (16 casos).
- [x] **/api/chat sem ownership check** — Removidos `perfil` e `gaps` do `ChatBody` schema (`lib/validators.js`). Rota agora busca `Profile.perfilJson` + `ScoreSnapshot.gaps` do DB via `session.user.id` (IDOR-safe). Cliente `components/ChatModal.js` atualizado pra nao enviar mais esses campos. Adicionado early return 401 se sem session. Testes: `tests/unit/chat-ownership.test.js` (8 casos `.strict()` rejeitando campos extras).
- [x] **/api/auth/* sem rate-limit** — `lib/auth.js` agora envolve `sendVerificationRequest` em ambos providers (Resend + Nodemailer) com `enforceAuthRate(identifier)`. Limite 3 magic-links/email/hora, Upstash em prod / Map em dev. Log censurado (`abc***@dominio`). Erro lancado (`rate_limited`) - Auth.js mantem resposta opaca pro cliente (anti-enumeration). Testes: `tests/unit/auth-rate-limit.test.js` (7 casos).
- [x] **Middleware PROTECTED desync com auth.config** — Novo `lib/auth-protected-paths.js` (single source of truth) consumido tanto por `middleware.js` quanto por `auth.config.js`. Antes: middleware tinha 2 regex, auth.config tinha 10 prefixos — drift garantido. Agora: lista unica de 25 prefixos, helper `isProtected(pathname)` com semantica `startsWith` correta (sem confundir `/conta` com `/contas-publicas`). Testes em `chat-ownership.test.js` cobrem o helper.
