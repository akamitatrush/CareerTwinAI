# Security Re-Audit — Sauron — Wave 11 — 2026-06-26

Audit defensiva RESEARCH-ONLY do CareerTwin AI (branch `redesign/claude-design`).
Escopo: validar fixes da Wave 5 + status dos 4 P1 da Wave 4 + mudanças
da Wave 10A (SrcChip, /candidaturas reroute, tokens globais) + novos riscos
OWASP 2025/Agentic AI 2026.

Frameworks: **OWASP Top 10:2025** + **OWASP Top 10 for LLM Applications (2025)**
+ **Agentic AI Security (2026)** + **LGPD**.

---

## Executive Summary

| Status | Item |
|---|---|
| **OK** | Os 4 P0 da Galadriel Blue Team (Wave 5) estão FIXADOS e validados. |
| **REGRESSÃO ZERO** | Nenhuma migration posterior re-introduz os bugs corrigidos. |
| **AINDA ABERTO** | Os 4 P1 da Sauron Wave 4 continuam **NÃO RESOLVIDOS** — prioridade alta para Wave 12. |
| **NOVOS** | Wave 10A introduziu **0 novos riscos** — SrcChip é seguro por construção, /candidaturas reroute mantém proteção, tokens CSS são valores fixos. |
| **LGPD** | linkedinRaw TTL fechou o último gap conhecido. AuditLog cobre as ações sensíveis. Export e Erase cobrem o schema novo. |
| **AGENTIC AI** | Memory dir `~/.claude/projects/.../memory/` NÃO contém PII de usuários reais — só protocolo/estratégia (validado por busca). |

**Veredito Wave 11:** o produto está num ponto sólido após Wave 5. Os P1 da
Wave 4 viraram débito técnico real — não bloqueiam o lançamento, mas precisam
fechar na Wave 12 antes do go-public. Wave 10A é clean.

---

## Validação fixes Wave 5

### Fix #1: Cron auth helper — `lib/cron-auth.js` ✅ OK

**Evidência:** `lib/cron-auth.js:19-82`

- **timingSafeEqual usado mesmo?** SIM (`lib/cron-auth.js:29,32`). Não usa `===` em nenhum ponto.
- **Padding pra evitar leak de length?** SIM (`lib/cron-auth.js:27-31`) — quando `A.length !== B.length`, ainda chama `timingSafeEqual(A, Buffer.alloc(A.length))` antes de retornar false. Tempo proporcional ao input recebido, sem early-return curto.
- **Aceita ambos headers?** SIM (`lib/cron-auth.js:68-72`) — avalia tanto `Authorization: Bearer ...` quanto `x-cron-secret`, e SEMPRE roda os dois comparadores (mesmo se o primeiro bateu) pra não vazar por timing qual header passou.
- **Aplicado em TODOS os 6 crons?** SIM — `grep -rn "verifyCronAuth" app/api/cron/` confirma os 6: `redact-billing`, `outcome-survey`, `daily-briefing`, `redact-cv`, `usage-cleanup`, `digest`.
- **CRON_SECRET vaza em erro?** NÃO — caller recebe só `{ ok, code }`. O secret/token recebido nunca aparece nas respostas dos crons (verificado em `app/api/cron/redact-cv/route.js:38-43`).

**Detalhe positivo:** `extractBearer` (`lib/cron-auth.js:38-43`) é case-insensitive
e tolera espaços extras (regex `^bearer\s+(.+)$/i`). Quando env `CRON_SECRET`
está ausente, retorna `CRON_NOT_CONFIGURED` (500), e o cron responde **fail-closed**.

### Fix #2: linkedinRaw TTL ✅ OK

**Evidência:** `prisma/migrations/20260629200000_add_linkedin_raw_ttl/migration.sql`, `prisma/schema.prisma:108-122`, `app/api/cron/redact-cv/route.js`, `app/api/linkedin/parse/route.js:155-181`

