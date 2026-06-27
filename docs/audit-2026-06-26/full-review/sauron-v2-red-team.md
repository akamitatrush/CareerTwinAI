# Sauron v2 — Red Team OWASP re-audit (2026-06-26)

Audit adversarial RESEARCH-ONLY, branch `redesign/claude-design`.
Frameworks: **OWASP Top 10:2025** + **OWASP Top 10 for LLM Applications (2025)**
+ **Agentic AI Security (2026)** + **LGPD**.

Escopo: re-audit pós-redesign cobrindo as mudanças entre `40234d5` (audit
Sauron Wave 4, 2026-06-25) e `31f3c2d` (HEAD). Foco em: novas rotas em
`app/api/**`, novos providers de scraping (Gupy, Vagas.com, pciconcursos,
Adzuna/Jooble internships), novo email de welcome, novo admin gating
(`ADMIN_PASSWORD` + cookie HMAC), novo `text-diff`, novo `llm-cache`,
novo `cron-auth`, novos crons LGPD (TTL linkedinRaw 90d), novos
`AffiliateConfig` + `decorateUrl`.

Reference cruzada: `docs/security/red-team-audit-2026-06-25.md` (Wave 4) e
`docs/audit-2026-06-26/sauron-security-reaudit.md` (Wave 11 Sauron parcial
deste mesmo dia). Esta v2 é a versão **full-review** com cobertura
mais profunda do *delta* de código.

---

## TL;DR

- **P0 novos: 0**
- **P1 novos: 0** (mas os 4 P1 da Wave 4 continuam abertos)
- **P2 novos: 5** (P2.A..P2.E)
- **P3 novos: 6** (P3.A..P3.F)
- **Confirmações de fixes Wave 5 ainda válidos: 4** (cron-auth helper, linkedinRaw TTL, courses/click `safeExternalUrl`, HNSW index)
- **Itens já corrigidos pelos próprios fixes desta v2 verificados:** 4
- **Itens Wave 4 ainda abertos:** 4 (P1.1, P1.2, P1.3, P1.4)

**Veredito v2:** o produto continua sólido no perímetro (auth + IDOR-by-default
+ Stripe HMAC + cron HMAC + safe-fetch + magic bytes). O **delta** introduziu
muitas surfaces novas (5 novos providers de scraping, 6 novas rotas, 2 novos
crons, novo cookie HMAC, novo email transactional) e **nenhuma regressão
crítica nelas**. Os P1 antigos continuam sendo o débito real — não bloqueiam
go-live mas precisam fechar antes de growth significativo (volume de tráfego
amplifica o blast-radius de prompt injection no `vaga`/`perfil`).

---

## Findings novos (pós 2026-06-25)

### [P2] P2.A — `/api/courses/click` aceita `provider` arbitrário e indexa map por string user-controlled (prototype pollution adjacente)

- **Arquivo:** `app/api/courses/click/route.js:37-41` (schema) + `lib/knowledge/affiliate-config.js:68-75` (lookup)
- **Categoria OWASP:** A03:2025 Injection / A04:2025 Insecure Design
- **Evidência:** `ClickSchema` declara `provider: z.string().min(1).max(120)`
  sem allowlist. Em `getAffiliateConfig(providerName)` (linha 70),
  `AFFILIATE_PROVIDERS[providerName]` é index direto por string user-controlled.
  Para `providerName = "__proto__"` ou `"constructor"`, o lookup devolve
  `Object.prototype` ou `Function`, ambos *truthy*. Cai no `if (!cfg) return null`
  só por sorte (porque `Object.prototype.env` é `undefined` → `process.env[undefined]`
  é `undefined` → `if (!id) return null` final salva). Sem essa cadeia de
  acidentes, seria leak de env arbitrária via `provider` qualificado.
- **Impacto:** hoje, **zero exploit prático** (defesa em camadas pela conferência
  `if (!id) return null`). Risco residual: qualquer refactor que troque
  `process.env[cfg.env]` por outra coisa sem essa conferência abre exfil
  de env vars (o `Object.prototype` poderia retornar `Object.toString`).
  Também: se um dia adicionarem prototype keys como `provider: "isPrototypeOf"`,
  o resultado é determinístico e errado.
