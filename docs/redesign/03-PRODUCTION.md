# Producao / DevOps / Security — CareerTwin AI (versao Claude Design)

Documento operacional para colocar a versao Claude Design em producao sem
quebrar a versao atual que ja roda em `main`. Audiencia: SRE / DevSecOps que
vai assumir o pipeline e o ciclo de deploy.

> Fontes consultadas: `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`,
> `package.json`, `playwright.config.js`, `vitest.config.js`, `next.config.mjs`,
> `middleware.js`, `instrumentation.js`, `sentry.client.config.js`,
> `sentry.server.config.js`, `sentry.edge.config.js`,
> `components/PostHogProvider.js`, `.env.example`, `docker-compose.yml`,
> `vercel.json`, `ARCHITECTURE.md`, `.claude/skills/`.

---

## 1. Estrategia de branch e deploy

### 1.1 Branch isolation

- **`main`**: producao atual (verde-limao dark mode). Intocada ate aprovacao
  formal de promocao. Cron de digest semanal (`vercel.json`) e Vercel
  auto-deploy continuam ligados.
- **`redesign/claude-design`**: nova versao. Recebe todos os commits da
  migracao de UI/UX. Vercel cria preview deploy automatico a cada push.

Justificativa: rollback continua sendo `git revert` no merge commit. Sem
branch isolada, qualquer regressao da migracao bate em producao no minuto
seguinte.

### 1.2 Vercel preview deploy

- URL automatica por commit: `careertwin-ai-git-redesign-claude-design-{team}.vercel.app`.
- Env vars: precisam estar setadas no escopo **Preview** (Vercel Dashboard
  → Project → Settings → Environment Variables). Copiar do `Production`
  com excecoes abaixo.
- **Postgres**: recomendacao e provisionar uma **Neon branch** (feature
  nativa do Neon, gratis) por preview, isolando dados. Se nao usar Neon,
  apontar para um DB **separado de producao** (`careertwin_staging`); jamais
  reutilizar o DB de prod num preview que pode rodar migrations destrutivas.
- **LLM**: pode reusar a mesma `ANTHROPIC_API_KEY`. Estimar ~2x consumo
  durante migracao (~$0.02/diagnostico em Sonnet 4.6). Considerar setar
  `LLM_MODEL=claude-haiku-*` no preview para baratear smoke tests.
- **Cron**: em `vercel.json` o cron `/api/cron/digest` esta global. Em
  preview o handler ja exige `CRON_SECRET`; manter o secret diferente
  entre Production e Preview garante que preview nunca dispara digest
  semanal pra usuarios reais.
- **Emails**: setar `AUTH_RESEND_KEY` vazio no Preview e deixar
  `AUTH_DEV_CREDENTIALS=true`. Magic link em preview some no log.

### 1.3 Promocao (quando ficar pronto)

1. Abrir PR `redesign/claude-design` -> `main`.
2. CI verde obrigatorio (`ci.yml` rodando Vitest; `e2e.yml` com label `e2e`).
3. Smoke test manual no preview (checklist em 4.5).
4. Migrations: aplicar com `npx prisma migrate deploy` em pipeline de
   release. Zero-downtime so funciona se colunas novas forem **nullable**
   ou tiverem default.
5. Merge no `main` -> Vercel re-deploys automatico.
6. Source maps Sentry: o `next.config.mjs` ja faz `withSentryConfig`
   condicional em `SENTRY_ORG`+`SENTRY_PROJECT`. Garantir que
   `SENTRY_AUTH_TOKEN` esta em Production env vars antes do build.

### 1.4 Rollback

- **Codigo**: `git revert -m 1 <merge-sha>` + push em `main`. Vercel
  re-deploys versao anterior em ~3min.
- **Schema**: se migracao foi compativel (apenas `ADD COLUMN ... NULL`),
  rollback de codigo basta. Para mudancas destrutivas (rename/drop),
  precisa migration reversa preparada antes (fluxo expand/contract).
- **Sentry**: `Sentry.init` com novo `environment` mantem historico do
  release antigo em paralelo, util pra correlacao.

---

## 2. CI/CD adjustments

### 2.1 Workflows existentes (em `.github/workflows/`)

| Workflow | Trigger atual | Acao recomendada |
|---|---|---|
| `ci.yml` | push/PR em `main` | Adicionar `redesign/claude-design` aos triggers |
| `e2e.yml` | push em `main` + PR com label `e2e` | Adicionar `redesign/claude-design` aos triggers de push |