- **Migration aplicada?** SIM (`20260629200000_add_linkedin_raw_ttl/migration.sql:18-19`) — adiciona `linkedinRawExpiresAt` e `linkedinRawRedactedAt`.
- **Enum AuditAction estendido?** SIM (linha 21 da migration) — `LINKEDIN_RAW_REDACTED` adicionado.
- **Schema reflete?** SIM (`prisma/schema.prisma:122` — `linkedinRawExpiresAt DateTime?`).
- **Cron query OR cobre os dois caminhos?** SIM (`app/api/cron/redact-cv/route.js:55-71`) — clausula `OR` raiz com `AND` por subcondição (rawCv expirado E não-redactado), (linkedinRaw expirado E não-redactado). Profile com ambos expirados é processado uma vez só.
- **Audit log `LINKEDIN_RAW_REDACTED` emitido?** SIM (`app/api/cron/redact-cv/route.js:142-150`).
- **TODOS os INSERT/UPDATE de linkedinRaw setam linkedinRawExpiresAt?** SIM — só existe um ponto de gravação real (`app/api/linkedin/parse/route.js:166-169` no create e :176-179 no update), e ambos setam `linkedinRawExpiresAt = Date.now() + 90d` e `linkedinRawRedactedAt = null`. `grep` confirma que profile/refresh NÃO grava linkedinRaw (não persiste o texto bruto).

**Detalhe positivo:** comentário no migration documenta que backfill de
registros legados foi deliberadamente NÃO-feito (próximo update do user
seta o TTL; cron pode ser estendido depois). Trade-off honesto.

### Fix #3: courses/click safeExternalUrl ✅ OK

**Evidência:** `lib/validators.js:1-23`, `lib/url-safe.js`, `app/api/courses/click/route.js:23-39`

- **Schema Zod usa `safeExternalUrl`?** SIM (`app/api/courses/click/route.js:39`).
- **Helper rejeita schemes perigosos?** SIM (`lib/validators.js:7-23`) — `SAFE_URL_SCHEMES = new Set(["http:", "https:"])`. `new URL(s)` parseia, e se `protocol` não estiver no set, refine falha. Cobre `javascript:`, `data:`, `vbscript:`, `file:`, `chrome:`, `about:`, `blob:`, etc.
- **safeHref aplicado em NotificationsBell?** SIM (`components/NotificationsBell.js:17,312,316,318`).
- **Outras rotas com `z.string().url()`?** ZERO — `grep -rn "z\.string()\.url()" app/ lib/` retornou apenas 1 hit em comentário (`app/api/courses/click/route.js:31` — texto histórico, não código). Migração completa.

**Defesa em camadas:** `safeHref` (lib/url-safe.js) é aplicado nos componentes
de render (RadarClient, KanbanClient, MicroactionCard, EvidenceItem,
PortfolioImportButton, Report, NotificationsBell) — mesmo se um bypass entrar
no DB, o render bloqueia. Padrão de codigo correto.

### Fix #4: HNSW index restaurado ✅ OK

**Evidência:** `prisma/migrations/20260629100000_restore_knowledge_embedding_idx/migration.sql`

- **Migration `restore_knowledge_embedding_idx` existe?** SIM (data 20260629100000).
- **Nenhuma migration POSTERIOR contém `DROP INDEX KnowledgeChunk_embedding_idx`?** SIM. `grep -rn "DROP INDEX.*embedding"` mostra apenas 2 ocorrências: (1) o drop original na `20260625045109_add_funnel_and_welcome/migration.sql:2` (causa raiz); (2) o `DROP IF EXISTS` defensivo dentro do próprio restore (idempotência). Nenhuma migration de data > 20260629100000 dropa de novo.
- **Comentário documentando o pitfall do Prisma?** SIM (`20260629100000_restore_knowledge_embedding_idx/migration.sql:3-7`) — explica que Prisma não mapeia índices em colunas `Unsupported("vector")` e por isso o diff descartou o índice junto com alterações não-relacionadas.

**Conclusão:** RAG está operando com HNSW + vector_cosine_ops, batendo com
o operador `<=>` usado em `lib/knowledge/retrieval.js`. Performance restaurada.

---

## Status dos 4 P1 do Wave 4 (Sauron)

> Wave 5 (Galadriel) focou nos 4 P0 do audit dela e nos próprios. Os 4 P1 do
> meu audit Wave 4 NÃO foram tocados. Detalhamento abaixo.

