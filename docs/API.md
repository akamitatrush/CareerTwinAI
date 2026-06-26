# CareerTwin AI — Referência de API

Documentação técnica das rotas internas. **49 route handlers** em `/api/*`,
runtime Node, retorno JSON (exceto SSE em `/api/analyze?stream=1`).

> **Aviso**: API interna, **não pública**. Rotas LLM têm rate limit por IP/userId. Em produção, requer `Origin` mesmo domínio (Server Actions / CORS fechado).

## Sumário

- [Convenções](#convenções)
- [Erros padrão](#erros-padrão)
- [Diagnóstico](#diagnóstico)
- [Oportunidades](#oportunidades)
- [Imports](#imports)
- [Ferramentas IA](#ferramentas-ia)
- [Perfil & Score](#perfil--score)
- [Gaps & Plano](#gaps--plano)
- [Candidaturas](#candidaturas)
- [Evidências & CVs adaptados](#evidências--cvs-adaptados)
- [Autoconhecimento](#autoconhecimento)
- [Notifications & Daily Quest](#notifications--daily-quest)
- [Billing](#billing)
- [LGPD & Conta](#lgpd--conta)
- [Cron](#cron)
- [Autenticação](#autenticação)
- [Rate limits](#rate-limits-resumidos)

---

## Convenções

- **Auth**: rotas marcadas com 🔒 exigem sessão Auth.js. Sessão via cookie HTTP-only.
- **Persistência**: rotas marcadas com 💾 persistem se logado, retornam efêmero se anônimo (modo "experimentar").
- **Modo anônimo**: rotas LLM (analyze, opportunities, interview, tailor, chat,
  cv/, linkedin/, portfolio/) aceitam sem sessão — caem em rate-limit mais
  apertado e nao persistem. Whitelist forte em `middleware.js`
  (`NEVER_BLOCK_PREFIXES`) garante que essas rotas nunca sao bloqueadas pelo
  gate de auth, mesmo se alguem regredir `PROTECTED_PREFIXES`.
- **Validação**: todo `POST` valida o body com Zod `.strict()`. Body com campo extra → 400.
- **Rate limit**: rotas LLM têm limite por IP (anônimo) ou userId (logado). 429 com `Retry-After`.
- **Idempotência**: nenhuma rota é idempotente — cada POST consome quota LLM.
- **`withApiGuard`**: rotas LLM sao envolvidas em `lib/api-handler.js` que
  **garante JSON em qualquer erro inesperado** (Prisma drift, throw,
  module error). Antes podia voltar HTML `<!DOCTYPE>` e quebrar parse no
  cliente (`Unexpected token '<'`). 9 rotas usam: `analyze`, `opportunities`,
  `interview`, `tailor`, `chat`, `cv/analyze-bullets`, `linkedin/parse`,
  `portfolio/import`, `profile/refresh`.

## Erros padrão

Todos os erros voltam como:

```json
{ "error": "Mensagem em pt-BR pro usuário final", "code": "MACHINE_CODE" }
```

Códigos comuns:

| `code` | Status | Significado |
|---|---|---|
| `BAD_JSON` | 400 | Body não é JSON válido |
| `INVALID_INPUT` | 400 | Campo faltando ou inválido (genérico) |
| `CV_TOO_SHORT` / `CV_TOO_LONG` | 400 | CV < 60 ou > 40000 chars |
| `ROLE_REQUIRED` | 400 | Cargo-alvo ausente |
| `URL_BLOCKED` | 400 | URL bloqueada por SSRF (portfolio) |
| `NO_RAW_CV` | 400 | `Profile.rawCv` expirado/redactado (TTL 90d LGPD) — redirect pra `/` |
| `NO_TARGET_ROLE` | 400 | Sem `targetRole` — redirect pra `/conta` |
| `UNAUTHORIZED` | 401 | Sem sessão |
| `LIMIT_REACHED` | 402 | Quota mensal do plano (`enforceUsage`) esgotada — `upgradeUrl` no payload |
| `BUDGET_EXCEEDED` | 402 | Budget USD/dia do plano esgotado (cost amplification defense) |
| `NOT_FOUND` | 404 | Recurso não existe ou não é do usuário |
| `FETCH_EMPTY` | 422 | Fonte externa não devolveu nada útil |
| `RATE_LIMITED` | 429 | Quota da janela esgotada — header `Retry-After` |
| `PERSIST_FAILED` | 500 | Erro ao gravar no banco |
| `SERVER_ERROR` | 500 | Erro inesperado (`withApiGuard` fallback) |
| `LLM_FAILED` | 502 | LLM timeout / erro de rede |
| `LLM_INVALID` | 502 | LLM devolveu shape fora do esperado |
| `DB_UNAVAILABLE` | 503 | DB inacessivel (P1001/P1008/P1017) |
| `DB_TABLE_MISSING` | 503 | Migration pendente (P2021) |
| `DB_SCHEMA_DRIFT` | 503 | Schema desincronizado com codigo (P2022/P2025) |

---

## Diagnóstico

### `POST /api/analyze` 💾

Gera diagnóstico completo (perfil + score + gaps). Se logado, persiste `Profile` + `ScoreSnapshot` + `Gap[]` + `Consent`.

**Internamente**: LLM (Sonnet 4.6, `cache: false`) + `searchJobs` rodam em
**paralelo via `Promise.allSettled`** (jobs nao precisa do output do LLM,
so do role). Reduz latencia em 3-5s vs serial. Score deterministico em
`lib/scoring/subscores.js` — LLM so explica.

**Request:**
```json
{
  "cv": "Texto do currículo (60-40000 chars)",
  "role": "Cargo-alvo (1-160 chars)"
}
```

**Response 200:**
```json
{
  "snapshotId": "cmqxxx",
  "perfil": {
    "nome": "Mariana Costa",
    "cargo_atual": "Analista de Produto",
    "senioridade": "Pleno",
    "skills": ["SQL", "Figma", "discovery"]
  },
  "sub_scores": {
    "aderencia_vagas": { "valor": 72, "explicacao": "Cobre 7 de 10 requisitos médios. [Mercado]" },
    "relevancia_habilidades": { "valor": 65, "explicacao": "..." },
    "otimizacao_perfil": { "valor": 80, "explicacao": "..." },
    "experiencia_mercado": { "valor": 60, "explicacao": "..." }
  },
  "gaps": [
    {
      "habilidade": "SQL avançado",
      "porque": "Aparece em 68% das vagas senior. [Mercado]",
      "frequencia": "68%",
      "microacao": "Curso de window functions — 4h",
      "impacto": { "dimensao": "relevancia_habilidades", "pontos": 5 }
    }
  ],
  "overall": 71,
  "efemero": false
}
```

Se anônimo: `snapshotId: null`, `efemero: true`.

**Limite**: 3/min anônimo, 10/min logado.

#### `POST /api/analyze?stream=1` (SSE)

Mesma logica, mas resposta `text/event-stream` com 6 etapas progressivas.
Permite UI mostrar "Validando..." -> "Chamando IA..." -> "Calculando score..."
em vez de spinner cego de 15s. Pipeline interno (auth, rate-limit, validacao,
billing, persist) e **identico** ao JSON path — so o transporte muda. Sem o
param, back-compat total (JSON one-shot).

**Eventos emitidos** (cada um e um `data: <json>\n\n`):

```json
{ "type": "step", "step": "validating" }
{ "type": "step", "step": "llm_jobs_parallel" }
{ "type": "step", "step": "computing" }
{ "type": "step", "step": "persisting" }
{ "type": "result", "payload": { /* mesmo shape do JSON */ } }
{ "type": "done" }
```

Em erro estruturado (validacao, LLM_FAILED, LIMIT_REACHED, etc):

```json
{ "type": "error", "status": 402, "error": "...", "code": "LIMIT_REACHED" }
```

**Importante**: status HTTP da response e sempre `200` em SSE (spec) —
cliente trata erro pelo evento `type: "error"`, nao por status code.
Headers: `cache-control: no-cache, no-transform`, `x-accel-buffering: no`
(anti-buffering nginx).

---

## Oportunidades

### `POST /api/opportunities` 💾

Busca vagas reais em **6 providers em paralelo** (`Promise.allSettled`,
fail-soft) — Adzuna BR, Jooble, Greenhouse ATS, Lever ATS, Ashby ATS,
Workable ATS — calcula match deterministico em codigo, gera plano de 3
semanas. Se `snapshotId` informado, persiste `PlanItem[]` ligados.

**Request:**
```json
{
  "snapshotId": "cmqxxx",
  "role": "Product Manager de IA",
  "perfil": { "...": "shape do diag" },
  "gaps": ["SQL avançado", "Threat modeling"]
}
```

**Response 200:**
```json
{
  "vagas": [
    {
      "titulo": "Senior PM AI",
      "empresa": "Nubank",
      "local": "São Paulo, SP",
      "match": 78,
      "porque": "Cobre 5 dos 7 requisitos do anúncio. [Base de Vagas]",
      "falta": ["LLMOps", "MLOps"],
      "source": "adzuna",
      "sourceLabel": "Adzuna",
      "url": "https://adzuna.com.br/...",
      "salario": "R$ 18.000"
    }
  ],
  "plano": [
    {
      "semana": 1,
      "foco": "Fundamentos LLMOps",
      "acoes": [{ "titulo": "Curso intro LLMOps", "impacto": "+4 aderência", "esforco": "Médio" }]
    }
  ],
  "sources": ["adzuna", "jooble"],
  "illustrative": false
}
```

`illustrative: true` quando todas as vagas vieram de fixtures (sem provider configurado ou sem retorno real).

**Limite**: 3/min anônimo, 10/min logado.

---

## Imports

### `POST /api/cv/upload` 🔒

Upload de PDF do currículo. Multipart form-data.

**Request**: `FormData` com campo `file` (PDF, max 5MB).

**Response 200:**
```json
{ "text": "Conteúdo extraído do PDF" }
```

**Defesas**: magic-bytes check (header `%PDF-`), Content-Length antes do parse, parser pdf-parse sandbox, hash SHA256 do payload pra Consent.

**Códigos de erro**: `PDF_TOO_LARGE`, `PDF_NO_TEXT`, `PDF_PARSER_UNAVAILABLE`, `PDF_INVALID`.

### `POST /api/linkedin/parse` 💾

Recebe texto colado do LinkedIn (Sobre + Experiência + Skills), retorna
estrutura + CV consolidado pra reusar no diagnóstico.

**Modelo**: Haiku 4.5 (`completeJSONFastWithUsage`) — 3-5x mais rapido,
1/4 do custo. **Cache LLM habilitado** (entrada idempotente — mesmo texto
do LinkedIn => mesma resposta).

**Request:**
```json
{ "text": "Sobre: ... Experiência: ... (mín 120 chars)" }
```

**Response 200:**
```json
{
  "cv": "Texto consolidado pronto pro /api/analyze",
  "perfil": {
    "nome": "...",
    "headline": "...",
    "cargo_atual": "...",
    "senioridade": "Senior",
    "localidade": "São Paulo",
    "sobre": "...",
    "experiencias": [{ "cargo": "", "empresa": "", "periodo": "", "descricao": "" }],
    "formacoes": [...],
    "skills": [...]
  }
}
```

Logado: persiste em `Profile.linkedinJson` + `Consent LINKEDIN_PASTE`.
**Limite**: 2/min anônimo, 8/min logado.

### `POST /api/portfolio/import` 💾

Importa portfólio do GitHub e/ou site pessoal.

**Modelo**: Haiku 4.5 (`completeJSONFastWithUsage`). **Cache LLM habilitado**.

**Request** (informe pelo menos um):
```json
{
  "github": "akamitatrush",
  "url": "https://meu-site.com"
}
```

**Validações**:
- `github`: regex `^[a-zA-Z0-9._-]{1,80}$`
- `url`: URL válida, **anti-SSRF** (bloqueia IPv4 privados, IPv6 privados, CGNAT, link-local 169.254 — metadata cloud, `.local`, `.internal`, `.lan`)
- **Anti DNS-rebinding**: `dns.lookup` valida IP antes do fetch real

**Response 200:**
```json
{
  "portfolio": {
    "resumo": "Perfil técnico backend distribuído com foco em segurança.",
    "stack": ["Node.js", "Postgres", "Docker", "Go"],
    "projetos": [
      {
        "nome": "log-aggregator",
        "descricao": "Pipeline de ingestão de logs com 50k req/s.",
        "stack": ["Go", "Kafka"],
        "url": "https://github.com/.../log-aggregator",
        "destaque": "Arquitetura distribuída e tuning de performance"
      }
    ]
  },
  "warnings": []
}
```

Logado: persiste em `Profile.portfolioJson` + `Profile.githubUser` + `Consent PORTFOLIO_*`.
**Limite**: 2/min anônimo, 8/min logado.

---

## Ferramentas IA

### `POST /api/tailor` 💾

Adapta o CV pra uma vaga específica. Aceita modo anonimo (efemero). Sonnet 4.6
(`cache: false` — usuario espera sempre adaptacao fresca).

**Request:**
```json
{
  "role": "Senior PM AI",
  "cv": "Texto do CV",
  "vaga": { "titulo": "...", "empresa": "...", "descricao": "..." }
}
```

**Response 200:**
```json
{
  "resumo_adaptado": "2-3 frases alinhadas à vaga",
  "bullets": [
    { "texto": "Liderou discovery de feature X", "tipo": "reorganizacao", "base": "Já está no CV em XYZ Corp" },
    { "texto": "Aumentou retenção em 15%", "tipo": "nova", "base": "VOCÊ PRECISA CONFIRMAR — não está no CV original" }
  ],
  "observacao": "Esta adaptação prioriza experiência em discovery quantitativo."
}
```

**Princípio**: tipo `"nova"` sempre marcado. Usuário precisa validar antes de copiar.
**Limite**: 3/min anônimo, 10/min logado.

### `POST /api/interview` 💾

Simulador STAR/CAR. Dois modos. Aceita modo anonimo (efemero, rate-limit
mais apertado).

**Modelos**:
- `action: "question"` -> Haiku 4.5 (rapido + cache habilitado, mesma
  pergunta pode repetir em mock).
- `action: "evaluate"` -> Sonnet 4.6 (critico, `cache: false` — feedback
  deve ser sempre fresco pra resposta especifica do user).

#### Modo `question`

**Request:**
```json
{
  "action": "question",
  "role": "PM AI",
  "gaps": ["LLMOps", "Threat modeling"],
  "asked": ["Pergunta 1 já feita", "Pergunta 2..."]
}
```

**Response:**
```json
{
  "pergunta": "Conte sobre uma decisão de produto onde você usou dados quantitativos vs. qualitativos.",
  "tipo": "comportamental",
  "dica": "Resposta forte cobre: contexto, dados consultados, trade-off, decisão final."
}
```

#### Modo `evaluate`

**Request:**
```json
{
  "action": "evaluate",
  "role": "PM AI",
  "pergunta": "...",
  "resposta": "Texto da resposta do candidato (1-8000 chars)"
}
```

**Response:**
```json
{
  "metodo": "STAR",
  "presentes": ["Situação", "Ação"],
  "faltando": ["Tarefa", "Resultado"],
  "feedback": "2-3 frases honestas e específicas",
  "versao_sugerida": "Versão melhorada com marcador [adicione aqui um resultado mensurável real] onde faltar dado",
  "alerta_autenticidade": "Versão sugerida assume X que você não disse — confirme antes de usar",
  "nota": 72
}
```

**Princípio**: nunca inventa resultado. `alerta_autenticidade` é proteção contra "treinar e mentir".
**Limite**: 5/min anônimo, 20/min logado.

### `POST /api/chat` 💾

Conversa livre com o "gêmeo" — responde só com base em perfil + lacunas.
Sonnet 4.6 (`cache: false` — history sempre muda). Modo anonimo: cliente
manda perfil/gaps no body. Logado: server carrega do DB (anti-spoofing).

**Request:**
```json
{
  "role": "PM AI",
  "perfil": { "...": "shape do diag" },
  "gaps": ["..."],
  "history": [
    { "role": "user", "content": "Mensagem 1" },
    { "role": "assistant", "content": "Resposta 1" }
  ],
  "message": "Nova pergunta"
}
```

**Response:**
```json
{ "resposta": "Máximo 5 frases, sem inventar fato sobre você." }
```

**Limite**: 5/min anônimo, 30/min logado.

### `POST /api/cv/analyze-bullets` 💾

Avalia bullets do CV (impacto, verbo, metrica). Haiku 4.5 + cache LLM
habilitado.

---

## Perfil & Score

### `POST /api/profile/refresh` 🔒

Re-roda diagnostico usando `Profile.rawCv` + `targetRole` ja persistidos
(nao pede CV de novo). **Mesmo bucket de rate-limit do `/api/analyze`**.

**Request:**
```json
{ "applyCompletedSkills": true }
```

- `applyCompletedSkills: true` -> aplica skills de gaps concluidos +
  bonus deterministico (cap 15/sub-score + 25 total) e usa
  `previousSnapshot.subScores` como **baseline** pra os novos sub-scores.
  Garante que **score nunca cai** depois de marcar microacao.
- `applyCompletedSkills: false` (default) -> so recalcula. Aceita oscilacao
  da LLM (re-extracao integral).

**Response 200:**
```json
{
  "snapshotId": "cmqxxx",
  "overall": 76,
  "previousScore": 71,
  "delta": 5,
  "appliedSkills": ["SQL avançado"],
  "projectedGains": { "relevancia_habilidades": 5, "aderencia_vagas": 0, "otimizacao_perfil": 0, "experiencia_mercado": 0 }
}
```

**Errors**:
- `NO_RAW_CV` 400 — rawCv expirado pelo cron de redact (>90d). Redirect `/`.
- `NO_TARGET_ROLE` 400 — sem `targetRole`. Redirect `/conta`.

### `GET /api/profile/completeness` 🔒

Retorna `{score, missing[]}` — score de completude do perfil (campos
preenchidos × pesos) usado em `/dashboard`.

### `POST /api/profile/onboarding` 🔒

Persiste estado X/3 fontes (CV/LinkedIn/Portfolio) pro welcome flow.

### `GET /api/score/latest-with-history` 🔒

Retorna `{latest, history[]}` — snapshot mais recente + ate 20 historicos
ordenados desc por createdAt. Usado em `/dashboard`, `/transparencia`.

### `GET /api/history/score` 🔒

Lista snapshots paginados (debug/export).

### `GET /api/history/actions` 🔒

Timeline de acoes do usuario (gap completes, plan items, evidence,
applications). Usado em `/carreira`.

### `GET /api/metrics/median` 🔒

Retorna mediana de overall por papel/senioridade pro comparativo
"perfis como o seu". Calculado em `lib/metrics/`.

---

## Gaps & Plano

### `GET /api/gaps/summary` 🔒

Consolida gaps do snapshot mais recente.

### `GET /api/gaps/requirements` 🔒

Lista skills requeridas mais frequentes nas vagas do `targetRole`.

### `POST /api/gaps/courses` 🔒

Sugere cursos curados pra um gap especifico via RAG hybrid
(skill-keyed lookup + boost gratuitos).

**Request:** `{ "skill": "SQL avançado" }`

### `POST /api/gaps/:id/complete` 🔒

Marca gap como concluido (`completedAt = now()`). Idempotente. Aciona
achievement `COURSE_COMPLETED` na primeira.

### `POST /api/plan-items/:id/complete` 🔒

Marca item do plano como feito (`done = true`).

---

## Candidaturas

Funil de candidaturas (kanban). Todas exigem 🔒.

### `GET /api/applications`

Lista candidaturas do usuário ordenadas por `updatedAt`. Limite 200.

**Response:**
```json
{
  "items": [
    {
      "id": "cmqxxx",
      "titulo": "...",
      "empresa": "...",
      "local": "São Paulo",
      "url": "...",
      "salario": "R$ 18000",
      "source": "adzuna",
      "status": "INTERVIEW",
      "notes": null,
      "savedAt": "2026-06-20T10:00:00Z",
      "appliedAt": "2026-06-21T14:00:00Z",
      "rejectedAt": null,
      "offerAt": null,
      "updatedAt": "2026-06-21T14:00:00Z"
    }
  ]
}
```

### `POST /api/applications`

Cria nova candidatura.

**Request:**
```json
{
  "titulo": "Senior PM AI",
  "empresa": "Nubank",
  "local": "São Paulo",
  "url": "https://...",
  "salario": "R$ 18.000",
  "source": "adzuna",
  "status": "SAVED",
  "notes": "Indicação interna"
}
```

**Dedup**: se já existe candidatura com mesmo `(userId, titulo, empresa)`, retorna a existente com `duplicated: true` em vez de criar nova.

**Statuses válidos**: `SAVED`, `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`.

### `PATCH /api/applications/:id`

Atualiza status e/ou notas. Cria `ApplicationEvent` (timeline auditável). Marca data automática (`appliedAt`, `offerAt`, `rejectedAt`) se status muda pra correspondente.

**Request** (informe pelo menos um):
```json
{ "status": "INTERVIEW", "notes": "Marcaram pra terça" }
```

### `DELETE /api/applications/:id`

Apaga (cascade no `ApplicationEvent[]`).

---

## Evidências & CVs adaptados

### `GET /api/evidence` 🔒

Lista evidencias do usuario (`Evidence[]`).

### `POST /api/evidence` 🔒

Cria evidencia (kind, title, description, url).

### `DELETE /api/evidence/:id` 🔒

Apaga evidencia.

### `GET /api/tailored-cvs` 🔒

Lista CVs adaptados (`TailoredCv[]`).

### `GET /api/tailored-cvs/:id` 🔒

Detalhes de 1 CV adaptado com diff antes/depois.

---

## Autoconhecimento

### `GET /api/assessments/:kind` 🔒

Retorna progresso do assessment. `kind ∈ {DISC_LITE, VALUES, IKIGAI}`.

### `POST /api/assessments/:kind` 🔒

Persiste respostas + resultado em `AssessmentResult`. Body: `{answers, result}`.

---

## Notifications & Daily Quest

### `GET /api/notifications` 🔒

Lista notificacoes do usuario (sininho na sidebar).

### `POST /api/notifications/:id/read` 🔒

Marca uma como lida.

### `POST /api/notifications/read-all` 🔒

Marca todas como lidas.

### `GET /api/me/daily-quest` 🔒

Retorna quest do dia (template em `lib/daily-quest-templates.js`).

### `POST /api/me/daily-quest/complete` 🔒

Marca quest como concluida.

### `GET /api/me/preferences` 🔒

Retorna `{digestEnabled, theme, ...}`.

### `POST /api/me/preferences` 🔒

Atualiza preferencias (toggle digest, theme).

### `POST /api/me/outcome` 🔒

Registra outcome (interview marcada, oferta, etc) — alimenta cron de
outcome-survey.

### `POST /api/_track` (publica)

Endpoint interno pra eventos client-side (PostHog proxy). Rate-limited.

---

## Billing

Sem `STRIPE_SECRET_KEY` setado, todos retornam **503 amigavel** (`SERVICE_UNAVAILABLE`).

### `POST /api/billing/checkout` 🔒

Cria Stripe Checkout Session. Body: `{priceId}`. Retorna `{url}` pra redirect.

### `POST /api/billing/portal` 🔒

Cria Customer Portal Session (gerenciar cartao, cancelar, ver invoices).
Retorna `{url}`.

### `GET /api/billing/plan` 🔒

Retorna plano atual: `{plan, status, currentPeriodEnd, ownerBypass}`.

### `POST /api/billing/webhook` (publica, **HMAC**)

Endpoint Stripe. Autentica via header `Stripe-Signature` (HMAC verify) +
idempotency check (`BillingEvent.stripeEventId` unique). **Nao precisa de
session**. Trata eventos: `checkout.session.completed`,
`customer.subscription.*`, `invoice.payment_succeeded`,
`invoice.payment_failed`.

---

## LGPD & Conta

### `GET /api/me/export` 🔒

Baixa JSON com tudo que está em nome do usuário no banco. Headers `Content-Disposition: attachment` com filename.

**Resposta**: JSON com `User`, `Profile`, `ScoreSnapshot[]` (com `Gap[]` e `PlanItem[]`), `Application[]`, `Consent[]`, `DataSource[]`, `Evidence[]`, `TailoredCv[]`, `AssessmentResult[]`.

### `GET /api/health` (publica)

Retorna `{status, db, time}` pra UptimeRobot. Sem auth, sem rate-limit.

---

## Cron

Todos os endpoints `/api/cron/*` exigem header `x-cron-secret`
(comparacao constant-time contra `CRON_SECRET` env). 6 crons configurados
em `vercel.json`:

| Path | Schedule | Funcao |
|---|---|---|
| `POST /api/cron/digest` | `0 12 * * 1` (seg 12h UTC) | Email semanal de vagas (match ≥ 60%, top 5) |
| `POST /api/cron/daily-briefing` | `0 11 * * 0,2,3,4,5,6` (todo dia menos seg, 11h UTC) | Briefing diario in-app + email curto |
| `POST /api/cron/outcome-survey` | `0 14 * * 1` (seg 14h UTC) | Pesquisa de outcome (entrevistas? ofertas?) |
| `POST /api/cron/redact-cv` | `0 6 * * *` (diario 6h UTC) | LGPD: redacta `Profile.rawCv` expirado (>90d) |
| `POST /api/cron/redact-billing` | `0 4 1 * *` (mes dia 1 4h UTC) | LGPD: redacta payload Stripe antigo |
| `POST /api/cron/usage-cleanup` | `0 3 1 * *` (mes dia 1 3h UTC) | Apaga `UsageMeter` > 3 meses |

**Nota cron Vercel**: day-of-week `0,2,3,4,5,6` (lista enumerada) em vez de
`2-7` — o parser do Vercel rejeita ranges fora de 1-7. Convencao Unix:
0 = domingo, 6 = sabado.

### Exemplo: `/api/cron/digest`

**Headers obrigatórios:**
```
x-cron-secret: <valor de CRON_SECRET>
```

**Lógica**:
1. Lista users com `digestEnabled=true` + `targetRole` + `lastDigestAt > 7 dias`
2. Para cada (BATCH=10 paralelo + dedup por role): busca vagas, filtra match ≥ 60%, top 5
3. Envia email HTML via Resend
4. Marca `lastDigestAt = now()`

**Response:**
```json
{
  "ok": true,
  "candidates": 12,
  "sent": 8,
  "skipped": 4,
  "errors": []
}
```

---

## Autenticação

Auth.js v5 com:
- **Email magic link** via Resend (prod) ou Nodemailer/Mailpit (dev)
- **LinkedIn OIDC** (opcional, se `AUTH_LINKEDIN_*` configurado)
- **Credentials dev** (opcional, só `NODE_ENV !== "production"`, exige `AUTH_DEV_CREDENTIALS=true`)

Endpoints padrão do NextAuth em `/api/auth/*`. Sessão via JWT em cookie HTTP-only.

`session.user.id` contém o `User.id` do Prisma — usado em todas as queries pra escopo (sem IDOR).

---

## Rate limits resumidos

Janela: **60 segundos**. Chave: `route:userId` se logado, `route:ip` se anônimo.
**Upstash Redis** em prod (cross-lambda) com fallback Map em-memoria.

| Rota | Anônimo | Logado |
|---|---|---|
| `/api/analyze` | 3/min | 10/min |
| `/api/profile/refresh` | 3/min | 10/min (mesmo bucket de `analyze`) |
| `/api/opportunities` | 3/min | 10/min |
| `/api/tailor` | 3/min | 10/min |
| `/api/linkedin/parse` | 2/min | 8/min |
| `/api/portfolio/import` | 2/min | 8/min |
| `/api/cv/analyze-bullets` | 3/min | 10/min |
| `/api/interview` | 5/min | 20/min |
| `/api/chat` | 5/min | 30/min |

Auth tambem tem rate-limit: **3 magic-links/email/hora**.

Demais rotas (`/api/applications/*`, `/api/me/export`, `/api/cv/upload`) **não têm rate limit explícito** porque são autenticadas e não consomem LLM.

### Plano (enforcement por plano)

Alem do rate-limit por minuto, rotas LLM tambem batem em `enforceUsage`
(`lib/billing/enforce.js`, `Prisma.$transaction` Serializable). Se a quota
mensal do plano (Free / Pro M / Pro Y / Team) for atingida, retorna **402
`LIMIT_REACHED`** com `upgradeUrl: /precos`. **Pre-check de budget USD/dia**
roda em paralelo (cost amplification defense) — se passar, retorna **402
`BUDGET_EXCEEDED`**. `OWNER_EMAILS` env bypassa tudo.

---

## Observabilidade

Cada chamada LLM **que vai a campo** emite 1 linha JSON estruturada em `stdout`
(cache hit nao chama o provider — nao gera log):

```json
{
  "evt": "llm.usage",
  "ts": "2026-06-22T01:14:42.769Z",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "route": "analyze",
  "userId": "cmqxxx",
  "inputTokens": 782,
  "outputTokens": 1206,
  "costUsd": 0.020436,
  "latencyMs": 23065
}
```

Rotas Haiku (Wave 17) emitem `"model": "claude-haiku-4-5-20251001"` com
`costUsd` proporcionalmente menor (~1/4 de Sonnet).

Pra ingerir em Datadog/Loki/CloudWatch: filtrar por `evt:"llm.usage"`. Pra agregação de custo por usuário/dia:

```sql
SELECT userId, DATE(ts), SUM(costUsd)
FROM llm_usage
GROUP BY userId, DATE(ts)
HAVING SUM(costUsd) > 1
```

---

*API v0.10 (post Wave 17). 49 route handlers. Versionada via Git, sem
versionamento de URL ainda (`/v1/`, `/v2/`).*