`ci.yml` ja faz `npm ci`, `prisma generate`, `npm test` — cobre Vitest
(8 arquivos, 112 testes). `e2e.yml` sobe Postgres 16 em service container,
roda `prisma migrate deploy`, instala Chromium e executa Playwright. Cache
de browser ja configurado.

### 2.2 Workflows novos (opcionais, ordem de prioridade)

1. **`lighthouse.yml`** (recomendado): Lighthouse CI em PR pra evitar
   regressao de LCP/TBT. Custo: ~3min por PR. Pode falhar se preview
   nao tiver SSR pronto — usar `wait-on` ou disparar manualmente no
   preview URL.
2. **`a11y.yml`** (recomendado): `axe-playwright` rodando em rotas chave
   no preview. Detecta contraste/aria sem necessidade de Percy.
3. **`visual-regression.yml`** (opcional, custo alto): Playwright
   `toHaveScreenshot()` em rotas-chave. Limitacao real: snapshots flaky
   em CI por fontes/anti-aliasing, requer baseline por SO. Setup
   honesto: 4-8h de tuning ate confiavel.
4. **`bundle-analyzer.yml`** (opcional): `next-bundle-analyzer` em PR
   pra catar regressao de tamanho.

### 2.3 Branch protection (GitHub Settings -> Branches)

- **`main`**: `require PR`, `require status checks` (`CI` + `E2E`),
  `require 1 approval`, `dismiss stale reviews`, `require linear history`.
- **`redesign/claude-design`**: sem restricao (WIP), mas habilitar
  `require status checks` apos M2 da migracao pra evitar quebrar a
  branch.

---

## 3. Environment variables

### 3.1 Existentes (manter — origem: `.env.example`)