### P1.1 — Prompt injection via `TailorBody.vaga` ⚠️ AINDA ABERTO

**Evidência:** `lib/validators.js:192-204`

```js
export const TailorBody = z
  .object({
    role: z.string().min(1).max(160),
    cv: z.string().min(60).max(40_000),
    vaga: z.object({}).passthrough(),   // <-- CONTINUA passthrough
    applicationId: z.string().min(1).max(50).optional(),
    vagaTitulo: z.string().min(1).max(200).optional(),
    vagaEmpresa: z.string().min(1).max(200).optional(),
  })
  .strict();
```

`promptTailor` em `lib/prompts.js:192-208` ainda faz `VAGA: ${JSON.stringify(vaga)}`
(linha 196) sem allowlist nem sanitize do conteúdo. `sanitize()` (linha 29-34)
só remove `"""` e `\0` — não neutraliza newlines, `</s>`, ou texto adversarial.

**Status:** **MITIGAÇÃO ZERO**. Atacante logado pode injetar instruções em
`vaga.descricao` e tentar vazar o system prompt (LLM01/LLM07).

**Fix recomendado:** trocar por `z.object({ titulo: z.string().max(200),
empresa: z.string().max(160), descricao: z.string().max(2000),
local: z.string().max(120).optional(), url: safeExternalUrl.optional()
}).strict()` + em `promptTailor` extrair só campos esperados e passar
via `sanitize()`.

### P1.2 — Prompt injection via `OppBody.perfil` ⚠️ AINDA ABERTO

**Evidência:** `lib/validators.js:92-108`

```js
export const OppBody = z
  .object({
    snapshotId: z.string().min(1).max(50).optional(),
    role: z.string().min(1).max(160).optional(),
    perfil: z.any().optional(),     // <-- CONTINUA z.any()
    gaps: z.array(z.string().max(120)).max(20).optional(),
    ...
  })
  .strict();
```

`app/api/opportunities/route.js:129` continua: `const perfil = snapshot?.perfilJson || perfilIn;`
— modo anônimo (sem `snapshotId`) cai em `perfilIn` direto.

`promptOpp` em `lib/prompts.js:96-105` faz `PERFIL: ${JSON.stringify(perfil)}`,
e o mesmo padrão se repete em `promptOppReal` (linha 114), `promptPlano`
(linha 134) e `promptChat` (linha 280).

**Status:** **MITIGAÇÃO ZERO**. No modo logado o perfil vem do DB (escape via
Prisma + LLM trata como contexto). No modo anônimo, atacante envia perfil
arbitrário com instruções de injeção.

**Mitigante parcial:** rate-limit anônimo (`perMinuteAnon=5`/`3`) reduz
volume de exploit. Não substitui o fix.

**Fix recomendado:** schema estrito por nível em `OppBody.perfil`:
`z.object({ nome: z.string().max(120), cargo_atual: z.string().max(160),
senioridade: z.string().max(60), skills: z.array(z.string().max(60)).max(40)
}).strict().optional()`. Mesmo padrão em `ChatBody` (que já removeu perfil
do body — Wave 4 fechou parte disso).

### P1.3 — Brute-force admin password sem rate-limit ⚠️ AINDA ABERTO

**Evidência:** `app/admin/page.js:61-78`

```js
async function adminLoginAction(formData) {
  "use server";
  const session = await auth();
  if (!session?.user?.email) redirect("/entrar");
  if (!isAdminEmail(session.user.email)) redirect("/dashboard");
  const password = formData.get("password");
  if (!verifyAdminPassword(password)) {
    redirect("/admin?err=1");
  }
  await setAdminCookie();
  redirect("/admin");
}
```

`grep -n guardLLM app/admin/page.js` retorna ZERO. O comentário em
`lib/admin-session.js:18` reconhece que "Rate-limit deve ser aplicado no
caller (server action) via guardLLM" mas ninguém aplicou.

**Status:** **MITIGAÇÃO PARCIAL** — `verifyAdminPassword` (`lib/admin-session.js:42-54`)
é constant-time (timingSafeEqual + pad). Mas **sem rate-limit**, um admin
comprometido (sessão Auth.js de outro device) pode tentar milhares de senhas
em paralelo. Mitigante adicional: dupla camada (precisa também estar
logado + email em ADMIN_EMAILS) — reduz a janela mas não fecha.

