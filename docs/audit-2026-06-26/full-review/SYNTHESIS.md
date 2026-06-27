# Síntese Executiva — Audit Army (2026-06-26)

Auditoria completa do CareerTwin AI pós-redesign Sociedade do Anel + Wave 10 em prod. 12 especialistas em 3 waves paralelas, research-only.

| Onda | Especialistas | Foco |
|---|---|---|
| A — Fundação | Sauron, Galadriel, Saruman, Treebeard | Segurança + arquitetura + dados |
| B — Qualidade | Boromir, Gimli, Gandalf, Faramir | Código + perf + testes + intake |
| C — UX/Polish | Arwen, Tom Bombadil, Frodo, Sam | Visual + a11y + journey + copy |

**3.836 linhas de análise, 13 reports em `docs/audit-2026-06-26/full-review/`.**

---

## TL;DR — Severidade consolidada

| Severidade | Total | Quem reportou |
|---|---|---|
| 🚨 **P0 — bloqueia prod** | **4 confirmados** | Treebeard, Faramir (×2), Frodo |
| ⚠️ **P1 — urgente sprint** | **~30** | Sauron (4 Wave 4 abertos), Galadriel (4), Saruman (4 High), Tom Bombadil (~20 AA), Treebeard (2) |
| 🟡 **P2 — backlog 2 sprints** | **~40** | distribuído |
| 🟢 **P3 — nice-to-have** | **~30** | distribuído |

---

## 🚨 P0 — fix antes do próximo deploy

### P0.1 — `model FunnelEntry` NÃO EXISTE no schema, mas 4 callsites chamam
- **Quem achou:** Treebeard v2
- **Evidência:** `prisma/schema.prisma` tem 24 models, zero com nome Funnel\*. Zero migrations criando o table. Zero `funnelEntry` no Prisma client gerado (`node_modules/.prisma/client/index.d.ts`).
- **Callsites em prod:** `app/api/funnel/route.js:157` (upsert), `app/api/funnel/route.js:197,229` (findMany), `app/(app)/funil/page.js:40` (findMany)
- **Impacto:** `/funil` page e `POST /api/funnel` retornam **500 garantido em prod**. Acabamos de deployar Wave 10.
- **Fix sugerido:** ou (a) adicionar `model FunnelEntry` ao schema + migration, ou (b) feature-flag desabilitar /funil + remover do AppShell até decidir.

### P0.2 — `/api/cv/upload` sem `withApiGuard` → vaza HTML stack trace
- **Quem achou:** Faramir v2
- **Evidência:** `app/api/cv/upload/route.js:30-194` não chama `withApiGuard` (vs `app/api/linkedin/parse/route.js:20-21` que tem).
- **Impacto:** Quando Prisma `$transaction` falha, retorna HTML do Next ao invés de JSON. Frontend faz `JSON.parse(html)` → quebra. Informação sensível no stack trace pode vazar.
- **Fix sugerido:** Envelopar handler em `withApiGuard` igual `/linkedin/parse`.

### P0.3 — `/api/cv/upload` sem `guardLLM` → abuse vector
- **Quem achou:** Faramir v2
- **Evidência:** mesma rota, falta `guardLLM` que existe em `/linkedin/parse:20-21`.
- **Impacto:** Upload de PDF 5MB sem rate-limit + CPU-bound parse. Usuário malicioso pode espontar custo + saturar workers.
- **Fix sugerido:** Aplicar `guardLLM` (rate-limit + budget check) antes do parse.

### P0.4 — `<meta name="viewport">` AUSENTE em layout root → iOS Safari desktop-escalado
- **Quem achou:** Frodo v2
- **Evidência:** `app/layout.js:21-47` não declara viewport meta tag.
- **Impacto:** iOS Safari abre app desktop-escalado (texto minúsculo, scroll horizontal). Persona ICP é mobile-heavy BR.
- **Fix sugerido:** Adicionar `export const viewport = { width: 'device-width', initialScale: 1 }` ou meta tag direto.

---

## ⚠️ P1 — Sprint candidates

