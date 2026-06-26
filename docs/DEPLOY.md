# Deploy

## Migrations Prisma

A partir de 2026-06-26, migrations **NAO** rodam mais automaticamente no `next build`.

### Por que mudou

Antes: `"build": "prisma generate && prisma migrate deploy && next build"`.

Problema: Vercel rebuilda Preview e Production em qualquer push. PRs paralelos
com migrations divergentes (mesmas tabelas, ordens diferentes) geravam race
condition no `_prisma_migrations`. Pior: build sem `DATABASE_URL` (preview
sem env apontando pro DB) quebrava sem motivo claro.

Agora: `"build": "prisma generate && next build"`. Migration e passo manual
do deploy.

### Como aplicar migration nova

**Dev local:**

```bash
npx prisma migrate dev --name <nome_da_migration>
```

Isso cria o SQL em `prisma/migrations/<timestamp>_<nome>/migration.sql` E aplica
no DB local.

**Producao (Vercel):**

Opcao 1 — manual antes do deploy:

```bash
DATABASE_URL=postgres://user:pass@host:5432/db npx prisma migrate deploy
```

Roda **antes** de promover a branch pra producao no Vercel.

Opcao 2 — Vercel "Install Command" (recomendado pra automacao):

Settings -> Build & Development Settings -> Install Command:

```
npm install && npx prisma migrate deploy
```

Assim a migration corre uma vez por deploy, antes do build, dentro do mesmo
ambiente. Failure aborta o deploy (correto — sem schema certo, app quebra).

Opcao 3 — script `db:migrate` adicionado em `package.json`:

```bash
npm run db:migrate
```

E so um alias pra `prisma migrate deploy`. Util pra rodar localmente apontando
pra um DB remoto via `DATABASE_URL`.

### Checklist de deploy com migration nova

1. PR mergeado em `main` traz a nova migration em `prisma/migrations/`.
2. Antes de promover pra producao: rodar `npm run db:migrate` apontando pro
   DB de prod (use credenciais com permissao de DDL).
3. Confirmar com `npx prisma migrate status` que esta tudo aplicado.
4. Promover deploy no Vercel.
5. Se algo quebrar, rollback do deploy nao desfaz a migration — precisa
   migration reversa criada manualmente (boa pratica: cada migration nova ja
   nasce com uma "down" mentalizada).

## Cron Jobs

Configurados em `vercel.json`. Header `x-cron-secret` precisa estar setado no
Vercel Cron config (Settings -> Cron Jobs -> Headers). Cron usa **convencao
Unix** (day-of-week 0-6, 0 = domingo) — Vercel **nao aceita** intervalos
estilo `2-7` em day-of-week (max 1-7 segundo POSIX, mas o parser do Vercel
rejeitou na pratica). Use lista enumerada quando precisar pular um dia.

| Path | Schedule | Funcao |
|------|----------|--------|
| `/api/cron/digest` | `0 12 * * 1` (Seg 12h UTC / 9h BRT) | Email semanal de vagas |
| `/api/cron/daily-briefing` | `0 11 * * 0,2,3,4,5,6` (todo dia menos seg, 11h UTC / 8h BRT) | Briefing diario in-app + email curto |
| `/api/cron/outcome-survey` | `0 14 * * 1` (Seg 14h UTC / 11h BRT) | Pesquisa de outcome (entrevista? oferta?) |
| `/api/cron/redact-cv` | `0 6 * * *` (Diario 6h UTC / 3h BRT) | LGPD: redacta `Profile.rawCv` expirado (>90d) |
| `/api/cron/redact-billing` | `0 4 1 * *` (Mes dia 1 4h UTC) | LGPD: redacta payload Stripe antigo em `BillingEvent` |
| `/api/cron/usage-cleanup` | `0 3 1 * *` (Mes dia 1 3h UTC) | Apaga `UsageMeter` > 3 meses |

### Variaveis de ambiente

**Importante (Vercel):** ao adicionar/alterar env vars, marque **ambos
"Production" E "Preview"** — preview deploys (PRs) precisam das mesmas chaves
pra build/test funcionar. Marcar so Production faz preview falhar em runtime
sem mensagem clara.

#### Obrigatorias (app nao roda sem)