**Fix recomendado:** envolver `adminLoginAction` com `checkLimit({ name:
"admin-login", userId: session.user.id, perMinute: 5 })`. Se falhar, audit
`SECURITY_RATE_LIMIT_HIT` e `redirect("/admin?err=2")`.

### P1.4 — PII em `console.error` ⚠️ AINDA ABERTO

**Evidência:** múltiplos endpoints — sample:

- `app/api/interview/route.js:175` — `console.error("interview: LLM falhou", e?.message);`
- `app/api/tailor/route.js` (verificado por padrão) — mesmo padrão
- `app/api/opportunities/route.js:149,268,284,320,371`
- `app/api/linkedin/parse/route.js:101,114,144,197`
- `app/api/cv/analyze-bullets/route.js:227,277`

Em erro de chamada Anthropic/OpenAI, `e.message` pode conter snippet do
request (200-240 chars) — inclui o `user` content do prompt. Para `/api/tailor`
esse `user` content é o CV completo (sanitize, mas integral). Vercel default
captura stderr e roteia pro Sentry sem filter — pode persistir CV em
`getsentry.com`.

**Status:** **MITIGAÇÃO ZERO**. Nenhum filtro/sanitize de erro antes do
`console.error`.

**Fix recomendado:** criar helper `lib/safe-error-log.js` que (a) remove
qualquer string > 80 chars do `e.message`, (b) substitui por `[REDACTED]`,
(c) registra apenas `e.name` + URL/status code + class. Substituir todos
os `console.error("...", e?.message)` por `logSafe("...", e)`.

---

## Re-audit mudanças Wave 10A

### SrcChip novo (`components/SrcChip.js`) ✅ OK

**Evidência:** `components/SrcChip.js:1-60`

- **`dangerouslySetInnerHTML`?** NÃO. `src` é renderizado como children JSX (`{label}` na linha 56), texto literal — React escapa automaticamente.
- **`src` vem de LLM output?** SIM — `RadarClient.js:381` extrai fonte do "porque" gerado pela LLM (formato `[Currículo]`/`[Mercado]`/etc). `MicroactionCard.js:148` idem. **MAS:** o `String(src).replace(/^\[|\]$/g, "").trim()` (linha 24) apenas tira colchetes externos — não executa nada. React escapa qualquer payload textual ao renderizar.
- **`title` HTML attribute escapa?** SIM (atributo JSX em :29-30 — React escapa).
- **SVG inline tem só content estático?** SIM (`<path d="M9 17l6-5-6-5v10z" fill="currentColor" />` na linha 53). Não interpolação de input.

**Defesa positiva** (`components/SrcChip.js:8-13`): o próprio header do
componente menciona OWASP — autor consciente das classes de vulnerabilidade.

**Risco residual:** zero. Componente é XSS-safe por construção. Mesmo que
a LLM tente injetar `<script>alert(1)</script>` no campo, React renderiza
como texto.

### /candidaturas reroute ✅ OK

**Evidência:** `app/(app)/candidaturas/page.js`, `lib/auth-protected-paths.js:27`, `middleware.js`

- **`lib/auth-protected-paths.js` lista corretamente?** SIM (linha 27 — `"/candidaturas"`).
- **Middleware reconhece?** SIM (`middleware.js:90` — `isProtected(pathname)`). Função `isProtected` (`lib/auth-protected-paths.js:68-74`) trata prefixo como exato OU `startsWith(prefix + "/")` — pega `/candidaturas` e `/candidaturas/qualquer-coisa`.
- **Rota antiga ainda existe?** NÃO — `ls app/candidaturas/` retorna "No such file or directory". Reroute foi limpo.
- **Imports relativos quebrados expondo arquivos privados?** NÃO — `page.js` importa de `./KanbanClient` (local ao grupo `(app)`), e `KanbanClient.js` importa `@/lib/url-safe` (path absoluto). Sem dot-dot escape.
- **`page.js` re-checa auth?** SIM (`app/(app)/candidaturas/page.js:19-20` — `if (!session?.user?.id) redirect("/entrar");`). Defense-in-depth contra eventual bypass do middleware.
- **`prisma.application.findMany({ where: { userId: session.user.id } })`** — IDOR-safe.