LLM: `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
DB: `DATABASE_URL`.
Auth: `AUTH_SECRET`, `AUTH_URL`, `AUTH_RESEND_KEY`, `EMAIL_SERVER`,
`EMAIL_FROM`, `AUTH_LINKEDIN_ID`, `AUTH_LINKEDIN_SECRET`,
`AUTH_DEV_CREDENTIALS`.
Cron: `CRON_SECRET`.
Vagas: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`,
`GREENHOUSE_BOARDS`.
Observabilidade: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`,
`SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`,
`NEXT_PUBLIC_POSTHOG_HOST`.

### 3.2 Possiveis novas (a definir durante migracao)

- `NEXT_PUBLIC_MEDIAN_API_STUB=true` — flag para median/percentil
  mockado enquanto API real nao existe.
- `NEXT_PUBLIC_REDESIGN_FLAG=true` — feature flag pra ativar novos
  componentes mesmo em `main` (se desejar dark launch).
- `NEXT_PUBLIC_THEME_DEFAULT=light|dark` — default do toggle de tema.

### 3.3 Secrets management

- Vercel encrypted env vars para tudo que e secret (`*_KEY`, `*_SECRET`,
  `DATABASE_URL`).
- **Nunca** commitar. Verificar com `gitleaks` ou `git secrets` em
  pre-commit hook (recomendado adicionar).
- `AUTH_SECRET` deve ser diferente entre Preview e Production
  (gerado com `openssl rand -base64 32`).

---

## 4. Testing strategy

### 4.1 Unit tests (Vitest)

Cobertura atual: **112 testes em 8 arquivos** (medido com
`npx vitest run`). Arquivos em `tests/unit/`:
`data-export.test.js`, `email-digest.test.js`, `jobs.test.js`,
`pdf.test.js`, `score.test.js`, `skills.test.js`,
`validators.test.js`, `validators-pitch.test.js`.

Adicionar:

- **score-over-time**: serializacao de `ScoreSnapshot[]` para grafico,
  agregacao por semana/mes, gaps em datas sem snapshot.
- **% completude do perfil**: regra de calculo (CV + Linkedin + GitHub
  + portfolio + targetRole), threshold de "pronto".
- **filter logic em `/oportunidades`**: combinacao de filtros (cidade,
  faixa salarial, stack, fonte), sanitizacao via Zod, comportamento
  com filtro vazio.
- **median stub provider**: shape do retorno do stub batendo com o
  consumidor real, fallback quando flag desliga.
- **componentes novos**: snapshot minimo via Vitest se nao houver
  Storybook (custom render JSX -> string). Honestamente: snapshot
  test de componente sem Testing Library e marginal — priorize
  testes de pure functions.

### 4.2 E2E tests (Playwright)

Atual: 1 spec em `tests/e2e/auth-persist-erase.spec.js` (login dev ->
diagnostico via API -> persiste -> apaga via LGPD). Skipa se faltar
`DATABASE_URL`, `ANTHROPIC_API_KEY` ou `AUTH_DEV_CREDENTIALS`.

Adicionar (ordem de prioridade):

1. **Onboarding flow**: cole CV -> aguarda diagnostico -> dashboard
   renderiza scorecards. Reutilizar mock de LLM via env
   (`LLM_PROVIDER=stub`?) ou fixture salva.
2. **Filtros em radar/oportunidades**: aplica 2 filtros, valida que
   contagem desce, limpa, contagem volta.
3. **Navegacao sidebar**: clica cada rota da sidebar nova, valida
   que titulo carrega e nao da 500.
4. **Toggle de tema**: dark -> light -> reload -> verifica que
   persistiu (localStorage ou cookie).
5. **Mobile drawer**: viewport 375px, abre/fecha menu.

Trade-off: cada spec adiciona ~30s ao `e2e.yml` que ja roda 3-5min.
Total alvo: <15min para nao virar gargalo.

### 4.3 Visual regression

Recomendacao **fraca**. Playwright tem `toHaveScreenshot()` nativo,
mas em CI gera flake por fontes/sub-pixel rendering em Linux vs
mac. Custo realista de setup: 4-8h. Beneficio: detecta regressoes
visuais antes de merge.

Alternativa mais barata: snapshots de DOM (HTML serializado) em
3-4 rotas-chave (Dashboard, Analise de gaps, Oportunidades), com
Vitest + JSDOM. Captura mudancas estruturais sem se preocupar com
pixel.

### 4.4 Accessibility tests

- **`eslint-plugin-jsx-a11y`**: adicionar ao `.eslintrc`. Custo zero,
  feedback em editor.
- **`axe-playwright`**: rodar `injectAxe()` + `checkA11y()` em rotas
  chave nos specs de E2E. Setup: 1-2h. Pega contraste insuficiente,
  faltando `alt`, hierarquia de headings.

### 4.5 Manual smoke test checklist (pre-merge)

- [ ] Home (`/`) carrega em <2s no preview, sem console errors
- [ ] Login dev (preview) entra em `/meu-gemeo`
- [ ] Login magic link (Mailpit local) entra em `/meu-gemeo`
- [ ] Cole CV de exemplo na home -> diagnostico aparece
- [ ] Dashboard renderiza overall + sub-scores
- [ ] Grafico de score over time aparece (mesmo com 1 ponto)
- [ ] Plano de 6 semanas renderiza
- [ ] Toggle dark/light em Home, Dashboard, Oportunidades, Candidaturas, Meus dados
- [ ] Toggle de tema persiste apos reload
- [ ] Sidebar funciona em desktop (>=1024px)
- [ ] Drawer mobile funciona em <768px
- [ ] `/oportunidades` aplica filtro de cidade
- [ ] `/oportunidades` aplica filtro de stack
- [ ] `/candidaturas` arrasta card entre colunas (mantem `ApplicationEvent` no DB)
- [ ] `/meus-dados` exporta JSON valido
- [ ] `/meus-dados` apagar tudo retorna 200 e remove o user
- [ ] CSP nao bloqueia nenhum recurso no DevTools console
- [ ] Sentry recebe um erro de teste (forcar `throw` em rota dev)
- [ ] PostHog recebe pageviews (verificar dashboard)

---

## 5. Security review (OWASP impact)

### 5.1 Novas superficies de ataque

- **Filter query params em `/oportunidades`**: validar com Zod schema
  estrito (max-length, allow-list para enums tipo `source`, `seniority`).
  Recusar params desconhecidos. Espelhar pattern de `lib/validators.js`.
- **File upload (CV)**: ja existe via `/api/cv/upload`, sem mudanca
  prevista. Validar que magic-byte check (`%PDF`) continua, limite de
  tamanho (~5MB) preservado, parser isolado em try/catch.
- **LLM input/output**: ja tem padrao de validacao (Zod no body +
  `DiagShape` no retorno). Aplicar mesmo padrao em qualquer nova rota
  que chame LLM (median calc, recomendacoes personalizadas, etc).
- **Tema persistido**: se for cookie, marcar `HttpOnly` se contem
  user_id; se for so preferencia visual, `SameSite=Lax` e
  `Secure` em prod basta. Se for localStorage, sem risco direto.

### 5.2 CSP review

CSP atual (`middleware.js`) e **pragmatica**: `script-src 'self'
'unsafe-inline'` em prod, mais `unsafe-eval` + `ws:` em dev. Motivo
documentado no proprio middleware: Next 14 + Vercel nao propaga nonce
pros chunks estaticos. Decisao consciente, com mitigacoes (React
escape, sem `dangerouslySetInnerHTML`, Zod nas bordas,
`frame-ancestors 'none'`).

Para a nova versao:

- Se a migracao **nao** adicionar 3rd-party scripts: manter CSP atual.
- Se adicionar (ex.: `Chart.js` via CDN, Lottie, etc): **prefira bundle
  local** (npm install). Adicionar `cdn.x.com` em `script-src` enfraquece
  CSP global.
- Re-avaliar nonce quando upgrade pra Next 15 acontecer (TODO ja
  marcado no middleware).
- `connect-src 'self'` em prod **vai bloquear PostHog** se
  `NEXT_PUBLIC_POSTHOG_HOST` apontar pra `us.i.posthog.com`. Verificar
  se PostHog ja esta sendo bloqueado em prod hoje (provavel bug latente).
  Solucao: adicionar `https://us.i.posthog.com` em `connect-src` (+
  `https://*.ingest.sentry.io` se Sentry funcionar via fetch direto
  sem `tunnelRoute`).

