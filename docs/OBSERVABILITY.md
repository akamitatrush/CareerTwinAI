# Observabilidade — CareerTwin AI

Como configurar e validar Sentry (erros) + PostHog (analytics) + Uptime (UptimeRobot).

## 1. Sentry

### 1.1 Criar projeto
1. https://sentry.io/signup (gratis ate 5k errors/mes)
2. Create Project → Platform: Next.js
3. Copie 2 valores:
   - `DSN` (publico) → vai em `NEXT_PUBLIC_SENTRY_DSN` E `SENTRY_DSN`
   - `Org Slug` → vai em `SENTRY_ORG`
   - `Project Slug` → vai em `SENTRY_PROJECT`

### 1.2 Configurar Vercel
Project Settings → Environment Variables:
- `NEXT_PUBLIC_SENTRY_DSN` = `https://xxx@yyy.ingest.sentry.io/zzz`
- `SENTRY_DSN` = mesmo valor acima
- `SENTRY_ORG` = teu org slug
- `SENTRY_PROJECT` = teu project slug
- (opcional) `SENTRY_AUTH_TOKEN` pra source maps

Marca em "Production" + "Preview".

### 1.3 Validar
1. Faz deploy
2. Abre o app, force um erro (ex.: acessa /api/analyze com body invalido)
3. Volta no Sentry dashboard → Issues → deve aparecer o erro em ate 1min
4. Se nao aparecer:
   - DevTools Network: confirma que requests pra `*.ingest.sentry.io` estao acontecendo
   - Console: procura erros tipo "CSP refused to connect"
   - Verifica que `sentry.client.config.js` foi inicializado (procura por "Sentry" no script)

### 1.4 Beforesend filtros (ja aplicados em `sentry.server.config.js`)
- `/api/analyze`, `/api/chat`, `/api/cv/upload`, `/api/me/export`, `/api/tailor`, `/api/interview`, `/api/linkedin/parse` tem `request.data` filtrado (PII)
- Header `Authorization` removido
- Cookies removidos

## 2. PostHog

### 2.1 Criar projeto
1. https://posthog.com/signup (gratis ate 1M events/mes)
2. Create Project
3. Copie `Project API Key` (publica) → vai em `NEXT_PUBLIC_POSTHOG_KEY`
4. Verifica `Project API Host` — default e `https://us.i.posthog.com` (US region) ou `https://eu.i.posthog.com` (EU)

### 2.2 Configurar Vercel
Project Settings → Environment Variables:
- `NEXT_PUBLIC_POSTHOG_KEY` = `phc_xxx`
- `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com` (ou EU)

### 2.3 Validar
1. Deploy
2. Abre o app, navega entre paginas
3. Volta no PostHog → Activity → Events
4. Deve aparecer:
   - `$pageview` em cada navegacao
   - `diagnosis_completed` ao rodar diagnostico
   - `application_saved` ao salvar vaga
   - `digest_clicked` se entrar via link do email digest

### 2.4 Privacidade
- `autocapture: false` — nao captura clicks/inputs automaticamente
- `disable_session_recording: true` — nao grava sessao
- `respect_dnt: true` — respeita Do Not Track
- localStorage so com info nao-PII

## 3. CSP

`middleware.js` ja libera as origens necessarias em `connect-src`:
- `https://us.i.posthog.com`
- `https://*.posthog.com`
- `https://*.ingest.sentry.io`
- `https://*.ingest.us.sentry.io`

Se trocar regiao do PostHog/Sentry, atualizar middleware.

## 4. Uptime monitoring

### 4.1 UptimeRobot (gratis)
1. https://uptimerobot.com/signup
2. Add new monitor → HTTP(s)
3. URL: `https://teu-dominio.com/api/health`
4. Monitoring interval: 5 min (free tier)
5. Alert contacts: email tuo

### 4.2 Criterio
`/api/health` retorna:
- **200 OK** = sistema saudavel (DB OK)
- **503 Service Unavailable** = DB inacessivel (unico subsistema considerado critico)

Decisao: somente o banco e critico pro 503. LLM key/email/observability ausentes
nao deixam o app indisponivel — apenas degradam funcionalidades especificas, e o
proprio app ja tem fallback (vagas ilustrativas, init no-op de Sentry/PostHog).
Subir um 503 por LLM key faltando faria UptimeRobot acordar gente sem motivo.

UptimeRobot vai alertar quando bater 503 ou timeout.

### 4.3 Payload `/api/health`
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2026-06-23T12:00:00.000Z",
  "check_duration_ms": 42,
  "checks": {
    "database": { "ok": true, "latency_ms": 12 },
    "llm": { "ok": true, "provider": "anthropic" },
    "email": { "ok": true, "via": "resend" },
    "jobs_providers": { "ok": true, "count": 4 },
    "observability": { "sentry": true, "posthog": true },
    "build": { "node": "v22.x", "env": "production", "deploy": "abc1234" }
  }
}
```

Nota de seguranca: o payload nao expoe DSN, chaves, URLs internas, nomes de banco
nem stack trace. So booleanos, contagens e a versao curta de commit (ja visivel
em headers de deploy do Vercel).

## 5. Metricas a acompanhar

### 5.1 Sentry
- Error rate por rota (alerta > 1%)
- New errors (notificacao)
- Performance: API p95 < 800ms

### 5.2 PostHog
- Funil onboarding: home → CV upload → diagnosis → dashboard view
- Retention 7-day, 30-day
- Eventos chave por dia: diagnosis_completed, application_saved
- Conversao de modo experimentar → conta criada

## 6. Troubleshooting

| Sintoma | Provavel causa | Fix |
|---|---|---|
| Sem eventos no PostHog | CSP bloqueando | Confere `connect-src` no middleware |
| Sem erros no Sentry | DSN errado ou ambiente nao-prod | Confere `NEXT_PUBLIC_SENTRY_DSN` em "Production" env |
| `/api/health` retorna 503 | DB down | Verifica Neon status + DATABASE_URL |
| Source maps faltando no Sentry | `SENTRY_AUTH_TOKEN` nao setado | Cria token em Settings → Auth Tokens (scope: project:releases) |

## 7. Custos previstos (1k MAU)

- Sentry free: 5k errors/mes (suficiente)
- PostHog free: 1M events/mes (folgado pra 1k MAU)
- UptimeRobot free: 50 monitors (suficiente)

Total: **R$ 0/mes** ate ~10k MAU.
