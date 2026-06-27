# Galadriel v4 — Blue Team / ASVS 5.0 gap analysis (2026-06-26)

Branch: `redesign/claude-design`. Stack: Next.js 14.2.35 + Auth.js v5 (beta.31) + Prisma 6.19 + PostgreSQL + Anthropic Claude + Stripe + Upstash Redis + Sentry 10.59.

Re-audit pós Wave 9 (redesign editorial). Foco em **gaps residuais** e **observabilidade**, não em mapear novamente o universo de controles existentes (já está em `docs/security/blue-team-controls-2026-06-25.md`).

---

## TL;DR

- **P0 gaps: 0.** Os dois P0 da audit 2026-06-25 (Galadriel Wave 4) já foram fixados:
  - `Profile.linkedinRaw` agora tem `linkedinRawExpiresAt` + `linkedinRawRedactedAt` próprios. (`app/api/linkedin/parse/route.js:148-179`, `app/api/cron/redact-cv/route.js:60-119`, `prisma/schema.prisma:120-123`).
  - `courses/click/route.js:35-41` já usa `safeExternalUrl` em vez de `z.string().url()`.
- **P1 gaps: 4.** Alertas Sentry sem rules, `CONSENT_GRANTED/REVOKED` ainda com 0 callers, `CV_UPLOAD` sem rate-limit, `/api/me/export` sem rate-limit (exfil DoS).
- **P2 gaps: 5.** Boot warning ausente quando Upstash desligado em prod, CAPTCHA ausente em rotas anônimas LLM, `BillingEvent.payload` TTL 12m (excede `rawCv` TTL 90d), CSP `unsafe-inline` permanece, sem MFA opcional.
- **P3 gaps: 3.** Session JWT sem `maxAge` explícito (default 30d), sem device fingerprint magic link, sem `sentry.profilesSampleRate` configurado.
- **Controles existentes confirmados:** 19 rotas com `guardLLM` (até 34 callsites com perMinuteAnon/User); 43 rotas com `await auth()`/`session?.user`; 55 queries com `where: { userId }` (IDOR mitigation); 112 chamadas a `audit(...)` no codebase; 9 security headers; CSP per-request via middleware; Dependabot configurado (`.github/dependabot.yml:1-58`); CI com `npm audit --audit-level=critical --omit=dev` (`.github/workflows/ci.yml:54-66`).

---

## Mudanças confirmadas vs. audit Wave 4 (2026-06-25)

| Item | Estado Wave 4 | Estado hoje | Evidência |
|---|---|---|---|
| `Profile.linkedinRaw` sem TTL | **P0 aberto** | ✅ Fechado | `app/api/linkedin/parse/route.js:166-179` seta `linkedinRawExpiresAt` no upsert; cron filtra em `app/api/cron/redact-cv/route.js:62-68` |
| `courses/click` usando `z.string().url()` | **P0 aberto** | ✅ Fechado | `app/api/courses/click/route.js:35-41` usa `safeExternalUrl` (importado de `lib/validators.js:9`) |
| `NotificationsBell` sem `safeHref` | **P1 aberto** | ✅ Fechado | `components/NotificationsBell.js:17,316-320` agora envolve `n.link` em `safeHref(...)` |
| `PROFILE_UPDATED` server actions de `/conta` | **P1 aberto** | ✅ Fechado | `app/(app)/conta/page.js:72,104,135` chamam `audit({ action: "PROFILE_UPDATED" })` em todas 3 server actions; `app/api/me/preferences/route.js:80`; `app/api/profile/refresh/route.js:567` |
| `CONSENT_GRANTED/REVOKED` callers | **P1 aberto** | ❌ Continua aberto | 0 callers em `app/api/**` — apenas string enum em `prisma/schema.prisma:532-533` e UI doc em `app/privacidade/page.js:175-176`. `prisma.consent.create` em `app/api/cv/upload/route.js:169`, `linkedin/parse:192`, `portfolio/import:294`, `analyze:458` mas SEM `audit()` correspondente |
| Sentry alert rules | **P1 aberto** | ❌ Continua aberto | `sentry.server.config.js:22-42` só faz capture, nada em `Sentry.io` configurado pela CLI/IaC |
| `BillingEvent.payload` 12m | **P2 aberto** | ❌ Continua aberto | `app/api/cron/redact-billing/route.js:38-50` ainda `setFullYear(...-1)` |
| `npm audit` em CI | **P2 aberto** | ⚠️ Parcial | Existe (`.github/workflows/ci.yml:65-66`) mas com `--audit-level=critical` (rebaixado de `high` em `docs/security/audit-exceptions-2026-06-26.md`) por causa de Next 14 + nodemailer débitos. |

