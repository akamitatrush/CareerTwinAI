# Reliability

Visao consolidada das tecnicas de resiliencia: error boundaries, retry, logging
estruturado e health checks. Tudo client-safe, sem deps novas, sem mexer no
contrato existente das rotas.

## Error boundaries (Next 14 App Router)

| Arquivo | Escopo | Substitui |
| --- | --- | --- |
| `app/global-error.js` | Erros que escapam do root layout | html + body inteiro |
| `app/error.js` | Erros nas paginas publicas (`/`, `/entrar`, `/privacidade`, etc) | so o conteudo da rota; layout permanece |
| `app/(app)/error.js` | Erros nas rotas autenticadas (`/dashboard`, `/oportunidades`, etc) | so o `<main>`; AppShell continua visivel |
| `app/not-found.js` | Rotas que nao batem em nenhum match | pagina 404 estatica |

Todos os boundaries fazem `Sentry.captureException(error, { tags: { error_boundary: ... } })`
no mount, anexando um `digest` (id curto que aparece na UI). O `digest` casa com
o evento no painel do Sentry — usuario reporta o id, ops localiza o erro.

Filtros uteis no Sentry:
- `tags:error_boundary:global_app` — erros que estouraram tudo (criticos)
- `tags:error_boundary:app_route` — erros em rotas autenticadas (parcial)
- `tags:error_boundary:root_route` — erros em paginas publicas

## Suspense / loading

| Arquivo | Quando aparece |
| --- | --- |
| `app/loading.js` | Navegacao client-side em pagina publica |
| `app/(app)/loading.js` | Navegacao para rota autenticada (auth + Prisma resolvendo) |

Skeleton usa `ct-skel-card` (ja existente em `globals.css`). `aria-busy="true"`
sinaliza pra leitores de tela.

## Retry policy

Modulo `lib/retry.js` exporta `withRetry(fn, opts)` e `isRetryableError(err)`.

| Provider | Onde | Tentativas | Base delay | Retriable em |
| --- | --- | --- | --- | --- |
| Anthropic / OpenAI | `lib/llm.js` (`callWithRetry`) | 2 | 400ms | 408, 425, 429, 5xx |
| Voyage AI | `lib/embeddings.js` | 2 | 600ms | 429, 5xx |
| OpenAI Embeddings | `lib/embeddings.js` | 2 | 600ms | 429, 5xx |
| Adzuna | `lib/jobs/providers/adzuna.js` | 2 | 400ms | 429, 5xx |
| Jooble | `lib/jobs/providers/jooble.js` | 2 | 400ms | 429, 5xx |
| Prisma | (interno) | N/A | N/A | (Prisma retry connection internamente) |

Backoff e exponencial com jitter (0-200ms) — evita thundering herd. Cap em
8s por delay individual (default `maxDelayMs`).

Erros 4xx (400, 401, 403, 404, 422) **nao** sao retriados — sao bugs de cliente
ou credencial invalida. Retry desperdica budget pago (LLM) sem chance de sucesso.

## Logging

Modulo `lib/logger.js` exporta `logger.info / warn / error / fatal`.

Saida: 1 linha JSON por chamada, formato:
```json
{ "ts": "2026-06-22T...", "level": "error", "route": "llm.anthropic", "msg": "request failed", "status": 429, "model": "claude-sonnet-4-6" }
```

PII redacted automaticamente. Chaves cobertas: `email`, `phone`, `cpf`, `rg`,
`cv`, `rawCv`, `password`, `token`, `secret`, `apiKey`, `authorization`,
`cookie`, `linkedInUrl`. Sanitize e case-insensitive e recursivo (limite 6
niveis pra evitar DoS de log).

Strings > 2000 chars sao truncadas (`...[truncated]`) — defesa contra logar
um CV inteiro acidentalmente.

Integracao com Sentry: cada `logger.*` adiciona um breadcrumb (categoria=route,
nivel=level) se `globalThis.Sentry` estiver disponivel. Da contexto temporal
quando um erro real e capturado depois.

Usado em produto:
- `lib/llm.js` — falhas e respostas lentas dos providers
- `app/api/health/route.js` — falhas em sub-checks (DB, Redis, etc)

Adopcao incremental: nao force migrate de console.log para logger. Use em
novas rotas e quando estiver tocando codigo critico (billing webhook, cron).

## Health check

`GET /api/health` — publico, sem auth. Pra UptimeRobot / Better Stack.

### Checks atuais

| Check | Tipo | Quebra status |
| --- | --- | --- |
| `database` | Postgres `SELECT 1` | `unhealthy` se falha |
| `llm_configured` | Presenca de chave Anthropic/OpenAI | `unhealthy` se falta |
| `migrations` | Conta `_prisma_migrations` vs `EXPECTED_MIGRATIONS` | `unhealthy` se diverge |
| `last_diagnosis` | Timestamp do ScoreSnapshot mais novo | informativo |
| `last_billing_event` | Timestamp do BillingEvent mais novo + tipo | informativo |
| `knowledge_base` | Contagem de KnowledgeChunk | `degraded` se zero |
| `redis` | Upstash `/ping` (HEAD com timeout 2s) | `degraded` se configurado e fora |
| `llm` | HEAD a `api.anthropic.com` (timeout 2s) | `degraded` se inacessivel |
| `email` / `jobs_providers` / `observability` | Booleanos de env | informativo |

### Classificacao

- **healthy** (HTTP 200) — todos os checks core ok
- **degraded** (HTTP 200) — knowledge base vazia OU redis fora OU LLM provider inacessivel (mas chave existe)
- **unhealthy** (HTTP 503) — DB fora OU sem chave LLM OU migrations divergem

Resposta sempre inclui `check_duration_ms` (total) e `latency_ms` por check com
I/O. Sem PII, sem segredos.

### Atualizar EXPECTED_MIGRATIONS

Ao criar nova migration, edita a constante em `app/api/health/route.js`. Se
esquecer, o check fica `degraded`/`unhealthy` apos deploy ate atualizar — sinal
intencional pra forcar a sincronia.
