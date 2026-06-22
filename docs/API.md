# CareerTwin AI — Referência de API

Documentação técnica das rotas internas. Todas em `/api/*`, runtime Node, retorno JSON.

> **Aviso**: API interna, **não pública**. Rotas LLM têm rate limit por IP/userId. Em produção, requer `Origin` mesmo domínio (Server Actions / CORS fechado).

## Sumário

- [Convenções](#convenções)
- [Erros padrão](#erros-padrão)
- [Diagnóstico](#diagnóstico)
- [Oportunidades](#oportunidades)
- [Imports](#imports)
- [Ferramentas IA](#ferramentas-ia)
- [Candidaturas](#candidaturas)
- [LGPD](#lgpd)
- [Cron](#cron)
- [Autenticação](#autenticação)
- [Rate limits](#rate-limits-resumidos)

---

## Convenções

- **Auth**: rotas marcadas com 🔒 exigem sessão Auth.js. Sessão via cookie HTTP-only.
- **Persistência**: rotas marcadas com 💾 persistem se logado, retornam efêmero se anônimo.
- **Validação**: todo `POST` valida o body com Zod `.strict()`. Body com campo extra → 400.
- **Rate limit**: rotas LLM têm limite por IP (anônimo) ou userId (logado). 429 com `Retry-After`.
- **Idempotência**: nenhuma rota é idempotente — cada POST consome quota LLM.

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
| `UNAUTHORIZED` | 401 | Sem sessão |
| `NOT_FOUND` | 404 | Recurso não existe ou não é do usuário |
| `RATE_LIMITED` | 429 | Quota da janela esgotada |
| `LLM_FAILED` | 502 | LLM timeout / erro de rede |
| `LLM_INVALID` | 502 | LLM devolveu shape fora do esperado |
| `PERSIST_FAILED` | 500 | Erro ao gravar no banco |
| `URL_BLOCKED` | 400 | URL bloqueada por SSRF (portfolio) |
| `FETCH_EMPTY` | 422 | Fonte externa não devolveu nada útil |

---

## Diagnóstico

### `POST /api/analyze` 💾

Gera diagnóstico completo (perfil + score + gaps). Se logado, persiste `Profile` + `ScoreSnapshot` + `Gap[]` + `Consent`.

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

---

## Oportunidades

### `POST /api/opportunities` 💾

Busca vagas reais (Adzuna BR + Jooble + Greenhouse em paralelo), calcula match, gera plano de 3 semanas. Se `snapshotId` informado, persiste `PlanItem[]` ligados.

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

Recebe texto colado do LinkedIn (Sobre + Experiência + Skills), retorna estrutura + CV consolidado pra reusar no diagnóstico.

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

### `POST /api/tailor` 🔒

Adapta o CV pra uma vaga específica.

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

### `POST /api/interview` 🔒

Simulador STAR/CAR. Dois modos.

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

### `POST /api/chat` 🔒

Conversa livre com o "gêmeo" — responde só com base em perfil + lacunas.

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

## LGPD

### `GET /api/me/export` 🔒

Baixa JSON com tudo que está em nome do usuário no banco. Headers `Content-Disposition: attachment` com filename.

**Resposta**: JSON com `User`, `Profile`, `ScoreSnapshot[]` (com `Gap[]` e `PlanItem[]`), `Application[]`, `Consent[]`, `DataSource[]`.

---

## Cron

### `POST /api/cron/digest`

Endpoint protegido por `CRON_SECRET` (header `x-cron-secret`, comparação constante-tempo).

**Headers obrigatórios:**
```
x-cron-secret: <valor de CRON_SECRET>
```

**Lógica**:
1. Lista users com `digestEnabled=true` + `targetRole` + `lastDigestAt > 7 dias`
2. Pra cada: busca vagas, filtra match ≥ 60%, top 5
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

Configurado em `vercel.json` pra rodar `0 12 * * 1` (segunda 12h UTC).

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

| Rota | Anônimo | Logado |
|---|---|---|
| `/api/analyze` | 3/min | 10/min |
| `/api/opportunities` | 3/min | 10/min |
| `/api/tailor` | 3/min | 10/min |
| `/api/linkedin/parse` | 2/min | 8/min |
| `/api/portfolio/import` | 2/min | 8/min |
| `/api/interview` | 5/min | 20/min |
| `/api/chat` | 5/min | 30/min |

Demais rotas (`/api/applications/*`, `/api/me/export`, `/api/cv/upload`) **não têm rate limit explícito** porque são autenticadas e não consomem LLM.

---

## Observabilidade

Cada chamada LLM emite 1 linha JSON estruturada em `stdout`:

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

Pra ingerir em Datadog/Loki/CloudWatch: filtrar por `evt:"llm.usage"`. Pra agregação de custo por usuário/dia:

```sql
SELECT userId, DATE(ts), SUM(costUsd)
FROM llm_usage
GROUP BY userId, DATE(ts)
HAVING SUM(costUsd) > 1
```

---

*API v0.4. Versionada via Git, sem versionamento de URL ainda (`/v1/`, `/v2/`).*