---

## Gaps de controle por categoria ASVS 5.0

### V1 — Encoding, Sanitization & Validation

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V1.1.5 | URL validation com scheme allowlist | ✅ | `lib/validators.js:7-23` (`safeExternalUrl`), `lib/url-safe.js:1-21` (`safeHref`). 0 ocorrências de `z.string().url()` permissivo em `app/api/**`. | OK |
| V1.2.2 | Output encoding via React JSX | ✅ | React escapa por default; 7 ocorrências de `dangerouslySetInnerHTML` auditadas (`app/layout.js:28` script de tema, restante CSS literal hardcoded — `app/(app)/conta/page.js:239`, `app/(app)/cvs-adaptados/CvDetailClient.js:81`, `app/(app)/cvs-adaptados/CvDiffView.js:54`, `app/(app)/conta/CvAnalyzer.js:94`, `app/(app)/cvs-adaptados/page.js:42`, `app/(app)/cvs-adaptados/[id]/page.js:67`). Nenhuma com dado de usuário/LLM. | OK |
| V1.5.4 | Input length caps | ✅ | `lib/validators.js`: CV ≤40k, message ≤2k, history ≤30×4k, evidence ≤5k, etc. | OK |
| V1.7.1 | File upload magic bytes | ✅ | `lib/pdf.js:9-34` valida `%PDF-`, `lib/docx.js` valida `PK\x03\x04`; rejeita `.doc` legacy OLE2 com mensagem amigável. | OK |

### V2 — Authentication

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V2.1.1 | Magic-link primary factor | ✅ | `lib/auth.js:101-181` (Resend prod / Nodemailer dev). | OK |
| V2.1.6 | Rate-limit em sendVerificationRequest | ✅ | `lib/auth.js:43-91` (3/email/hora, Upstash + fallback Map). Erro genérico `rate_limited` — sem account enumeration. | OK |
| V2.2.1 | MFA disponível (opt-in) | ❌ não existe | Apenas single-factor magic-link. Sem TOTP/WebAuthn. Aceito porque magic-link em email já confere posse, mas para contas com Stripe Subscription (paying) seria upgrade desejável. | P2 |
| V2.3.1 | Session expiration explícita | ⚠️ default | `auth.config.js:29` — `session: { strategy: "jwt" }` sem `maxAge`. Auth.js v5 default = 30 dias. Sem `updateAge` — token renovado a cada request silenciosamente. | P3 |
| V2.5.1 | Dev credentials gate em prod | ✅ | `lib/auth.js:198-202` — `throw` em boot se `AUTH_DEV_CREDENTIALS=true` + `isRealProduction()` (`lib/env.js:11-16` usa `VERCEL_ENV === "production"`). | OK |
| V2.7.3 | Audit de eventos auth | ✅ | `lib/auth.js:233-263` — `LOGIN`/`LOGOUT`/`ACCOUNT_CREATED` em `events.{signIn,signOut,createUser}`. | OK |
| V2.8.1 | Device tracking / new-device alert | ❌ não existe | Magic-link reusable até expiração (24h). Sem device fingerprint nem alerta de "novo dispositivo". | P3 |

### V3 — Session Management

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V3.2.1 | HttpOnly + Secure + SameSite cookies | ✅ | JWT cookie via Auth.js v5 default = HttpOnly + SameSite=Lax + Secure em prod. Admin cookie em `lib/admin-session.js:97-104` adiciona SameSite=strict. | OK |
| V3.4.1 | CSRF token em mutações | ✅ (implícito) | Auth.js v5 usa double-submit cookie pattern em `/api/auth/*` (built-in). Server actions Next 14 usam mecanismo de ação assinada + same-origin check. Sem CSRF token explícito em API routes (escolha arquitetural — todas mutating routes têm `auth()` que valida JWT cookie, e CSP `form-action 'self'` previne form submit cross-origin). | OK |
| V3.4.3 | Logout invalida sessão | ⚠️ JWT-only | JWT é stateless — `signOut` apaga cookie mas token continua válido se atacante já tem. Sem token revocation list. Aceito porque JWT TTL 30d default, mas reduzir TTL ajudaria. | P3 |