- **Mitigação sugerida:** allowlist o `provider` no Zod:
  `provider: z.enum(Object.keys(AFFILIATE_PROVIDERS))` ou trocar
  `AFFILIATE_PROVIDERS[providerName]` por `Object.prototype.hasOwnProperty.call(AFFILIATE_PROVIDERS, providerName) ? AFFILIATE_PROVIDERS[providerName] : null`.
  Ideal: usar `Map`/`Object.create(null)` para o catálogo.

### [P2] P2.B — `email/send-welcome.js` falha-aberto sem `EMAIL_FROM` validado, e `dashboardUrl()` confia em `AUTH_URL`

- **Arquivo:** `lib/email/send-welcome.js:23-26` + `30-51`
- **Categoria OWASP:** A05:2025 Security Misconfiguration / A04 Insecure Design
- **Evidência:** `dashboardUrl()` faz `process.env.AUTH_URL || "http://localhost:3000"`
  sem validar que `AUTH_URL` é URL `https://`. Em prod sem `AUTH_URL` setada,
  o welcome email leva o user pra `http://localhost:3000/dashboard` (UX broken;
  defeso até pra entregar, mas se um proxy reescrever pro path interno...).
  Pior: se `AUTH_URL` for misconfigured pra `https://evilco.com`, o link de
  welcome leva pra phishing externo (engenharia social via email assinado
  pelo seu domínio). Em `sendViaResend` (linha 30), o `EMAIL_FROM` da env
  vai direto pro `from:` sem validar formato — Resend rejeita, mas atacante
  com env-write capability pode fazer phishing assinado pelo seu domínio.
- **Impacto:** dependência crítica em correção operacional do env. Já
  documentado como P3.8 na Wave 4. Subiu pra P2 porque agora o welcome
  é fire-and-forget logo após login (linha 40 do welcome-sent route),
  então URL ruim atinge **100% dos novos signups** e não dá retry/correção.
- **Mitigação sugerida:** fail-closed em prod: se `process.env.NODE_ENV === "production"`
  e `AUTH_URL` ausente ou não-https, log ERROR + retorno `{ ok: false, skipped: "no-auth-url" }`
  e **NÃO chama Resend**. Validar `EMAIL_FROM` com Zod email parser antes do envio.

### [P2] P2.C — `/api/concursos` e `/api/estagios`: scraping externo sem `safe-fetch` (IP pinning ausente)

- **Arquivo:** `lib/concursos/index.js:77-93` (`timedFetch`) + `lib/jobs/providers/gupy.js:128-143` + `lib/jobs/providers/vagas-com.js:105-120` + `lib/estagios/index.js:54-69`
- **Categoria OWASP:** A10:2025 SSRF (defense-in-depth)
- **Evidência:** Todos os 4 providers novos fazem `fetch(url, ...)` direto,
  sem `safeFetchExternal` (`lib/safe-fetch.js`) que faz IP-pinning anti
  DNS-rebinding. Os hostnames são "controlados" (constantes:
  `https://www.pciconcursos.com.br`, `https://${subdomain}.gupy.io`,
  `https://api.adzuna.com`, `https://jooble.org`) — **mas**:
  - Em Gupy (linha 263-270), o `subdomain` é parseado de `GUPY_BOARDS`
    env. A regex `^[a-z0-9._-]{1,80}$/i` aceita `.` em qualquer posição,
    o que tecnicamente permite `evil.attacker.com.subdomain` se alguém
    setar env malicioso (insider threat, env injection via supply chain).
  - Em concursos (`lib/concursos/index.js:107`), o robots.txt é puxado de
    `${u.protocol}//${hostname}/robots.txt` onde `hostname` vem de `new URL(targetUrl)`
    do call interno controlado — **mas** se algum dia uma feature passar
    URL user-controlled pra `isAllowedByRobots`, vira SSRF aberto.
- **Impacto:** **zero exploit hoje** com env limpo. Risco real é defesa em
  camadas — qualquer regressão futura introduz SSRF imediato. Já reportado
  como P2.5 na Wave 4 para Gupy/Vagas; agora aplicado também aos novos
  providers de concursos/estágios.
