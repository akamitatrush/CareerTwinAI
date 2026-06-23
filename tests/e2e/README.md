# E2E Tests (Playwright)

Specs cobertos:

- `auth-persist-erase.spec.js` — fluxo Fase 1 (login dev -> diagnostico -> persiste -> re-login -> apagar tudo).
- `login-dashboard.spec.js` — login dev -> AppShell + nav items principais.
- `navigation-claude-design.spec.js` — navegacao entre as 5 telas Claude Design.
- `theme-toggle.spec.js` — toggle de tema persiste entre paginas e reload.
- `onboarding-modo-experimentar.spec.js` — home publica (`/`) + botao "Carregar exemplo" sem login.
- `lgpd-export-delete.spec.js` — `GET /api/me/export` retorna JSON valido com `user.email`.

## Como rodar local

1. Sobe a infra:
   ```sh
   docker compose up -d postgres mailpit
   ```
2. Aplica o schema:
   ```sh
   npx prisma migrate dev
   ```
3. `.env` (na raiz do projeto) com pelo menos:
   ```env
   DATABASE_URL=postgresql://...
   AUTH_SECRET=qualquer-coisa
   AUTH_DEV_CREDENTIALS=true
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Roda os specs:
   ```sh
   npm run test:e2e
   ```

O `playwright.config.js` ja sobe `next dev` automaticamente em
`http://localhost:3000` se o servidor nao estiver de pe.

## Skip automatico em CI

Cada spec que precisa de DB/LLM/auth comeca com:

```js
const HAS_DB = !!process.env.DATABASE_URL;
const HAS_LLM = !!process.env.ANTHROPIC_API_KEY;
const RUN_E2E = HAS_DB && HAS_LLM && process.env.AUTH_DEV_CREDENTIALS === "true";
test.skip(!RUN_E2E, "Requer ambiente E2E (DB + LLM + AUTH_DEV_CREDENTIALS)");
```

Sem essas envs (default no CI), o spec e _skipado_ em vez de falhar.

A excecao e `onboarding-modo-experimentar.spec.js`, que cobre a home publica
e nao precisa de DB/LLM — ele roda sempre que o webServer subir.

## Convencao

- Specs **nao rodam no CI por padrao** (sao opt-in via label "e2e" no PR).
- Local, rodam contra `docker compose up -d postgres mailpit` + `npm run dev`
  (ou auto-start via `webServer` do Playwright config).
- Cada test usa um email unico baseado em `Date.now()` pra evitar colisao
  entre rodadas e isolar dados criados.