### V4 — Access Control

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V4.1.1 | Default deny em rotas privadas | ✅ | `lib/auth-protected-paths.js:14-66` SSoT consumido por `middleware.js:90` e `auth.config.js:17`. | OK |
| V4.1.3 | Defense-in-depth (auth no middleware + na rota) | ✅ | 43 rotas API com `await auth()` checking `session?.user?.id`. | OK |
| V4.2.1 | IDOR mitigation (escopo por userId) | ✅ | 55 queries com `where: { userId }` em rotas API. Schemas Zod `.strict()` rejeitam `userId` injetado no body. | OK |
| V4.3.1 | Admin gate separado | ✅ | `lib/admin-access.js:22-44` (ADMIN_EMAILS allowlist) + `lib/admin-session.js` (HMAC cookie + senha ADMIN_PASSWORD). | OK |
| V4.3.3 | Constant-time compare em secrets | ✅ | `timingSafeEqual` em `lib/admin-session.js:42-54` e em `lib/cron-auth.js`. | OK |

### V5 — Validation / Encoding / Injection

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V5.1.3 | Zod `.strict()` em payloads | ✅ | `lib/validators.js:40-396` — `.strict()` em todos os `Body` schemas. | OK |
| V5.1.5 | URL redirect validation | ✅ | `safeExternalUrl` em todas as rotas que aceitam URL externa do user. | OK |
| V5.3.6 | SQL injection prevention | ✅ | Prisma ORM em 100% das queries; pgvector usa `::vector` cast tipado em `lib/knowledge/retrieval.js`. | OK |
| V5.4.1 | Output validation LLM | ✅ | `DiagShape`, `OppShape`, `PorquesShape`, `PlanoShape`, `LinkedinShape`, `PortfolioShape` em `lib/validators.js:52-274`. | OK |

### V7 — Error Handling & Logging

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V7.1.1 | Audit eventos sensíveis | ✅ | `prisma/schema.prisma:525-548` — 24 actions enum. 112 chamadas a `audit(...)` no codebase. | OK |
| V7.1.3 | PII redaction em logs | ✅ | `lib/logger.js:13-30` — PII_KEYS cobre 14 chaves; sanitize recursivo até 6 níveis com truncate ≥2000 chars. | OK |
| V7.1.4 | `CONSENT_GRANTED/REVOKED` instrumentado | ❌ ausente | Enum existe (`prisma/schema.prisma:532-533`), mas **0 callers** em `app/api/**`. `prisma.consent.create` em 4 rotas (`cv/upload:169`, `linkedin/parse:192`, `portfolio/import:294`, `analyze:458`) mas sem `audit({ action: "CONSENT_GRANTED" })` correspondente. LGPD perde rastro de quando consentimento foi dado/revogado. | P1 |
| V7.2.1 | Logs estruturados parseáveis | ✅ | `lib/logger.js:57-85` — JSON-line; `lib/llm.js:189-206` log `llm.usage` estruturado. | OK |
| V7.4.1 | Alert rules proativos | ❌ ausente | `sentry.server.config.js:22-42` apenas faz `Sentry.init` com `beforeSend` strip de PII. **Nenhuma rule configurada** no Sentry.io para `SECURITY_INVALID_WEBHOOK` (qualquer ocorrência), `SECURITY_BUDGET_EXCEEDED` (>3 mesmo userId em 1h), `SECURITY_RATE_LIMIT_HIT` (>100/min global), `ACCOUNT_DELETED`, error-rate > 1%. Captura sem alerta = MTTR inaceitável. | P1 |
| V7.4.2 | Anomaly detection | ❌ ausente | Sem alert em 80% do `DAILY_COST_CAP_USD` (só hard-cap em 100%). | P2 |
| V7.4.3 | `console.log` com PII em prod | ⚠️ behind flag | 6 ocorrências em `app/api/profile/refresh/route.js:255-256,386,422,458` — todos behind `process.env.DEBUG_REFRESH === "1"`. OK se variável nunca for setada em prod. Documentar que NÃO setar em produção. | P3 |