- **Mitigação sugerida:** trocar `fetch(url, ...)` por `safeFetchExternal(url, ...)`
  em `lib/concursos/index.js:77`, `lib/jobs/providers/gupy.js:128`,
  `lib/jobs/providers/vagas-com.js:105`, e `lib/estagios/index.js:54`.
  Custo: ~4 linhas de import + 4 calls trocados.

### [P2] P2.D — `/api/funnel` POST: validação relaxada permite update da SEMANA CORRENTE indefinidamente, sem cap mensal

- **Arquivo:** `app/api/funnel/route.js:65-205` + `prisma/migrations/...funnel.../migration.sql` (unique `(userId, weekStart)`)
- **Categoria OWASP:** A04:2025 Insecure Design / LLM10 Unbounded Consumption (custo de DB)
- **Evidência:** o rate-limit é `perMinuteUser: 30` (linha 82). O upsert
  no Prisma usa o unique `(userId, weekStart)` — então sempre é UM registro
  por semana. **Mas** cada call gera audit de Prisma `upsert` + 2 queries
  (1 lê `last4`, 1 upsert). Um user manipulado pode bater 30/min × 60 min × 24h
  = **43,200 upserts/dia** em um único registro. PostgreSQL aguenta, mas
  WAL bloat + autovacuum overhead é real (cada UPDATE escreve uma nova row
  + marca o anterior como dead tuple).
- **Impacto:** **DoS auto-infligido** (não impacta outros users; o write
  bloating é local ao registro de FunnelEntry desse user). Não é P1 porque
  user só prejudica a si mesmo. Mas com `perMinuteUser=30` por uma rota
  que tem semântica de "atualizo 1×/semana", o teto está **6 ordens de
  magnitude** acima do uso legítimo. Mesmo padrão de hardening que o time
  já aplicou em `/api/welcome-sent` (10/min) deveria descer aqui pra 5-10/min.
- **Mitigação sugerida:** baixar `perMinuteUser` pra 5 (10/sec × user é
  excesso pra um campo de relatório semanal). Comentário-alvo:
  `app/api/funnel/route.js:82`.

### [P2] P2.E — `verifyCronAuth`: aceita Bearer tokens sem cap de comprimento (alocação descontrolada)

- **Arquivo:** `lib/cron-auth.js:21-33` + `38-43`
- **Categoria OWASP:** A04:2025 Insecure Design / A05 Misconfiguration
- **Evidência:** `safeCompare(a, b)` (linha 23) faz `Buffer.from(String(a))`
  sem cap. `extractBearer` (linha 38) faz `headerVal.trim()` sem cap.
  Vercel limita headers a ~32KB, mas atacante pode mandar
  `Authorization: Bearer <30KB de "A"s>` → `Buffer.from` aloca 30KB. Multiplicar
  por 100 req/s = 3MB/s de alocação só pra responder 403 nos crons. Não é
  DoS prático em Vercel (cold-start + rate-limit), mas em ambiente self-hosted
  ou nginx fronting node direto, é vetor real.
- **Impacto:** memory pressure leve. Reportado também como P3.A na audit
  parcial deste mesmo dia. Aqui subido pra P2 porque a função é hit por
  TODOS os 6 crons (atacante pode bombardear qualquer um para acionar a
  alocação).
- **Mitigação sugerida:** prepend `if (a.length > 256 || b.length > 256) return false;`
  em `safeCompare`. CRON_SECRET legítimo tem 32-64 chars; 256 é folga
  generosa pra format variantes.

---

### [P3] P3.A — `OWNER_EMAILS` parse aceita emails malformados ou separadores não-vírgula

- **Arquivo:** `app/api/admin/usage/route.js:98-102`
- **Categoria OWASP:** A05:2025 Misconfiguration
- **Evidência:** mesmo bug do P2.A da audit parcial deste dia.
  `OWNER_EMAILS.split(",").map(trim).filter(Boolean)` aceita
  `"a@x.com; b@y.com"` como UM email `"a@x.com; b@y.com"`. Não causa
  bypass de auth (porque o include é só pra agregar dados de quem é
  owner em UI/admin/usage), mas degrada o relatório silenciosamente.