### 5.3 Auth scoping

- Toda nova rota em `app/api/**` precisa `await auth()` no inicio do
  handler e retornar 401 se nao autenticado, exceto rotas explicitamente
  publicas (home, `/entrar`, `/api/cron/digest` com `CRON_SECRET`).
- Toda nova Server Component em area protegida precisa estar sob
  `/meu-gemeo`, `/candidaturas`, `/meus-dados` ou path equivalente
  coberto pelo `PROTECTED` em `middleware.js`. **Se criar novo
  segmento protegido (ex.: `/oportunidades` so para logados), adicionar
  o regex no array `PROTECTED`.**

### 5.4 Skills obrigatorias

Em qualquer PR que toque auth/Prisma/LLM/upload/PII, rodar:

1. **`seguranca-careertwin`** (`.claude/skills/seguranca-careertwin/`) —
   skill especifica do projeto, baseada em OWASP Top 10:2025 + LLM
   Top 10.
2. **`owasp-security`** (`.claude/skills/owasp-security/`) — skill
   generica OWASP.
3. **`/security-review`** (built-in) — review do diff antes de merge.

Documentar isso no `CONTRIBUTING.md` (criar se nao existir) e no
template de PR.

---

## 6. Performance

### 6.1 Budgets (definicao do projeto)

| Metrica | Target | Como medir |
|---|---|---|
| LCP | <2.5s no preview (mobile 3G simulado) | Lighthouse CI |
| TBT | <300ms | Lighthouse CI |
| Bundle por rota | <100KB (gzipped) | `next build` output |
| API p95 (sem LLM) | <800ms | Sentry Performance |
| LLM call p95 | <25s (timeout do pacote e maior) | Sentry transaction |

### 6.2 Monitoring

- **Sentry (errors)**: `instrumentation.js` configura client/server/edge.
  `beforeSend` em `sentry.server.config.js` ja filtra body em rotas
  sensiveis (`/api/analyze`, `/api/chat`, `/api/cv/upload`,
  `/api/interview`, `/api/tailor`, `/api/me/export`,
  `/api/linkedin/parse`). `sentry.client.config.js` apaga `request.data`
  e cookies. Adicionar quaisquer rotas LLM novas a essa lista.
  `tracesSampleRate` atual: 0.1 client, 0.05 server/edge.
- **PostHog (eventos)**: `components/PostHogProvider.js` ja chama
  `initPostHog()`, captura pageview/pageleave, autocapture **desligado**,
  session recording **desligado**, respeita DNT. Sanitizer ja apaga
  `$current_url_search` (PII em query string). Adicionar eventos
  customizados via `track(name, props)`.

### 6.3 Image strategy