### V8 — Data Protection

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V8.3.1 | TTL em PII estratificado | ⚠️ inconsistente | `rawCv` 90d (`app/api/cv/upload/route.js:11`); `linkedinRaw` 90d (`app/api/linkedin/parse/route.js:148-160`); `BillingEvent.payload` 12 meses (`app/api/cron/redact-billing/route.js:38-39`). Janela 12m do payload Stripe excessiva para meta de minimização. | P2 |
| V8.3.4 | IP hash não-raw | ✅ | `lib/audit.js:22-31` — sha256 + `AUDIT_IP_SALT`, truncado 32 chars. Boot avisa se salt default (`ct-default-salt-change-me`). | OK |
| V8.3.7 | Export portabilidade (LGPD art.18) | ✅ | `lib/data-export.js:12-131` cobre user/profile/snapshots/consents/dataSources/tailoredCvs/assessments/evidence/subscription/usageMeters/billingEvents (sanitizado)/outcomes/auditLogs. | OK |
| V8.3.8 | Erase com cascade total | ✅ | `lib/data-export.js:133-149` + `prisma/schema.prisma` Cascade em 8 relações. Audit `ACCOUNT_DELETED` ANTES do delete. | OK |

### V11 — Communication / TLS / Headers

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V11.1.1 | HSTS | ✅ | `next.config.mjs:9-13` — `max-age=63072000; includeSubDomains; preload` (2 anos). | OK |
| V11.1.2 | CSP per-request | ⚠️ tradeoff | `middleware.js:24-49` — `script-src 'self' 'unsafe-inline'` (dev adiciona `'unsafe-eval'`). Sem nonce/strict-dynamic. Documentado em comentário como trade-off Next 14. Risco residual aceito (React escapa, sem `dangerouslySetInnerHTML` com user data, `frame-ancestors 'none'`). | P2 |
| V11.1.3 | Permissions-Policy | ✅ | `next.config.mjs:8` — `camera=(), microphone=(), geolocation=()`. | OK |
| V11.1.4 | X-Frame-Options + X-Content-Type-Options + Referrer-Policy | ✅ | `next.config.mjs:5-7`. | OK |
| V11.4.1 | Cross-origin form-action restrito | ✅ | `middleware.js:46` — CSP `form-action 'self'`. | OK |

### V13 — API & Web Service

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V13.2.4 | Rate-limit per route | ⚠️ parcial | 19 rotas com `guardLLM` em `app/api/**`. **Rotas sensíveis SEM rate-limit:** `app/api/cv/upload/route.js:30` (upload de 5MB sem rate-limit por user), `app/api/me/export/route.js:10` (export completo do user — DoS abuse), `app/api/billing/checkout/route.js:30`, `app/api/billing/portal/route.js`, `app/api/applications/route.js`, `app/api/evidence/route.js`, `app/api/tailored-cvs/route.js`, `app/api/notifications/route.js`. Rotas autenticadas (auth obrigatória), mas atacante interno autenticado pode abusar. | P1 |
| V13.2.5 | Webhook rate-limit | ⚠️ | `app/api/billing/webhook/route.js` — Stripe HMAC valida origem, mas sem rate-limit em si. Stripe garante delivery razoável. Aceito. | OK |
| V13.4.1 | Rate-limit distribuído (Redis) | ✅ | `lib/rate-limit.js:21-32` Upstash + fallback Map. Boot warning ausente quando prod sem Upstash. | P2 |
| V13.4.2 | Anti-automation (CAPTCHA) | ❌ ausente | Rotas anônimas LLM aceitam até 5 hits/min/IP. Sem CAPTCHA invisível (Turnstile/hCaptcha). Atacante pode botnet para drenar budget Anthropic. | P2 |

### V14 — Configuration / Supply Chain

| ID | Controle | Estado | Evidência | Prioridade |
|---|---|---|---|---|
| V14.2.1 | Dependency audit em CI | ⚠️ rebaixado | `.github/workflows/ci.yml:65-66` — `npm audit --audit-level=critical --omit=dev`. Rebaixado de `high` para `critical` em `docs/security/audit-exceptions-2026-06-26.md` por causa de Next 14 (14 CVEs HIGH) e nodemailer 7 (6 CVEs HIGH). Exceção documentada com plano de revert. | P2 (já tracked) |
| V14.2.2 | Dependabot configurado | ✅ | `.github/dependabot.yml:1-58` — semanal npm + mensal github-actions, com ignore de majors documentados. | OK |
| V14.4.1 | Secret management | ✅ | Sem secrets hardcoded. `process.env.*` consumido em 33 chaves catalogadas (cf. `.env.example` extenso e comentado). Apenas string literais para schemes/hostnames seguros. | OK |
| V14.5.1 | Boot validation de envs críticos | ⚠️ parcial | `lib/auth.js:198-202` valida `AUTH_DEV_CREDENTIALS`; `lib/audit.js:22-31` fallback do `AUDIT_IP_SALT` para default (loga mas não throw). Sem boot warning quando `isRealProduction() && !process.env.UPSTASH_REDIS_REST_URL` (rate-limit cai para in-memory por lambda = bypass trivial). | P2 |