- **Mitigação sugerida:** após split, filtrar por regex
  `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Mesma sugestão da audit parcial — re-listada
  aqui pra confirmação de finding cruzado.

### [P3] P3.B — `lib/llm-cache.js`: SHA-256 truncado pra 32 hex chars (16 bytes = 128 bits) — colisão prática segura, mas comentário enganoso

- **Arquivo:** `lib/llm-cache.js:48-51`
- **Categoria OWASP:** A02:2025 Cryptographic Failures (informational)
- **Evidência:** `"llm:" + createHash("sha256").update(content).digest("hex").slice(0, 32)`.
  O comentário (linha 21-22) diz "col-resist pratico — 16 bytes = 2^128 search space".
  **128 bits de output ≠ 128 bits de col-resist**. Por birthday, col-resist
  efetiva é 2^64 (≈ 18 quintilhões). Pra cache de LLM, 2^64 é ainda
  irrealisticamente seguro (cache poisoning exigia o atacante gerar 18×10^18
  pares prompt distintos). Não é vuln, mas comentário induz a erro.
- **Mitigação sugerida:** atualizar comentário para "16 bytes = 2^128 output,
  ~2^64 col-resist por birthday — suficiente pra cache de LLM com TTL 1h".
  Documenta a matemática real e evita decisão errada futura (e.g., reduzir
  pra 16 chars achando que ainda é 2^64 — viraria 2^32, exploit prático).

### [P3] P3.C — `lib/email/welcome-template.js`: `safeHttpUrl` aceita URL com qualquer host (host injection latente)

- **Arquivo:** `lib/email/welcome-template.js:14-22`
- **Categoria OWASP:** A03 Injection (XSS/phishing) / A04 Insecure Design
- **Evidência:** `safeHttpUrl` valida só o **scheme** (http/https), não o **host**.
  Se `dashboardUrl` que vem em `buildWelcomeEmail({ dashboardUrl })` for
  `https://attacker.com/dashboard`, ele entra **escapado** no HTML do email
  (`escapeHtml(safeUrl)` linha 120), mas o `<a href>` aponta legitimamente
  pra `attacker.com`. Mitigado pelo caller `lib/email/send-welcome.js:23-26`
  que monta a URL a partir de `process.env.AUTH_URL`. Se AUTH_URL estiver
  errada (ver P2.B), o welcome email vira phishing **assinado pelo seu domínio**.
- **Impacto:** depende inteiramente da segurança do env. P3 porque mitigado
  na prática hoje.
- **Mitigação sugerida:** após `safeHttpUrl` no caller, validar
  `new URL(safeUrl).hostname === expectedHost` (lendo `expectedHost` de
  uma allowlist hardcoded ou de `NEXT_PUBLIC_APP_HOST`).

### [P3] P3.D — `lib/admin-session.js:103` comentário inconsistente (`Path=/admin`) vs código (`path: "/"`)

- **Arquivo:** `lib/admin-session.js:11-12` (comentário) + `103` (código)
- **Categoria OWASP:** A05 Misconfiguration / housekeeping
- **Evidência:** o header em :11-12 promete `Path=/admin (so envia em rotas admin, reduz superficie)`,
  mas o código :103 setta `path: "/"`. Comentário em :103 explica que `/` é
  necessário para cobrir `/api/admin/*`. Cookie é HttpOnly + Secure + SameSite=strict,
  então cobertura ampla `/` não cria vetor novo, mas a doc fica enganosa.
- **Mitigação sugerida:** atualizar comentário em :11-12 para refletir o
  `Path=/` real e o motivo (cobrir `/api/admin/*`).

### [P3] P3.E — `/api/concursos` retorna `cached: boolean` derivado de `cacheGet` lookup duplicado (corrida benigna)

- **Arquivo:** `app/api/concursos/route.js:66-75`
- **Categoria OWASP:** A04 Insecure Design (telemetry only)
- **Evidência:** o handler faz `cacheGet(cacheKey)` duas vezes — uma pra
  `cached` (telemetry) na linha 67-68 e implicitamente outra dentro de
  `fetchConcursos` (`lib/concursos/index.js:377`). Race: entre os dois
  reads, o cache pode expirar — `cached: true` na resposta mas
  `fetchConcursos` busca fresh. Mais grave: o cache key calculado no handler
  (`cacheKey` :66) e o key interno do `fetchConcursos` precisam BATER, e
  hoje têm padronização ligeiramente diferente (handler usa
  `(area || "all").toLowerCase()` e fetchConcursos usa `areaNorm || "all"`
  já normalizado). Pra alguns inputs (`area=null`), o key bate; pra outros
  (`area=""`), drift.