```env
DATABASE_URL=postgres://...                       # Neon / Supabase / Vercel Postgres (pgvector required)
AUTH_SECRET=                                      # openssl rand -base64 32
ANTHROPIC_API_KEY=                                # Sonnet 4.6 + Haiku 4.5
CRON_SECRET=                                      # x-cron-secret header (constant-time compare)
AUDIT_IP_SALT=                                    # sha256(ip + salt) pro AuditLog (LGPD)
LLM_MODEL=claude-sonnet-4-6                       # standard (analyze, chat, tailor, refresh, interview eval)
LLM_MODEL_FAST=claude-haiku-4-5-20251001          # fast (linkedin/parse, portfolio/import, cv/analyze-bullets, interview question)
```

#### Recomendadas (produto degrada sem)

```env
# Cache + rate-limit cross-lambda (4 sistemas usam: rate-limit, LLM cache,
# jobs cache Adzuna/Jooble, magic-link anti-spam). Sem isso, cada lambda
# Vercel mantem seu proprio Map em-memoria — bypass trivial em multi-instancia.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Embeddings RAG. Voyage AI = recomendado Anthropic (voyage-3, 1024-dim).
# Sem isso, fallback OpenAI Matryoshka (text-embedding-3-small truncado).
# Sem nenhum, RAG cai pra keyword puro (degradacao graceful).
VOYAGE_API_KEY=

# Magic link (login). Sem AUTH_RESEND_KEY, /entrar mostra estado "demo" amigavel.
AUTH_RESEND_KEY=
EMAIL_FROM="CareerTwin AI <nao-responder@dominio-verificado>"

# Vagas reais BR. Sem nenhum, /oportunidades cai em fixtures rotuladas.
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=

# ATS public boards (slugs CSV).
GREENHOUSE_BOARDS=nubank,ifood,stone
LEVER_BOARDS=hotmart,quero,onfly
ASHBY_BOARDS=loft,mercadobitcoin
WORKABLE_BOARDS=olist,onfly
```

#### Observabilidade (opcional, no-op sem chave)

```env
SENTRY_DSN=                                       # server-side errors
NEXT_PUBLIC_SENTRY_DSN=                           # client-side errors
SENTRY_ORG=                                       # source maps publicacao
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

NEXT_PUBLIC_POSTHOG_KEY=                          # eventos de produto
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

#### Billing Stripe (opcional, 503 amigavel sem chave)

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=

# Lista CSV de emails (case-insensitive + trim) que pegam pro_yearly
# direto, sem bater limites Free. Use pra equipe interna e dev sem Stripe.
OWNER_EMAILS=sergio@lognullsec.com
```

#### Auth opcional / dev-only

```env
AUTH_LINKEDIN_ID=                                 # OIDC LinkedIn (so liga se ID+SECRET setados)
AUTH_LINKEDIN_SECRET=
AUTH_DEV_CREDENTIALS=false                        # NUNCA "true" em prod (env.js bloqueia)
EMAIL_SERVER=smtp://localhost:1025                # Mailpit em dev
```

Veja `.env.example` pra lista completa com comentarios.

## Modelos LLM (overrides)

Default `LLM_MODEL=claude-sonnet-4-6` (alta qualidade, ~3-15s por call).
`LLM_MODEL_FAST=claude-haiku-4-5-20251001` (3-5x mais rapido, 1/4 do custo)
usado nas rotas leves (`/api/linkedin/parse`, `/api/portfolio/import`,
`/api/cv/analyze-bullets`, `/api/interview` action=question). Helper
`completeJSONFast*` em `lib/llm.js` envolve isso.

Pra trocar provider:
- `LLM_PROVIDER=openai` + `OPENAI_API_KEY` + `LLM_MODEL=gpt-4o` (ou
  `gpt-4o-mini` em `LLM_MODEL_FAST`).

## LLM cache (`lib/llm-cache.js`)

Cache key = `sha256(model|system|user)`, TTL 1h. **Upstash Redis primary**
(cross-lambda), fallback Map em-memoria. Habilitado por default em rotas de
parsing/perguntas; **desabilitado** (`meta.cache: false`) em rotas
user-specific onde mesmo input deve gerar resposta fresca (`analyze`, `chat`,
`tailor`, `profile/refresh`).

## Health check

`GET /api/health` retorna `{status, db, time}` pra UptimeRobot. Configure
ping a cada 5 minutos com alerta se 3 fails consecutivos.