---

## Observabilidade

### Logging com PII — limpo

- `lib/logger.js:13-30` redacta 14 chaves PII recursivamente (`email`, `phone`, `cpf`, `rg`, `cv`, `rawcv`, `rawcvtext`, `password`, `senha`, `token`, `secret`, `apikey`, `authorization`, `cookie`, `linkedinurl`).
- `lib/logger.js:33,51-53` truncate ≥2000 chars + cap depth 6 (anti log-DoS).
- 6 `console.log` em `app/api/profile/refresh/route.js:255-256,386,422,458` são gated por `process.env.DEBUG_REFRESH === "1"` — OK se nunca setar em prod. **Recomendar documentar em `.env.example`** que NÃO deve ser setado em prod. Hoje não há essa nota.
- 11 outros `console.log` no `app/api/**`: todos com strings literais (sem PII), tipo `console.log("webhook: evento ja processado:", event.id)` (`app/api/billing/webhook/route.js:92,153,260,275,280`). Stripe event ID não é PII.
- Sentry: `sentry.server.config.js:9-43` allowlist PII-sensitive routes deleta `event.request.data`. Lista cobre todas rotas LLM + `/api/me/export`. Cobertura OK.

### Alert rules ausentes — P1

Captura existe (Sentry SDK instrumentado), **mas nenhuma rule configurada no Sentry.io** para disparar paging/email:

| Trigger | Severidade sugerida | Ação | Hoje |
|---|---|---|---|
| `audit.action = SECURITY_INVALID_WEBHOOK` | Critical | PagerDuty/SMS | Apenas em DB. Atacante testando webhook secret = silêncio. |
| `audit.action = SECURITY_BUDGET_EXCEEDED` >3 vezes / 1h / userId | High | Email + revisar conta | Apenas em DB. |
| `audit.action = SECURITY_RATE_LIMIT_HIT` >100/min global | High | Vercel firewall attack-mode | Apenas em DB. |
| `audit.action = ACCOUNT_DELETED` | Info | Slack #ops | Apenas em DB. |
| Sentry error rate >1% em qualquer rota | High | Investigar | Sem rule. |
| LLM latency p99 >30s sustained | Medium | Provider issue | Log warn em `lib/llm.js` mas sem alerta. |

### Métricas que faltam

- **Anomaly detection em USD/dia.** `DAILY_COST_CAP_USD` ($0.10 free / $5 pro / $20 team) é hard-cap em 100%. Sem notification em 80% — usuário descobre que está bloqueado só ao receber 402.
- **Sentry `profilesSampleRate`**: não configurado em `sentry.server.config.js`. Profiling permite latency breakdown — útil para o radar de vagas P95 conhecido (20-40s percebidos, cf. `backlog_radar_perf.md`).
- **Dashboard `/admin/usage` com SECURITY_* aggregations.** Hoje `app/admin/usage/route.js` mostra apenas tokens consumidos. Adicionar widget "últimas 24h: N rate-limit hits, M budget exceeded, K invalid webhooks, top 10 IP hashes" facilita triagem.
- **Logout em vazamento detectado.** Auth.js v5 JWT sem revogação — token roubado vive até expirar (30d default). Reduzir `maxAge` para 7d + adicionar refresh seria upgrade.
- **Correlação IP hasheado.** `actorIp` é hash determinístico para o mesmo IP+salt, então hash repetido permite correlação cross-event sem reverter para IP. Comportamento atual está OK — confirmado em `lib/audit.js:25`.

---

## Recomendações prioritárias (top 5)

### 1. P1 — Instrumentar `CONSENT_GRANTED` (e `CONSENT_REVOKED`)

Plug `audit({ userId, action: "CONSENT_GRANTED", target: \`Consent:${source}\`, req, meta: { source: kind, payloadHash } })` nos 4 sites que já chamam `prisma.consent.create`:

- `app/api/cv/upload/route.js:169-171` (kind = `CV_PDF|CV_DOCX`)
- `app/api/linkedin/parse/route.js:192` (kind = `LINKEDIN`)
- `app/api/portfolio/import/route.js:294` (kind = `GITHUB|WEB`)
- `app/api/analyze/route.js:458` (kind = `CV_TEXT`)