- **Impacto:** telemetria errada (não é vuln). Hoje irrelevante porque o
  pipeline trata cache miss como ok, mas degrada análise de hit-rate em
  observabilidade.
- **Mitigação sugerida:** expor uma fn `buildConcursosCacheKey(opts)` em
  `lib/concursos/index.js` e usar nos dois lugares pra garantir igualdade.

### [P3] P3.F — `lib/estagios/index.js`: `fixturesAsEstagios` retorna URL self-ref `https://career-twin-ai.vercel.app/estagios` (open redirect ao próprio dashboard)

- **Arquivo:** `lib/estagios/index.js:429`
- **Categoria OWASP:** A04 Insecure Design / informational
- **Evidência:** fixtures (usados em dev sem chaves de Adzuna/Jooble)
  apontam pra rota do próprio app. Em prod sem `ADZUNA_APP_ID` setado,
  todos os "estágios" mostrados são fixtures com URL self-ref — UX bug
  mais que segurança, mas levanta sinal de "marketplace bait" se fixtures
  vazarem em prod por config drift.
- **Impacto:** zero pra segurança; UX degradada.
- **Mitigação sugerida:** em prod sem ADZUNA configurado, retornar lista
  vazia em vez de fixtures (forçar config correta); ou trocar URL pra
  `null` quando `source === "fixtures"` e o UI esconde o CTA.

---

## Itens reauditados (status check)

### Status dos 4 P1 da Wave 4 (Sauron)

| Finding antigo | Status | Evidência |
|---|---|---|
| P1.1 (`TailorBody.vaga` passthrough → prompt injection) | ❌ ainda aberto | `lib/validators.js:192-204` mantém `vaga: z.object({}).passthrough()`. `lib/prompts.js` (`promptTailor`) ainda usa `JSON.stringify(vaga)` no user content. Zero mitigação. |
| P1.2 (`OppBody.perfil` z.any → prompt injection anônimo) | ❌ ainda aberto | `lib/validators.js:96` mantém `perfil: z.any().optional()`. `app/api/opportunities/route.js:129` ainda faz `perfil = snapshot?.perfilJson || perfilIn` direto pro `promptOpp`. |
| P1.3 (admin BF sem rate-limit) | ❌ ainda aberto | `app/admin/page.js:61-78` sem `guardLLM`. Comentário em `lib/admin-session.js:18` reconhece "Rate-limit deve ser aplicado no caller" — não aplicado. |
| P1.4 (PII em `console.error`) | ❌ ainda aberto | `grep -rc "console.error" app/api/` = **85 hits** com `e?.message`. Sample: `app/api/opportunities/route.js:149,268,284,320,371`; `app/api/linkedin/parse/route.js:101,114,144,197`; `app/api/funnel/route.js:184`. |

### Status dos 4 P0 Wave 5 (Galadriel Blue Team fixes)

| Fix Wave 5 | Status | Evidência |
|---|---|---|
| Cron auth Bearer + x-cron-secret + timingSafeEqual | ✅ corrigido | `lib/cron-auth.js:60-78`; usado em 6 crons. Confirma audit parcial. |
| linkedinRaw TTL 90d + cron redact | ✅ corrigido | `prisma/migrations/20260629200000_add_linkedin_raw_ttl/`; `app/api/cron/redact-cv/route.js:55-71` (OR no nível raiz); `app/api/linkedin/parse/route.js:166-169`. |
| `/api/courses/click` XSS `javascript:` | ✅ corrigido | `app/api/courses/click/route.js:39` usa `safeExternalUrl` (de `lib/validators.js:9-23`). Apenas `http:`/`https:` aceitos. |
| HNSW index restaurado | ✅ corrigido | `prisma/migrations/20260629100000_restore_knowledge_embedding_idx/`. Nenhuma migration posterior dropa o índice. |

### Status dos itens "menores" Wave 4 (P2.x) que mudaram