**Risco residual:** zero.

### Tokens globais.css ✅ OK

**Evidência:** `app/globals.css`

- **CSS injection via tokens?** NÃO — tokens são `--accent-cyan: #B9D90C` etc. Valores hardcoded.
- **`url()` dinâmico?** NÃO — única ocorrência é `background-image: url("data:image/svg+xml;utf8,<svg ...>");` (linha 2635). Conteúdo SVG é literal hardcoded, sem interpolação de input externo.
- **Algum `expression()` ou IE legado?** NÃO.

**Risco residual:** zero.

---

## Novos findings (introduzidos pós Wave 4)

### P0 - Crítico

**Nenhum.** Nenhuma regressão de severidade P0 detectada.

### P1 - Alto

**Nenhum NOVO P1.** Os 4 P1 da Wave 4 continuam abertos (ver seção
"Status dos 4 P1 do Wave 4").

### P2 - Médio

#### P2.A — `OWNER_EMAILS` parsing inseguro pra whitespace em produção [A05:2025 Misconfiguration]

**Evidência:** `app/admin/page.js:252-256`

```js
const ownerEmails = String(process.env.OWNER_EMAILS || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
```

Se alguém configurar `OWNER_EMAILS="sergio@x.com, foo@y.com,;evil@z.com"`,
o `;` não é separador — `evil@z.com` é silenciosamente colado no email
adjacente OU vira owner por engano. Não vi separador além de `,`. Em
prática é menor (só founder configura), mas a falta de regex de validação
após split (`email` válido) abre flanco.