### Segurança (Sauron + Galadriel) — 8 itens
- **Wave 4 ainda abertos** (Sauron confirma):
  - `TailorBody.vaga.passthrough()` permite prompt injection (`app/api/cv/tailor/route.js`)
  - `OppBody.perfil = z.any()` mesmo problema (`app/api/opportunities/route.js`)
  - Admin password sem rate-limit / brute-force ativo
  - **PII em `console.error`** — 85 hits espalhados (LGPD risk)
- **Galadriel v4 novos:**
  - Sentry sem alert rules (webhook burst, BUDGET_EXCEEDED, rate-limit storm)
  - `CONSENT_GRANTED/REVOKED` enum existe mas zero callers (4 `consent.create` SEM audit log) — LGPD compliance gap
  - **8 rotas autenticadas sem rate-limit** (`cv/upload`, `me/export`, `billing/checkout`, `applications`, `evidence`, `tailored-cvs`, `notifications`, ...)
  - `/api/me/export` sem rate-limit → DoS via export loop

### Arquitetura (Saruman) — 4 High
- **Landing 100% "use client"** sem necessidade (6 componentes: SiteFeatures, SiteFaq, SiteHowItWorks, SiteTrustBar, SiteSocialProof, SitePricing — 1.000+ linhas viram bundle do client)
- `force-dynamic` global desliga cache do Next sem ganho real (middleware usa `'unsafe-inline'` admitindo que nonce CSP não funcionou)
- **`analyze` ⇄ `profile/refresh` mantêm 1.176 linhas duplicadas** (já reportado em Saruman v1, NÃO foi feito)
- 3 Redis clients separados (consolidar)

### Dados (Treebeard) — 2 P1
- `Gap` model sem índice em `(snapshotId, completedAt)` — hot path em `/api/gaps/[id]/complete:83`, `/api/history/actions:46`, `/plano:36` (full scan em escala)
- **`linkedinRawExpiresAt` sem backfill** na migration `20260629200000_add_linkedin_raw_ttl` — profiles legados com `linkedinRaw NOT NULL AND expiresAt IS NULL` ficam fora do cron pra sempre → **viola Art. 16 LGPD**

### Performance (Gimli) — 5 alavancas P0/P1
- `app/layout.js:38-43` — Google Fonts via `<link>` ao invés de `next/font` (3 famílias, 14 pesos)
- `force-dynamic` na raiz cascateia pra landing pública (deveria ser ISR)
- **`lib/jobs.js` providers em série** — causa direta do radar 20-40s percebido (registrado em memory `backlog_radar_perf`)
- `PostHogProvider` faz fetch session em todo mount
- 6 Site\* components `"use client"` só pra fade-up via IO — CSS @keyframes resolve sem JS

### Acessibilidade (Tom Bombadil) — 3 A-fails + ~20 AA
- A-fails P0:
  - SkillNode `<g>` SVG sem handler de teclado
  - `<li onClick>` em NotificationsBell (não é button)
  - Modal overlay click (parcialmente mitigado)
- AA-fails P1: target size < 24x24px em 7+ componentes, contraste insuficiente em bordas, `title=` tooltips (não acessível), `lang=` faltando em termos estrangeiros, focus obscurado por sticky header
- Páginas com mais issues: `/` (9 issues), `/entrar` (5), `/dashboard` (4)

### Mobile + Journey (Frodo) — quebras de fluxo
- **Bug magic-link:** `/auth/verify-request/page.js:128` aponta "modo experimentar (sem login)" pra `/` — mas `/` virou landing premium (Glorfindel rerouted)
- **Dashboard manda user logado pra landing premium:** `dashboard/page.js:269,273,316`, `app/error.js:39` usam `href="/"` que vira landing → confusão + duplo redirect
- 12 breakpoints distintos em 54 media queries (sem sistema)
- Mismatch CSS (≤720px) vs JS (≤880px) — zona morta 721-879px
- Sem service worker / push, sem streak (mas tem daily-quest + achievement)

---

## 🟡 P2 / P3 — Por área

