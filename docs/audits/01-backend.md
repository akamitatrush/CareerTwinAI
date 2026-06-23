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