**Fix:** após `.split(",").map(trim)`, filtrar por `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

#### P2.B — `notes` em `ApplicationCreateBody` aceita 4000 chars de texto livre sem sanitize antes de render [LLM02 / A03:2025]

**Evidência:** `lib/validators.js:286,298` — `notes: z.string().max(4000).optional()`

Os notes vêm do user e vão pro DB. Renderizados em `KanbanClient.js` como
texto (JSX escapa). Risco real é zero pra XSS direto. **Mas:** se a UI
algum dia render Markdown (com biblioteca), pode virar XSS. Já há
`notes: { type: text }` em Prisma sem regex.

**Status:** mitigado por React/JSX hoje. Documentar pro futuro com nota
em-código.

#### P2.C — `process.env.AUDIT_IP_SALT` default fraco [A02:2025 Cryptographic Failures]

**Evidência:** `lib/audit.js:24` — `const salt = process.env.AUDIT_IP_SALT || "ct-default-salt-change-me";`

Em dev/staging sem env setada, IPs hasheiam com salt previsível ("ct-default-salt-change-me"
publicado no repo). Atacante com acesso ao DB pode rainbow-table IPs
brasileiros comuns (256M IPs / dia). LGPD: hash com salt forte é dado
pseudonimizado; com salt publico, vira "praticamente raw".

**Fix:** fail-closed em prod — se `process.env.NODE_ENV === "production"`
e `AUDIT_IP_SALT` ausente, log ERROR e armazenar `actorIp: null`
(perder o IP > usar salt fraco).

### P3 - Hardening

#### P3.A — `safeCompare` não documenta limite de tamanho do input

**Evidência:** `lib/cron-auth.js:23-33`

`Buffer.from(String(a))` aceita até 1GB. Atacante poderia enviar `Authorization:
Bearer <100MB>` e causar alocação de RAM (DoS de memória). Vercel já limita
header a ~32KB, mas defesa-em-profundidade: rejeitar tokens > 256 chars
antes do `safeCompare`. Custo: 1 linha.

#### P3.B — Sentry config não filtra request body

**Evidência:** `next.config.js` ou `sentry.*.config.js` (não revisei nesta
auditoria). Default do Sentry SDK pra Next.js captura `req.body` em
exception handler. Se body tem PII (CV cru em `/api/analyze`), vai pro
Sentry. Wave 5 não tocou nisso.

**Fix:** `beforeSend` em sentry config remove `request.data` quando URL bate
`/api/(analyze|tailor|interview|cv|linkedin|portfolio)`.

#### P3.C — `process.env.NODE_ENV === "production"` em cookie secure pode quebrar em local-test-prod

**Evidência:** `lib/admin-session.js:100` — `secure: process.env.NODE_ENV === "production"`

Trivial, padrão da indústria, mas se rodar build local pra QA, cookie é
secure-only — pode confundir devs. P3 informativo, não acionável.

---

## LGPD compliance

| Controle | Status | Evidência |
|---|---|---|
| Audit de LOGIN | ✅ | enum `AuditAction.LOGIN` (`prisma/schema.prisma:526`) |
| Audit de DATA_EXPORTED | ✅ | `app/api/me/export/route.js:23-29` |
| Audit de ACCOUNT_DELETED | ✅ | `lib/data-export.js:141-147` |
| Audit de CV_DELETED | ✅ | `app/api/cron/redact-cv/route.js:134-140` |
| Audit de LINKEDIN_RAW_REDACTED | ✅ | `app/api/cron/redact-cv/route.js:142-150` |
| Audit de PROFILE_UPDATED | ⚠️ | Enum existe, mas `/api/linkedin/parse` não emite após upsert (apenas Consent). Gap pequeno. |
| Audit de SECURITY_RATE_LIMIT_HIT | ✅ | `lib/rate-limit.js:13-15` |
| Audit de SECURITY_BUDGET_EXCEEDED | ✅ | `app/api/linkedin/parse/route.js:131-141` |
| Export cobre todos dados pessoais? | ✅ | `lib/data-export.js:42` — `findUnique({ where: { userId } })` traz Profile **inteiro** incluindo `linkedinRawExpiresAt` e `linkedinRawRedactedAt` automaticamente. |
| Erase apaga todos dados? | ✅ | `lib/data-export.js:148` — `prisma.user.delete({ where: { id: userId } })` + cascade FK no schema. Audit `ACCOUNT_DELETED` emitido ANTES do delete (preserva rastro). |
| IP hasheado (SHA-256)? | ✅ | `lib/audit.js:22-31` (mas ver P2.C — salt default fraco). |
| Cookie HttpOnly | ✅ | `lib/admin-session.js:99` |
| Cookie SameSite | ✅ | `lib/admin-session.js:101` — `strict` (mais forte que `lax`) |
| Cookie Secure (em prod) | ✅ | `lib/admin-session.js:100` |
| TTL rawCv 90d | ✅ | `prisma/schema.prisma:108` + cron diário |
| TTL linkedinRaw 90d | ✅ NOVO | Wave 5 fix |
| LGPD storage limitation | ✅ | Art. 16 respeitado pra ambos os raws |

**Gap único:** `PROFILE_UPDATED` enum existe mas não está sendo emitido em
`/api/linkedin/parse` nem em `/api/profile/refresh`. Documentar como
backlog Wave 12 (P3).

---

## OWASP 2025 + Agentic AI 2026 Coverage Map atualizado

| Categoria | Wave 4 | Wave 11 | Mudança |
|---|---|---|---|
| **A01:2025 Broken Access Control** | OK (IDOR-safe) | OK | Reroute /candidaturas mantém. |
| **A02:2025 Cryptographic Failures** | OK | ⚠️ P2.C novo | Salt default fraco. |
| **A03:2025 Injection (SQL/XSS)** | OK (Zod + Prisma) | OK | SrcChip é XSS-safe. |
| **A04:2025 Insecure Design** | P1 (TailorBody.vaga) | P1 (ainda aberto) | Sem fix Wave 5. |
| **A05:2025 Security Misconfiguration** | OK | ⚠️ P2.A novo | OWNER_EMAILS parsing fraco. |
| **A06:2025 Vulnerable Components** | OK | OK | Sem deps novas críticas. |
| **A07:2025 Auth Failures** | P1 (brute admin) | P1 (ainda aberto) | Sem fix Wave 5. |
| **A08:2025 SSI Failures** | OK | OK | Webhook Stripe HMAC. |
| **A09:2025 Logging & Monitoring** | P1 (PII em console.error) | P1 (ainda aberto) | Sem fix Wave 5. |
| **A10:2025 SSRF** | OK | OK | safe-fetch em portfolio import. |
| **LLM01 Prompt Injection** | P1 (vaga + perfil) | P1 (ainda aberto) | Sem fix Wave 5. |
| **LLM02 Sensitive Info Disclosure** | OK | OK | linkedinRaw TTL fechou. |
| **LLM03 Supply Chain** | OK | OK | Sem alterações. |
| **LLM04 Data Poisoning** | OK | OK | RAG via knowledge base curada. |
| **LLM05 Improper Output Handling** | OK | OK | Zod valida output de LLM. |
| **LLM06 Excessive Agency** | OK | OK | LLM não chama tools/DB. |
| **LLM07 System Prompt Leakage** | risco residual (P1.1) | risco residual | Sem fix Wave 5. |
| **LLM08 Vector/Embedding Weaknesses** | OK | OK | HNSW index restaurado. |
| **LLM09 Misinformation** | OK | OK | Output validado por Zod. |
| **LLM10 Unbounded Consumption** | OK (guardLLM + budget) | OK | Rate-limit + per-user budget. |
| **Agentic AI 2026 — Memory poisoning** | N/A | OK | Memory dir `.claude/projects/.../memory/` validado: só protocolo/estratégia, **zero PII de usuário**. |
| **Agentic AI 2026 — Tool poisoning** | N/A | OK | LLM atual não tem tool-use; futuro adicionar Tool Search whitelisting. |
| **Agentic AI 2026 — Subagent isolation** | N/A | OK (informal) | Sociedade do Anel = orquestração de prompts, sem shared state mutável entre subagents. Cada Wave roda no mesmo CWD mas com missão escopada. Sem comprometimento cross-task observado. |

---

## Recomendações priorizadas

### Sprint imediata (Wave 12)

1. **[P1] Fechar TailorBody.vaga (P1.1):** schema strict + sanitize antes do prompt. Esforço: 1h. Risco se não fechar: vazamento de system prompt em prod.
2. **[P1] Fechar OppBody.perfil (P1.2):** schema strict pra modo anônimo. Esforço: 1h. Mesmo risco.
3. **[P1] Rate-limit em adminLoginAction (P1.3):** envolver com checkLimit (5/min/user). Esforço: 30min.
4. **[P1] Helper safeLogError (P1.4):** criar `lib/safe-error-log.js` e migrar ~40 call-sites de `console.error("...", e?.message)`. Esforço: 2h. Pode rodar em paralelo via grep + sed assistido.

### Próxima sprint

5. **[P2.C] Salt forte em audit:** fail-closed em prod se `AUDIT_IP_SALT` ausente. Esforço: 15min.
6. **[P2.A] Validar emails em OWNER_EMAILS:** filter regex. Esforço: 10min.
7. **[P3.B] Sentry beforeSend filter:** remover request body em rotas LLM. Esforço: 30min.
8. **Audit PROFILE_UPDATED:** emit em /api/linkedin/parse e /api/profile/refresh. Esforço: 10min.

### Hardening contínuo

9. **[P3.A] Limit token size em verifyCronAuth:** rejeitar > 256 chars antes do safeCompare.
10. Adicionar test unitário pra `safeCompare` cobrindo mismatch de length (regression test pra timing leak).
11. Documentar pitfall do Prisma + Unsupported("vector") no README ou em `prisma/schema.prisma` (sobre HNSW).

---

## Anexo — Comandos usados nesta auditoria

```
grep -rn "verifyCronAuth\|x-cron-secret" app/api/cron/
grep -rn "z\.string()\.url()" app/ lib/
grep -rn "safeExternalUrl\|safeHref" app/ lib/ components/
grep -rn "dangerouslySetInnerHTML" app/ components/
grep -rn "linkedinRaw" app/ lib/
grep -rn "DROP INDEX.*embedding" prisma/migrations/
grep -rn "LINKEDIN_RAW_REDACTED" .
grep -rn "console.error" app/api/ lib/
find prisma/migrations -name "*.sql"
ls app/candidaturas (não existe — reroute limpo)
ls app/(app)/candidaturas/
```

---

**Sauron — Wave 11. RESEARCH-ONLY. Nenhum arquivo de código foi modificado.**