| Finding antigo | Status | Evidência |
|---|---|---|
| P2.5 (Gupy/Vagas sem safe-fetch) | ❌ ainda aberto | `lib/jobs/providers/gupy.js:128` e `vagas-com.js:105` continuam usando `fetch` direto. Subido pra P2.C nesta v2 com pciconcursos + estagios juntos. |
| P2.6 (courses/click `z.string().url()` → javascript:) | ✅ corrigido | já confirmado acima. |
| P2.7 (cron header Bearer vs x-cron-secret) | ✅ corrigido | já confirmado acima. |
| P2.9 (`history` assistant-spoofed em /chat) | ⚠️ parcial | `streamLLM` ignora history não-system em prática hoje, mas defense-in-depth ausente (não há filter explícito em `lib/llm-stream.js`). Continua P3 oportunidade. |

### Áreas re-validadas e sem novos riscos

| Área | Veredito | Evidência |
|---|---|---|
| `/api/funnel` POST/GET | ✅ | `app/api/funnel/route.js:65-205`. Zod strict + refines de hierarquia (callbacks≤applications etc); upsert atomico no unique; `weekStart` server-side. P2.D acima é apenas dimensionamento de rate-limit, não vuln. |
| `/api/concursos` | ✅ | `app/api/concursos/route.js:28-78`. Inputs sanitizados, robots.txt check, rate-limit 1/s por host. Score: P2.C (defense-in-depth) e P3.E (telemetry). |
| `/api/estagios` | ✅ | `app/api/estagios/route.js:30-91`. Auth obrigatória, allowlist de área, providers com timeout 8s. |
| `/api/auth/welcome-sent` | ✅ | `app/api/auth/welcome-sent/route.js:22-45`. Auth obrigatória, rate-limit 10/min, fire-and-forget, idempotente via `welcomeEmailSentAt`. |
| `/api/admin/usage` | ✅ | `app/api/admin/usage/route.js:25-145`. 3 camadas (auth + isAdminEmail + isAdminAuthenticated). |
| `/api/cron/redact-cv` | ✅ | `app/api/cron/redact-cv/route.js:34-165`. Usa `verifyCronAuth`. Update separa raw por TTL próprio. Audit `LINKEDIN_RAW_REDACTED` emit. |
| `lib/admin-session.js` | ✅ | `verifyAdminToken` timing-safe (linha 82-87). `verifyAdminPassword` timing-safe com pad (42-54). Cookie HttpOnly + Secure (em prod) + SameSite=strict. |
| `lib/cron-auth.js` | ✅ | `verifyCronAuth` aceita Bearer + x-cron-secret, ambos rodados sempre (no early-return) pra não vazar via timing qual header. P2.E cap de length é hardening. |
| `lib/text-diff.js` | ✅ | LCS puro JS, sem regex catastrófico, sem deserialize externo. Inputs são CV strings já validadas. Não há render via `dangerouslySetInnerHTML` no consumer (`CvDiffView` renderiza linhas como JSX text — React escapa). |
| `lib/llm-cache.js` | ✅ | SHA-256 key truncado, valor só vem do próprio LLM (sem ingestão user), TTL 1h. `cacheSet` falha em erro silenciosamente — degradação graceful. |
| `lib/email/welcome-template.js` | ✅ | `escapeHtml` em nome + URL. P3.C é hardening de host validation. |
| Middleware CSP + protected paths | ✅ | `middleware.js:38-48` mantém CSP (unsafe-inline já documentado P2.1 Wave 4). `lib/auth-protected-paths.js` lista nova `/candidaturas`/`/concursos`/`/estagios`/`/funil` (verificado nas paginas correspondentes). |
| `dangerouslySetInnerHTML` audit cruzada | ✅ | 8 hits em `app/` (verificados via `grep`): TODOS são CSS hardcoded estático ou tema localStorage (`app/layout.js:28`). Nenhum recebe user input. SrcChip (`components/SrcChip.js`) **NÃO** usa `dangerouslySetInnerHTML` — renderiza texto via JSX children. |
| Welcome email `from` | ⚠️ ver P2.B | `EMAIL_FROM` da env vai direto pro `from:` sem validação. Mitigado pela autenticação no Resend, mas P2 se env-write capability for comprometida. |

---

## Áreas onde olhei e não achei nada

- **`/api/cron/digest`, `/api/cron/daily-briefing`, `/api/cron/redact-billing`,
  `/api/cron/usage-cleanup`, `/api/cron/outcome-survey`** — todos usam
  `verifyCronAuth` (Wave 5 fix). Sem reads user-controlled. PII evitada
  em `audit({ meta })`.