Para `CONSENT_REVOKED`: criar endpoint `/api/me/consent/revoke?source=...` ou disparar a partir de `lib/data-export.js:139-149` quando user pede erase (revoga TODOS os consents ANTES do `deleteMany`).

**Impact:** LGPD art.8 §5º — revogação é direito; auditoria precisa rastrear ambos os lados.

### 2. P1 — Configurar 5 alert rules no Sentry

Via Sentry.io UI ou IaC (terraform-provider-sentry). Cobrir os 5 triggers da tabela acima. Mínimo: `SECURITY_INVALID_WEBHOOK` (qualquer evento → page) e error-rate > 1% por rota.

**Impact:** captura sem alerta = MTTR inaceitável. Atacante poderia testar webhook secret por horas sem detecção.

### 3. P1 — Rate-limit em `/api/cv/upload` e `/api/me/export`

`/api/cv/upload` aceita 5MB por POST, sem rate-limit. User autenticado pode upload em loop e drenar storage Prisma + tempo de parse PDF (`pdf-parse` CPU-bound). Sugestão: `guardLLM(req, { name: "cv-upload", userId, perMinuteUser: 5 })` em `app/api/cv/upload/route.js:31` (após `auth()`).

`/api/me/export` constrói export JSON completo sem rate-limit. User pode rodar 100x/seg e DoSar Prisma. Sugestão: `perMinuteUser: 2` em `app/api/me/export/route.js:10`.

**Impact:** evita abuso interno de user autenticado (insider) + reduz risco se token vazar.

### 4. P2 — Boot warning Upstash + CAPTCHA invisible

Adicionar em `lib/rate-limit.js:getRedis()`:

```js
if (!_redis && isRealProduction() && !process.env.UPSTASH_REDIS_REST_URL) {
  logger.error("rate-limit", "UPSTASH not configured in production - rate-limit fallback to in-memory per-lambda (bypass trivial)");
}
```

Plugar Cloudflare Turnstile (gratuito, invisible) no formulário anônimo de `/` (paste CV). Atacante perde meio fácil de drenar Anthropic API.

**Impact:** elimina classe inteira de DoS contra LLM provider cost.

### 5. P2 — Reduzir `BillingEvent.payload` TTL e adicionar 80% alert

- `app/api/cron/redact-billing/route.js:38-39`: trocar `setFullYear(...-1)` (12m) por `setDate(...-90)` (90d), alinhando com `rawCv`. Stripe expira disputas em 60d (cliente final) e 90d (cartão), suficiente para o use case.
- `lib/billing/enforce.js` — adicionar `checkDailyBudgetWarning(userId)` retornando `{ used, cap, percent }`; quando ≥ 80%, dispatch `audit({ action: "SECURITY_BUDGET_EXCEEDED", meta: { warning: true, percent } })` para alert rule pré-cap. UX: notification "você atingiu 80% do limite de hoje, considere upgrade".

**Impact:** minimização LGPD reforçada + UX melhorada (avisa antes de bloquear).

---

## Apêndice — Inventário rápido

| Métrica | Valor |
|---|---|
| Rotas API totais (`route.js`) | 55 |
| Rotas com `await auth()` / `session?.user` | 43 (78%) |
| Queries com `where: { userId }` (IDOR scope) | 55 |
| Chamadas a `audit(...)` | 112 |
| Rotas com `guardLLM` rate-limit | 19 |
| Pares `perMinuteAnon` / `perMinuteUser` configurados | 34 |
| Audit actions enum | 24 (`prisma/schema.prisma:525-548`) |
| PII keys redacted no logger | 14 (`lib/logger.js:13-30`) |
| Security headers configurados | 9 (5 em `next.config.mjs`, CSP per-req em `middleware.js`) |
| Crons configurados | 6 (`vercel.json:2-27`) |
| Env vars consumidos em `lib/` | 33 distintos |
| Sentry init points | 3 (server, edge, client — todos com `beforeSend` strip de PII) |
| Dependabot ecosystems | 2 (npm semanal, github-actions mensal) |

---

**Galadriel observa:** "A muralha está mais alta do que na lua passada — os P0 caíram, o `linkedinRaw` agora tem TTL próprio, server actions de `/conta` audit `PROFILE_UPDATED`. Mas três frestas continuam: o sino do alerta nunca toca (Sentry só captura), o consentimento é registrado mas nunca audit-trailed, e há rotas autenticadas que aceitam mil hits por minuto. Quando Sauron testar pela próxima vez, é por essas frestas que ele virá."