Decisao do projeto: **SVG inline** apenas. Sem `next/image`. Reduz
complexidade de CSP (sem `img-src` de CDN externa), evita Layout
Shift de imagens lazy-loaded.

Se a migracao precisar de raster (foto de usuario, logo de empresa
em vaga): considerar `next/image` com `loader: "default"` + adicionar
`img-src 'self' data: blob: https://*.linkedin.com` etc na CSP.

---

## 7. Database operations

### 7.1 Migrations

- **Estrategia**: expand/contract. Nunca dropar coluna no mesmo deploy
  que para de usa-la. Sequencia segura:
  1. Deploy A: adiciona coluna nova nullable, codigo le old+new.
  2. Backfill em background (se necessario).
  3. Deploy B: codigo escreve so na nova.
  4. Deploy C (semanas depois): dropa coluna velha.
- Em producao: `npx prisma migrate deploy` (idempotente, nao gera
  arquivos). **Nunca** `migrate dev` em prod (resetaria).
- O `e2e.yml` ja faz `prisma migrate deploy` em CI — replicar em
  pipeline de release.

### 7.2 Backup

`ARCHITECTURE.md` documenta opcoes Neon/Supabase/Vercel Postgres.
Recomendacao operacional:

- **Neon**: PITR habilitado (free tier ja vem com 7 dias). Branch por
  preview de graca.
- Snapshot semanal exportado para storage frio (S3/R2) — alem do PITR
  do provider.

### 7.3 Restore drill

- Frequencia: **3x ao ano** (Q1/Q2/Q3).
- Procedimento: criar Neon branch a partir de snapshot de 24h atras,
  apontar ambiente staging pra ele, rodar smoke test, validar.
- Documentar timing (tempo entre snapshot solicitado e DB pronto).

---

## 8. Monitoring & alerting

### 8.1 Sentry alerts

- **Error rate > 1% por rota** em janela de 5min: page on-call.
- **Novo error type** (issue inedito): notification (Slack/email),
  sem paging.
- **Transaction p95 > 3s** (excluindo rotas LLM `/api/analyze`,
  `/api/chat`): warning.

### 8.2 PostHog dashboards

- **Funil de onboarding**: home view -> CV upload OR paste ->
  `diagnosis_completed` -> dashboard view. Mede drop em cada passo.
- **Retention 7-day**: cohort de quem fez diagnostico, retorna em 7
  dias.
- **Eventos chave** (criar/manter): `diagnosis_completed`,
  `application_saved`, `application_moved`, `digest_clicked`
  (ja existe em `PostHogProvider.js`), `theme_toggled`,
  `filter_applied`.

### 8.3 Uptime

- Vercel ja reporta uptime no dashboard. Sem SLA formal no free tier.
- Recomendacao: criar `GET /api/health` (simples: retorna `{ok: true}`
  + ping em `prisma.$queryRaw\`SELECT 1\``) e monitorar via UptimeRobot
  ou Better Stack (free tier, ping cada 5min). Alert se 3 fails
  consecutivos.

---

## 9. Compliance & LGPD

- **DPO contact**: adicionar email `dpo@careertwin.com.br` no rodape
  do site e em `/sobre` (se existir; criar se nao).
- **`/meus-dados`**: ja implementado (export JSON + apagar tudo).
  Mantar funcional na nova versao — coberto pelo E2E `auth-persist-erase`.
- **Privacy policy**: **ainda nao existe**. Recomendacao **forte**:
  criar `/privacidade` antes do go-live. Cobrir base legal (consentimento
  + execucao de contrato), retencao (snapshots imutaveis explicitos),
  direitos (acesso, retificacao, eliminacao), DPO, subprocessadores
  (Anthropic, Vercel, Neon, Resend, Sentry, PostHog).
- **Termos de uso**: `/termos` (similar). Atualizar caso a interface
  prometa novas funcionalidades.
- **Cookies banner**: PostHog respeita DNT (configurado em
  `PostHogProvider.js`). Auth.js usa cookie de sessao (essencial,
  isento de banner sob LGPD se for so funcional). Resultado: **banner
  nao e obrigatorio**, mas avisar em `/privacidade` que cookies
  funcionais estao em uso.

---

## 10. Cost projections

### 10.1 LLM costs

- Diagnostico por usuario: ~$0.02 (Sonnet 4.6, ~3-4k tokens
  input/output combinados).