- **`prisma/schema.prisma`** — diff só adicionou `FunnelEntry`, `welcomeEmailSentAt`,
  `linkedinRawExpiresAt/RedactedAt`. Sem novos campos de PII sem TTL.
  Unique compound `(userId, weekStart)` em FunnelEntry está correto.
- **`lib/safe-fetch.js`** — não mudou; continua aplicando IP-pinning no
  `portfolio/import`. Continua exemplar.
- **`app/(app)/cvs-adaptados/[id]/page.js`** — IDOR-safe (`findUnique` + check
  `cv.userId !== session.user.id`). `dangerouslySetInnerHTML` na linha 67
  é CSS hardcoded.
- **`app/(app)/funil/FunnelForm.js`** + **`KanbanClient.js`** — renderizam
  `notes` (do user) como JSX text (React escapa). `safeHref` aplicado em
  links externos no Kanban.
- **`lib/jobs/providers/fixtures.js`** e dedup providers — sem mudança crítica.
- **`/api/_track`** — allowlist `SERVER_SIDE_EVENTS` (linha 91) bloqueia evento
  não-mapeado. Hash de IP pra correlação anon (sem leak).
- **`lib/billing/enforce.js`** — `enforceUsage` atomico em Serializable
  transaction. P2.10 da Wave 4 (starvation auto-DoS) ainda existe mas
  irrelevante pra segurança (só impacta o próprio atacante).
- **CVE Next 14 / nodemailer** — documentados em
  `docs/security/audit-exceptions-2026-06-26.md`. Os 14 CVEs Next 14.2.35
  têm mitigantes operacionais documentados (Vercel-hosted, App Router exclusivo,
  WAF ativo, CSP nonces não em uso). Decisão de aceitar até sprint de
  upgrade pra Next 16 é defensável — re-confirmo o trade-off.

---

## OWASP 2025 + LLM Top 10 + Agentic AI 2026 — Coverage Map atualizado

| Categoria | Wave 4 | Wave 11 (v2) | Mudança |
|---|---|---|---|
| **A01:2025 Broken Access Control** | OK (IDOR-safe) | OK | Reroute `/candidaturas`, novas rotas funnel/concursos/estagios todas com `where: { userId: session.user.id }`. |
| **A02:2025 Cryptographic Failures** | OK | ⚠️ P3.B comentário | HMAC-SHA256 + timingSafeEqual em todos novos paths (admin cookie, cron-auth). Cache LLM SHA-256 truncado OK mas doc mente. |
| **A03:2025 Injection** | OK | ⚠️ P2.A | Prisma parametrizado, Zod strict em todas novas rotas. Excecao: `provider` em courses/click sem allowlist (lookup direto). |
| **A04:2025 Insecure Design** | P1 ainda aberto + P2.x | P1 ainda aberto + novos P2.B/P2.D/P2.E | Welcome URL fallback, funnel rate-limit hi, cron-auth sem cap. |
| **A05:2025 Security Misconfiguration** | OK (P2.1 documentado) | ⚠️ + P3.A, P3.D | OWNER_EMAILS parse fraco; admin cookie path doc inconsistente. |
| **A06:2025 Vulnerable Components** | OK | ⚠️ exceções documentadas | Next 14 + nodemailer com CVEs aceitos via `docs/security/audit-exceptions-2026-06-26.md`. |
| **A07:2025 Auth Failures** | P1 (brute admin) ainda aberto | P1 (brute admin) ainda aberto | Sem fix; mas duas camadas (Auth.js sessão + ADMIN_PASSWORD + cookie HMAC) reduzem janela. |
| **A08:2025 SSI Failures** | OK | OK | Stripe HMAC; sem deserialize unsafe. |
| **A09:2025 Logging & Monitoring** | P1 (PII console.error) ainda aberto | P1 (PII console.error) ainda aberto | 85 hits de `console.error("...", e?.message)` em `app/api/`. |
| **A10:2025 SSRF** | OK (safe-fetch portfolio) | ⚠️ P2.C ampliado | Novos providers concursos/estagios/Gupy/Vagas sem safe-fetch (defense-in-depth). |
| **LLM01 Prompt Injection** | P1 (vaga + perfil) ainda aberto | P1 ainda aberto | Sem fix Wave 5. |
| **LLM02 Sensitive Info Disclosure** | parcial | ✅ melhor | linkedinRaw TTL fechou Art. 16 gap. P1.4 PII em logs continua. |
| **LLM03 Supply Chain** | OK | OK | Sem MCP/agentes novos. |
| **LLM04 Data & Model Poisoning** | OK | OK | Knowledge ingest manual; novos providers de jobs/concursos parseiam HTML público (lib/concursos `parsePciHtml` regex-based, sem eval). |
| **LLM05 Improper Output Handling** | OK | OK | DiagShape/OppShape/LinkedinShape/PortfolioShape continuam validando saída LLM com Zod strict. |
| **LLM06 Excessive Agency** | OK | OK | LLM sem tool-calling. |
| **LLM07 System Prompt Leakage** | risco residual | risco residual | P1.1/P1.2 sem fix. |
| **LLM08 Vector & Embedding Weaknesses** | OK | OK | HNSW restaurado; query server-side sem user input direto. |
| **LLM09 Misinformation** | OK | OK | Shape validation + fonte `[Currículo]/[Mercado]` mandatória nos prompts. |
| **LLM10 Unbounded Consumption** | OK | ⚠️ P2.D | `enforceUsage` + `checkDailyBudget` cobrem LLM. Novo `/api/funnel` 30/min/user é hi pra rota não-LLM. |
| **Agentic AI 2026 — Memory poisoning** | N/A | OK | LLM cache key inclui modelo + system + user; sem cross-user leak (key SHA-256 do contexto inteiro). |
| **Agentic AI 2026 — Tool poisoning** | N/A | OK | Sem tool-use. |
| **Agentic AI 2026 — Cascade failures** | parcial | OK | Promise.allSettled em providers internships; falha um → outros continuam. Robots.txt check fail-closed em pciconcursos. |