### Code quality (Boromir)
- **Lint NUNCA rodou** (config ESLint interativo não finalizado; CI mascara com `continue-on-error: true` em `.github/workflows/ci.yml:48-50`)
- 3 arquivos dead: `lib/metrics/median-stub.js`, `lib/jobs/types.js`, `lib/llm-cache.js`
- 5 hotspots > 600 LOC (pior: `app/privacidade/page.js` com 1192 linhas)
- 14 console.log esquecidos (9 são debug no `app/api/profile/refresh/route.js` — risco PII em prod)
- 6 duplicações grandes (FALLBACK_EXPL + pickExplicacao 100% iguais em analyze/refresh)
- Apenas 1 TODO real

### Testing (Gandalf)
- **Cobertura medida: 63.09% statements / 54.60% branches** (1101 tests em 9.5s)
- **0% coverage em:** `middleware.js`, `lib/admin-access.js`, 4 crons LGPD (redact-cv, redact-billing, outcome-survey, usage-cleanup), `app/api/cv/upload`, `lib/docx.js`
- 5 server actions `"use server"` sem teste
- 0 axe-core (a11y E2E ausente)
- E2E só roda em PR com label `e2e` (gated)
- Coverage **não é gate** no CI (vitest sem thresholds)

### Visual consistency (Arwen)
- **~14 hex hardcoded críticos** (WelcomeModal carrega paleta inteira; SkillGraph quebra contraste em noir; gradient amarelo do `/funil` ignora tema)
- ~22 spacing fora da escala 8/16/24/32
- **4 sistemas de H1 convivendo** (`.ct-page-header-title` canônico vs `.ct-gaps-title` legado vs hero hardcoded vs `.ct-self-kind-title`)
- ~60 border-radius hardcoded em `globals.css` (escala `--radius-*` definida mas raramente consumida)
- 6 glass re-implementations inline (deveriam usar `.app-glass`)
- 15 stroke-widths distintos em 180 SVGs inline (sem `<Icon>` wrapper)

### Copy & tone (Sam)
- **3 ocorrências de "jornada"** (pior: `DashboardHighlightBanner.js:24-31`)
- 8 conceitos com 2+ variantes (gap/lacuna, vagas vs `/oportunidades`, match × aderência)
- Páginas `/estagios`, `/funil` e briefing diário por email **sem acentos** (degrada Brasil-first)
- 15+ endpoints clonam "Tente novamente em alguns segundos/instantes/minutos" sem padrão
- CTAs fracos: `SiteHero.js:428` "Ver como funciona", `WelcomeModal.js:242` "Mais tarde", `app/error.js:36` "Tentar de novo"

### Intake CV / LinkedIn (Faramir)
- Pipeline LGPD muito bem feito (`linkedinRawExpiresAt` próprio, `verifyCronAuth` constant-time, hash SHA256 pra dedup sem PII em claro, magic-bytes em 3 camadas)
- 4 P1 / 3 P2 / 5 UX gaps / 4 A11y gaps catalogados

---

## 🎯 Top 10 alavancas (priorizadas por impacto × custo)

| # | Alavanca | Impacto | Custo | Owner sugerido |
|---|---|---|---|---|
| 1 | **Corrigir P0.1 FunnelEntry** (model + migration OU disable feature) | 🟥 Bloqueia prod | Baixo (1 migration ou 1 flag) | Treebeard v3 |
| 2 | **Adicionar `withApiGuard` + `guardLLM` em `/api/cv/upload`** | 🟥 Bloqueia prod | Baixo (2 lines) | Faramir v3 |
| 3 | **Viewport meta tag** em `app/layout.js` | 🟥 Mobile UX quebrada | Trivial (1 line) | Frodo v3 |
| 4 | **Inicializar ESLint + remover `continue-on-error`** no CI | 🟧 Code quality systemic | Médio (config + first fix wave) | Boromir v3 |
| 5 | **Server-renderizar 6 Site\* components** (matar "use client" desnecessário) | 🟧 Bundle landing -40% | Médio (refactor 1.000 linhas) | Gimli v3 |
| 6 | **Consolidar `analyze` ⇄ `profile/refresh`** em `lib/analysis/runDiagnosis.js` | 🟧 Manutenibilidade massiva | Alto (refactor 1.176 linhas) | Saruman v3 |
| 7 | **Backfill `linkedinRawExpiresAt`** + adicionar Sentry alert rules + audit log em CONSENT | 🟧 LGPD compliance | Médio (1 migration + 1 hook) | Galadriel v5 |
| 8 | **Unificar H1 em 1 sistema** + adotar escala `--radius-*` + criar `<Icon>` wrapper | 🟧 Design system coerente | Médio (refactor sistemático) | Arwen v3 |
| 9 | **Cobertura crítica:** middleware + 4 crons LGPD + cv/upload + admin-access | 🟧 Confidence em deploy | Alto | Gandalf v3 |
| 10 | **Rate-limit em 8 rotas autenticadas** + glossário canônico de termos + 3 categorias de erro | 🟨 Hardening + UX | Médio | Galadriel + Sam |

