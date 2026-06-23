# Analytics — funis de produto

## Stack
PostHog (US Cloud, free tier 1M events/mes). Eventos definidos em
`lib/analytics/events.js`. Track via `components/PostHogProvider.js` (client)
ou `/api/_track` (server-side, allowlist em `SERVER_SIDE_EVENTS`).

Init em `components/PostHogProvider.js`:
- `autocapture: false` — so eventos explicitos via `track()`.
- `disable_session_recording: true` — sem gravacao de tela (LGPD-friendly).
- `respect_dnt: true` — respeita Do Not Track do browser.
- `sanitize_properties` — remove `$current_url_search` (anti-vazamento de
  query strings com tokens).

## Taxonomy

Todos os event names vivem em `lib/analytics/events.js` como constantes
exportadas. Importe daqui em vez de string literal pra evitar typos:

```js
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";
track(EVENTS.DIAGNOSIS_COMPLETED, { overall_score: 72 });
```

Categorias:
- **Aquisicao**: `home_viewed`, `signup_*`, `login_completed`
- **Onboarding**: `cv_*`, `linkedin_import_*`, `github_import_*`, `role_defined`
- **Ativacao**: `diagnosis_started`, `diagnosis_completed`, `diagnosis_failed`
- **Engagement**: `dashboard_viewed`, `gap_*`, `course_clicked`, `evidence_added`, `assessment_*`
- **Career actions**: `tailor_*`, `interview_*`, `application_*`, `refresh_diagnosis_*`
- **Retencao**: `return_after_*`, `digest_clicked`
- **Monetizacao**: `paywall_*`, `upgrade_clicked`, `checkout_*`, `subscription_canceled`
- **LGPD**: `data_exported`, `account_deleted`

## Funis principais

### 1. Activation
home_viewed -> cv_paste_started -> diagnosis_started -> diagnosis_completed -> dashboard_viewed

**KPI:** % users que chegam ate `dashboard_viewed` apos `home_viewed`.
**Target:** >40%.

### 2. First action
dashboard_viewed -> gap_viewed -> gap_completed

**KPI:** % users que completam 1a microacao em 24h apos primeiro diagnostico.
**Target:** >25%.

### 3. CV adaptation
gap_completed -> tailor_started -> tailor_completed -> application_saved

**KPI:** % users que completam ciclo gap -> CV adaptado.
**Target:** >15%.

### 4. Monetization (futuro)
paywall_shown -> upgrade_clicked -> checkout_started -> checkout_completed

**KPI:** % conversion apos hit no cap Free.
**Target:** >5%.

Definicoes em `FUNNELS` (mesmo arquivo `events.js`) — copie pra criar Insights
no PostHog dashboard.

## Server-side vs client-side

A maioria dos eventos roda no client via `track()`. Mas eventos sensiveis a
fraude vao via `/api/_track` (proxy server-side):

- Allowlist em `SERVER_SIDE_EVENTS` (subset de `EVENTS`).
- Server adiciona `userId` verificado por session (nao confia em payload).
- Properties passam por whitelist de keys e cap de valor (anti-abuse).
- Rate-limited (30/min/user).

Use `/api/_track` quando o evento for "milestone monetario" (checkout) ou
LGPD (export/delete). Pra metricas de engagement comuns, `track()` direto e
ok (PostHog ja deduplica events identicos por distinct_id).

## Identify + super properties

`identifyUser(user)` em `PostHogProvider.js`:
- `posthog.identify(userId, { email, name })` — userId e o cuid do Prisma.
- `posthog.register({ plan, is_owner, signed_up_at })` — super properties
  anexadas em todos os events subsequentes da session.

Auto-disparado quando session tem userId na primeira request do PostHogProvider.

## Privacy

- **userId** e o cuid (nao email). Email passa SO via `identify()` (PostHog
  SaaS armazena, coberto pelo DPA do PostHog conforme LGPD).
- **PII em properties**: NUNCA. Use contagens, flags, IDs opacos. Codigo
  revisar em `lib/analytics/events.js` reforca o padrao.
- **IP**: PostHog SaaS captura mas anonimiza server-side (config conta).
- **Session recording**: desativado (`disable_session_recording: true`).
- **DNT**: respeitado (`respect_dnt: true`).
- **Query strings**: `$current_url_search` removido antes do envio.
- **Cookies banner**: TODO — adicionar opt-in explicito quando ativarmos
  campanhas de marketing.

## Adicionando novo event

1. Adicione constante em `lib/analytics/events.js` (snake_case, verbo no
   passado).
2. Se for sensivel/monetario, adicione em `SERVER_SIDE_EVENTS` (set).
3. Chame `track(EVENTS.NEW_EVENT, { ... })` no client.
4. Documente properties esperadas (no comentario do call).
5. Atualize FUNNELS se for parte de um funil.
6. Atualize teste em `tests/unit/analytics-events.test.js`.
