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
Vercel Cron config (Settings -> Cron Jobs -> Headers).

| Path | Schedule | Funcao |
|------|----------|--------|
| `/api/cron/digest` | Seg 12:00 UTC (9h BRT) | Manda email semanal de vagas |
| `/api/cron/usage-cleanup` | Mes dia 1 03:00 UTC | Apaga UsageMeter > 3 meses |
| `/api/cron/redact-cv` | Diario 06:00 UTC | LGPD: redacta Profile.rawCv expirado (>90d) |

### Variaveis de ambiente

| Var | Onde |
|-----|------|
| `CRON_SECRET` | Vercel + Cron Headers |
| `AUDIT_IP_SALT` | Vercel (sha256 do IP pro AuditLog) |
| `DATABASE_URL` | Vercel |
| `AUTH_SECRET` | Vercel |
| `ANTHROPIC_API_KEY` | Vercel |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Vercel |

Veja `.env.example` pra lista completa.