---

## 📊 Confirmações positivas (o que funciona bem)

- Pipeline LGPD do CV/LinkedIn (`linkedinRawExpiresAt`, `verifyCronAuth` constant-time, dedup hash, magic-bytes em 3 camadas) — **referência da casa**
- HNSW index RAG restaurado e operator `<=>` correto em `retrieval.js:115`
- 19 rotas com `guardLLM`, 43 com `auth()`, 55 queries com `where: { userId }`, 112 chamadas `audit()`
- Anti-XSS em `courses/click` (Wave 5 P0 fix confirmado)
- 1101 unit tests passando em 9.5s, 0 skipped/only (higiene perfeita)
- Tom de `SiteFaq`, `verify-request`, `EditorialEmpty` em `/plano`, welcome email — referências de copy correto

---

## 📂 Índice dos 12 reports

| Especialista | Arquivo | Linhas | Foco |
|---|---|---|---|
| 👁️ Sauron v2 | `sauron-v2-red-team.md` | 404 | Red Team OWASP re-audit |
| 🌟 Galadriel v4 | `galadriel-v4-blue-team.md` | 242 | Blue Team / ASVS 5.0 |
| 🧙‍♂️ Saruman v2 | `saruman-v2-architecture.md` | 540 | Arquitetura / system design |
| 🌳 Treebeard v2 | `treebeard-v2-data.md` | 205 | Prisma + DB + RAG + LGPD storage |
| 🛡️ Boromir v2 | `boromir-v2-code-quality.md` | 285 | Dead code, complexity, lint |
| 🪓 Gimli v2 | `gimli-v2-performance.md` | 435 | Bundle, CWV, perf hot paths |
| 🧙 Gandalf v2 | `gandalf-v2-testing.md` | 420 | Cobertura, E2E, test quality |
| 🏹 Faramir v2 | `faramir-v2-intake.md` | 201 | CV upload + LinkedIn parse |
| 👑 Arwen v2 | `arwen-v2-visual-consistency.md` | 363 | Tokens, spacing, typography, glass |
| 🌳 Tom Bombadil v2 | `tom-bombadil-v2-a11y.md` | 286 | WCAG 2.2 AA |
| 💍 Frodo v2 | `frodo-v2-journey-mobile.md` | 188 | Mobile responsive + user journey |
| 🌾 Sam v2 | `sam-v2-copy-tone.md` | 267 | Tom, terminologia, microcopy |

**Total:** 3836 linhas de análise estruturada com citações `arquivo:linha` em todas as observações.

---

## 🛠️ Recomendação operacional

1. **Hoje (próxima sessão):** Atacar 4 P0 em wave de hotfix sequencial (não paralela — todos são pequenos).
2. **Semana próxima:** Sprint dedicada aos itens 4-7 do Top 10 (lint, server components, refactor analyze/refresh, LGPD compliance gaps).
3. **Sprint seguinte:** itens 8-10 (design system, coverage, rate-limit).
4. **Antes:** revalidar `audit-exceptions-2026-06-26.md` quando Next 14→16 + nodemailer fix saírem.
