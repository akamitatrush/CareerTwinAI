# Outcome Tracking

## Por que existe

Daniel + Bianca (time Tera) cobraram dado real pra mediana de contratados. Hoje
`lib/metrics/median-stub.js` tem `HIRED_MEDIAN = 78` hardcoded — vaporware.
Sem outcomes, mediana e chute.

Solucao: construir infra agora; dataset cresce com trafego; em 3-6 meses temos
mediana real. **Dataset proprietario = defensibilidade** (nenhum concorrente
tera isso).

## Como funciona

1. **Diagnostico inicial.** User faz `/api/analyze` -> `ScoreSnapshot` persistido,
   `Profile.firstDiagnosisAt` setado (welcome-flow ja faz isso).
2. **Cron semanal.** Toda segunda 14:00 UTC, `/api/cron/outcome-survey` acha
   users que cruzaram milestone 30/60/90 dias desde `firstDiagnosisAt` E nao tem
   `Outcome` registrado pra esse `surveyKind`. Envia email com link pra dashboard.
3. **User responde.** Pelo modal (`components/OutcomeSurveyModal.js`) ou direto via
   POST `/api/me/outcome`. Captura `scoreAtTime` + `roleAtTime` do latest snapshot
   automaticamente (correlaciona score historico -> outcome).
4. **Threshold ativa real.** Quando `>=50` outcomes `HIRED` ou `HIRED_DIFFERENT`,
   `getRealMedian()` calcula mediana do `scoreAtTime` (antes era stub fixo).

## Schema

```prisma
model Outcome {
  id              String   @id @default(cuid())
  userId          String
  kind            OutcomeKind
  occurredAt      DateTime @default(now())
  scoreAtTime     Int?
  roleAtTime      String?
  monthsSearching Int?
  evidence        String?  @db.Text
  surveyKind      SurveyKind?
  createdAt       DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum OutcomeKind {
  HIRED              // contratado pra cargo-alvo
  HIRED_DIFFERENT    // contratado pra cargo diferente
  NOT_HIRED          // decidiu parar
  STILL_LOOKING      // ativo
  PAUSED             // pausou busca
  DECLINED_TO_ANSWER // dismissou survey
}

enum SurveyKind { THIRTY_DAYS SIXTY_DAYS NINETY_DAYS SELF_REPORTED }
```

## Threshold (50)

Por que 50:
- Estatisticamente, IC 95% pra mediana exige ~30 obs (rule of thumb).
- Subimos pra 50 pra margem contra outliers em dataset jovem.
- Configuravel via `MIN_OUTCOMES_FOR_REAL` em `lib/metrics/median-real.js`.

## Cache

`getRealMedian()` mantem cache em memoria de **1h** (`CACHE_TTL_MS`). Outcomes
mudam devagar (~50/mes em volume estavel) — staleness aceitavel. Em serverless
(Vercel) cada lambda tem cache proprio; desperdicio leve mas zero risco
cross-instance.

`/api/metrics/median` adiciona segunda camada: `cache-control:
public, s-maxage=3600` no response. CDN/edge serve sem hit no backend.

## Cota de email (Resend)

- Free tier: **100 emails/dia (3k/mes)**.
- Cron de survey limita **50 emails/execucao** (`MAX_SURVEYS_PER_RUN`).
- Cron roda **1x/semana** (segunda 14:00 UTC) — max 200 surveys/mes (~6.6% da cota).
- Prioriza users mais antigos primeiro (`orderBy: { createdAt: "asc" }`) — eles
  tem mais milestones pendentes.
- Em DEV sem Resend, cron retorna ok sem enviar (no-op).
- Janelas com tolerancia: aceita 30d->60d, 60d->90d, 90d->180d. Defesa contra
  cron pular execucao.

## Quando ativa a mediana real

- Threshold: **50 outcomes** com `kind in (HIRED, HIRED_DIFFERENT)` e
  `scoreAtTime` nao-null.
- Antes disso: exibe `HIRED_MEDIAN = 78` com label "Estimativa em construcao".
- Apos atingir: label vira "Mediana real (N={sampleSize})".

## Privacidade (LGPD)

- **AuditLog** registra `OUTCOME_REPORTED` com `kind` + `surveyKind` apenas no meta.
  Evidence textual (pode ter PII de empresa/cargo) **NAO vai pro audit**.
- **Cascade** `User -> Outcome` — apagar conta apaga outcomes do user.
- **LGPD export** (`/api/me/export`): outcomes do user incluidos no payload.
- **Mediana e agregada** — sem PII. Endpoint `/api/metrics/median` e public-cacheable.
- **Evidence opcional** com aviso visivel no UI: "nao inclua nomes, salarios ou
  dados pessoais". Validador limita a 2000 chars.
- **Survey email** so usa `firstName` (sem sobrenome/dados sensiveis no subject/body).

## Anti-IDOR

- `userId` SEMPRE de `session.user.id`, nunca do body.
- Validador `OutcomeCreateBody` e `.strict()` — rejeita campo extra (`userId`,
  custom).
- Query escopa por `where: { userId: session.user.id }` no GET.
- 2-step query no POST: `findFirst({ where: { userId } })` pro snapshot + `create`
  com `data.userId: session.user.id`.

## Rate limit

POST `/api/me/outcome`: 5/min logado (volume real eh ~1/user/3-meses; 5/min e
muito acima do legitimo, defende contra spam de bot).

## Arquivos

- `lib/metrics/median-real.js` — funcao `getRealMedian()` + cache + threshold.
- `lib/validators.js` — `OutcomeCreateBody` Zod schema.
- `app/api/me/outcome/route.js` — POST + GET.
- `app/api/metrics/median/route.js` — GET publico cacheado.
- `app/api/cron/outcome-survey/route.js` — cron semanal de email survey.
- `components/OutcomeSurveyModal.js` — UI modal opcional.
- `prisma/schema.prisma` — model `Outcome`, enums `OutcomeKind`/`SurveyKind`,
  enum `AuditAction` estendido.
- `prisma/migrations/20260628000000_outcome/migration.sql` — tabela + enums.
- `prisma/migrations/20260628100000_audit_outcome/migration.sql` — ADD VALUE no
  AuditAction enum.
- `tests/unit/outcome.test.js` — testes da rota.
- `tests/unit/median-real.test.js` — testes do calculo.

## Backward compat

`lib/metrics/median-real.js` re-exporta `HIRED_MEDIAN = 78` pra qualquer caller
legado. Mas novos componentes devem usar `getRealMedian()` pra obter dado real
quando disponivel.