- Volume previsto: depende de tracao. Estimativa conservadora —
  500 diagnosticos/mes = $10/mes.
- Mitigacao:
  - Rate limit por user (`lib/rate-limit.js` ja existe).
  - Cache em rotas idempotentes (`/api/opportunities` ja usa cache
    em `lib/jobs/`).
  - Considerar Haiku para sub-tarefas (resumo de vagas, classificacao),
    Sonnet so para diagnostico principal.

### 10.2 Infra costs (free tiers atuais)

- **Vercel**: free ate 100GB bandwidth/mes. Estimativa: confortavel
  ate ~10k usuarios ativos/mes.
- **Postgres (Neon)**: free ate 0.5GB. Cada usuario com 5 snapshots +
  gaps + plan items ~10KB -> ~50k usuarios fitam. Pago: $19/mes a partir
  de 10GB.
- **Sentry**: free ate 5k errors/mes. Acima: $26/mes (Team).
- **PostHog**: free ate 1M events/mes. Confortavel.
- **Resend**: free ate 3k emails/mes (100/dia). Digest semanal: 1
  email/user/semana -> ~750 users no limite.
- **Anthropic API**: pay-as-you-go, sem free tier signficativo.

Custo total estimado para 1k MAU: **~$30-50/mes** (Sentry sai do
free + LLM ~$20).

---

## 11. Migration checklist (linear, antes de merge final)

Ordem importa. Marque sequencialmente:

- [ ] Todos os testes verdes em CI (`ci.yml` + `e2e.yml` com label `e2e`)
- [ ] Cobertura unit nao caiu (target: manter >=112 testes, somar novos)
- [ ] Lighthouse score >=90 em Performance e >=95 em Accessibility nas
      rotas: `/`, `/meu-gemeo`, `/oportunidades`, `/candidaturas`,
      `/meus-dados`
- [ ] `axe-playwright` sem violations criticas em rotas-chave
- [ ] Smoke test manual completo (checklist 4.5)
- [ ] Schema migrations testadas em staging/Neon branch
- [ ] Plano de rollback de schema documentado se houver migration
- [ ] Env vars de Production validadas (lista 3.1)
- [ ] Vercel preview validado por owner + 1 reviewer
- [ ] Sentry source maps configuradas (`SENTRY_AUTH_TOKEN` em Production)
- [ ] PostHog events implementados (ver 8.2)
- [ ] CSP em prod nao bloqueia recursos (DevTools console limpo)
- [ ] `/privacidade` e `/termos` publicados (item 9)
- [ ] `/api/health` criada e UptimeRobot configurado (item 8.3)
- [ ] Skill `seguranca-careertwin` aplicada no PR final
- [ ] Skill `owasp-security` ou `/security-review` aplicada no PR final
- [ ] Branch protection ativa em `main`
- [ ] Comunicar janela de deploy (mesmo zero-downtime, prevenir
      casos extremos)

---

## 12. Estimativas DevOps adicionais

Tempo total estimado para setup de tudo que **nao e codigo da
migracao** (ou seja, infra/observabilidade/testes/seguranca):

| Item | Horas |
|---|---|
| Vercel: configurar Preview env vars + Neon branch | 2h |
| Atualizar `ci.yml` e `e2e.yml` triggers para nova branch | 0.5h |
| `lighthouse.yml` (workflow novo) | 3h |
| `a11y.yml` + `axe-playwright` integration | 4h |
| `eslint-plugin-jsx-a11y` install + fix violations existentes | 2-4h |
| Novos unit tests (score-over-time, completude, filtros, stub) | 6h |
| Novos E2E specs (onboarding, filtros, sidebar, tema) | 8h |
| Visual regression (se aceitar custo) | 6-8h |
| `/api/health` + UptimeRobot | 1h |
| `/privacidade` + `/termos` (texto + rota) | 4h (texto) + 1h (rota) |
| CSP review e ajuste para PostHog/Sentry (se necessario) | 2h |
| Restore drill documentation + 1a execucao | 3h |
| Branch protection + PR template | 0.5h |
| Documentacao de runbook (rollback, deploy, incident) | 4h |

**Total: ~47-55h de DevOps/QA/Security adicional.**

Esse numero **nao inclui** as horas de migracao de UI/UX em si, nem
o tempo de revisao manual de cada PR — apenas o setup operacional
para entregar com confianca.