---

## Recomendações priorizadas

### Imediato (mesma sprint)

1. **Fechar os 4 P1 herdados da Wave 4.** Sem nenhum deles fechado, o produto
   é exploitable hoje (prompt injection + admin BF + PII em logs). Esforço
   estimado: 4h totais via fixes pontuais (`lib/validators.js` strict, helper
   `lib/safe-error-log.js`, `guardLLM` no `adminLoginAction`).

### Próxima sprint

2. **P2.B fail-closed em `AUTH_URL` ausente em prod.** 15min.
3. **P2.A allowlist em `provider` no `/api/courses/click`.** 10min.
4. **P2.C `safeFetchExternal` em concursos/estagios/Gupy/Vagas providers.** 30min.
5. **P2.E cap de length em `safeCompare` de `cron-auth.js`.** 5min.
6. **P2.D baixar `perMinuteUser` de funnel POST pra 5.** 1min.

### Hardening contínuo

7. **P3.A regex de email em `OWNER_EMAILS` parse.** Idem audit parcial.
8. **P3.B atualizar comentário cripto em `llm-cache.js`.**
9. **P3.C `expectedHost` allowlist em welcome email URL.**
10. **P3.D doc consistente no admin cookie path.**
11. **Migrar pra Next 16 + nonce CSP** quando sprint dedicada acontecer
    (fecha 14 CVEs aceitos + permite remover `'unsafe-inline'` script-src).

---

## Anexo — comandos usados

```
grep -n "verifyCronAuth\|x-cron-secret" app/api/cron/
grep -n "dangerouslySetInnerHTML" app/ components/
grep -rn "linkedinRaw\|linkedinJson" app/api/
grep -rn "process.env.AUTH_URL" app/ lib/
grep -rn "safeFetchExternal\|safe-fetch" lib/jobs/ lib/concursos/ lib/estagios/
grep -rn "console.error" app/api/  # 85 hits
grep -rn "z\.string()\.url()" app/ lib/
git diff --stat 40234d5..HEAD -- 'app/api/' 'lib/' 'middleware.js' 'prisma/'
ls docs/security/ docs/audit-2026-06-26/
```

---

**Sauron v2 — Eye of the Tower. Wave 11 full-review. RESEARCH-ONLY.
Nenhum arquivo de código foi modificado nesta auditoria.**
