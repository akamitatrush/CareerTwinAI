# Wave 11 — Síntese da Auditoria Defensiva (5 anéis paralelos)

**Data:** 2026-06-26
**Anéis:** Arwen · Saruman · Éowyn · Sauron · Elrond
**Total:** 2.006 linhas em 5 docs · ~150 findings priorizados
**Tipo:** RESEARCH-ONLY — zero código modificado

## TL;DR

> Wave 10A foi **PARCIALMENTE positiva** — corrigiu fundação (contraste AA, modal z-index, SrcChip, routes) mas **expôs 6 P0 novos em noir** + **deixou intactos os 4 P1 críticos da Wave 4** + **não tocou no loop central do produto**.

**Veredito unânime dos 5 anéis:** consolidação obrigatória antes de Wave 10B/12 nova de features.

---

## 🔴 P0 críticos — convergências de 2+ anéis (ATACAR PRIMEIRO)

### 1. `--on-primary` aplicado de forma incompleta — **17+ classes invisíveis em noir**
**Anéis:** Arwen P0-2 + Elrond P0
**Severidade:** crítica (afeta FAB do Copilot, brand mark, buttons custom)

Galadriel fixou só `.btn-primary`. Outras 17+ classes com `color:white|#fff` sobre `var(--primary)` continuam quebradas em noir:
- `.ct-copilot-fab` (`globals.css:5325`)
- `.ct-copilot-send` (5462)
- `.ct-copilot-msg.user .ct-copilot-msg-bubble` (5424)
- `.ct-report-cta-primary` (5235)
- `.ct-report-footer-cta` (5304)
- `.brand-mark`, `.appshell-avatar`, `.ct-conta-btn.primary`, `.ct-onb-cta`, `.ct-tailor-btn-copy`, `.appshell-notif-badge`, `.ct-onb-step-item.active`, etc.

Em noir, `--primary = #FAFAFA` → texto branco fica **1.00-2.38:1** (invisível).

**Fix:** aplicar pattern `color: var(--on-primary, #fff)` nessas 17 classes. Esforço: ~1h. ROI: máximo.

### 2. Theme toggle mobile bloqueia Copilot FAB
**Anéis:** Arwen P0-1 + Elrond P1
**Severidade:** alta (mobile users não acessam Copilot Widget)

Faramir reposicionou theme toggle pra `bottom:20px right:20px` em mobile. Copilot FAB está em `bottom:18-24px right:18-24px` no mesmo canto. **Sobrepõem.**

**Fix:** mover theme toggle pra `bottom-left` no mobile, OU dentro do drawer mobile, OU deslocar pra cima. Esforço: 15min.

### 3. Loop Radar continua quebrado (Wave 10A NÃO atacou — era Wave 10B)
**Anel:** Éowyn (confirma diagnóstico Wave 9)
**Severidade:** crítica (loop central do produto não fecha)

`RadarClient.js:385-398` só tem "Ver vaga original ↗" externa. Botões `Adaptar CV →` e `+ Salvar candidatura` existem APENAS em `Report.js:315-318` (que só roda em `/experimentar` anônimo). **Passos 1→2 e 1→4 da jornada inalterados.**

**Fix:** portar TailorModal + SaveJobButton do Report.js pro RadarClient. Esforço: 2-3 dias.

### 4. `/cvs-adaptados` empty state MENTINDO (Wave 10A não atacou)
**Anel:** Éowyn
**Severidade:** alta (instrução falsa pra usuário)

`page.js:94-97` empty state instrui "vá no Radar e clique 'Adaptar Currículo →'" — **botão que não existe** no app logado.

**Fix:** corrigir microcopy do empty state OU atacar #3 primeiro. Esforço: 5min ou 2-3 dias.

### 5. OutcomeSurveyModal — cron envia email pra modal que não monta
**Anel:** Éowyn (descoberta NOVA)
**Severidade:** crítica (dado perdido em produção)

Cron `outcome-survey` envia emails apontando pra `/dashboard?survey=30d`. Dashboard **nem monta o modal nem lê `searchParams.survey`** (`grep "survey" dashboard/page.js` = 0).

**Loop 6→7 oficialmente quebrado em produção.** Caso Jamar (diferencial do Discovery) não captura outcome.

**Fix:** renderizar `OutcomeSurveyModal` quando `searchParams.survey === '30d'`. Esforço: 4h.

### 6. HNSW index loop estrutural (Prisma drop infinito)
**Anel:** Saruman P0.1
**Severidade:** alta (regressão garantida em próxima `prisma migrate dev`)

`prisma/migrations/20260625045109_add_funnel_and_welcome/migration.sql:2` contém `DROP INDEX KnowledgeChunk_embedding_idx`. Treebeard Wave 5 restaurou em migration posterior, mas `schema.prisma:384` declara coluna como `Unsupported("vector(1024)")` sem índice declarável.

**Próximo `prisma migrate dev` vai dropar o índice de novo.** Fix de Treebeard era cosmético.

**Fix estrutural:** hook pre-commit que verifica e re-inserts CREATE INDEX automaticamente, OU script idempotente fora do Prisma. Esforço: 2h.

### 7. `/candidaturas` topbar duplicado dentro do AppShell
**Anel:** Arwen P0-4 (já flaggado por Éowyn no commit Wave 10A)
**Severidade:** média-alta (UX confusa, 2× CareerTwin logo)

`app/(app)/candidaturas/page.js:29-50` renderiza topbar-inner próprio dentro do AppShell → logo duplicada + link redundante "Voltar dashboard".

**Fix:** remover topbar-inner. Esforço: 15min.

### 8. Dark `.btn-primary` 3.30:1 FAIL AA
**Anel:** Elrond P0
**Severidade:** alta (acessibilidade WCAG AA fail em dark theme)

`--on-primary #FFF` sobre `--primary #8585D9` em dark = 3.30:1. Falha AA texto normal por 1.2 pontos.

**Fix:** override `--on-primary: #0D1117` em dark theme (passaria 6.50:1). Esforço: 5min.

### 9. `EXPECTED_MIGRATIONS=15` health endpoint mentindo
**Anel:** Saruman P0.2
**Severidade:** média (monitoramento incorreto)

`app/api/health/route.js:31` diz `EXPECTED_MIGRATIONS=15` mas temos **21 migrations** atualmente. Health payload diz "OK" mesmo desatualizado.

**Fix:** dinamizar contagem (count from filesystem) ou bumpar pra 21. Esforço: 10min.

### 10. `.ct-page-header-title` 80px quebra container 480px (`/admin` login)
**Anel:** Arwen P0-3
**Severidade:** média (overflow em viewports estreitos)

Galadriel trocou H1 de 26px fixo para `clamp(40-80px)`. Em `/admin` login container 480px, gera overflow horizontal.

**Fix:** criar variant `.ct-page-header-title.tool` com clamp menor pra contextos compactos. Esforço: 30min.

---

## 🟠 P1 — 4 itens da Wave 4 (Sauron) CONTINUAM ABERTOS

Wave 10A não atacou nenhum desses (eram fixes Wave 5 que cobriram apenas P0 LGPD/security):

| # | Finding Wave 4 | Status | Esforço fix |
|---|---|---|---|
| P1.1 | TailorBody.vaga `.passthrough()` permite prompt injection — `lib/validators.js:196` | ❌ aberto | 2h |
| P1.2 | OppBody.perfil = `z.any()` permite prompt injection — `lib/validators.js:96` | ❌ aberto | 2h |
| P1.3 | Brute-force admin password sem rate-limit — `app/admin/page.js:61-78` | ❌ aberto | 1h |
| P1.4 | PII em `console.error` (~40 call-sites nas rotas LLM) | ❌ aberto | 3h |

**Sauron Wave 11:** "Fechar os 4 P1 da Wave 4 na Wave 12 ANTES do go-public (~4h total)."

---

## 🟡 P1 — Backend (Saruman novos achados)

| # | Finding | Esforço |
|---|---|---|
| P1.1 | TOCTOU em `applications/[id]` PATCH (sem TX) — race de status concorrente | 1h |
| P1.2 | Dedup race em `applications` POST — sem `@@unique`, duplo clique duplica | 30min |
| P1.3 | `gaps/[id]/complete` pode enviar notificação duplicada | 30min |
| P1.5 | Crons `digest`/`usage-cleanup`/`redact-billing` sem outer try/catch ou `withApiGuard` | 1h |
| P1.6 | Billing checkout/portal/plan sem `audit()` | 1h |

---

## 🟡 P1 — Acessibilidade (Elrond — Wave 9 ainda em aberto)

| # | Finding | Esforço |
|---|---|---|
| - | 3 modais ad-hoc sem focus trap (RefreshDiagnosisButton, CvDetailClient tailor, NotificationsBell drawer) | 4-8h |
| - | NotificationsBell items `<li onClick>` continuam não-focáveis por teclado | 1h |
| - | SiteNav mobile sem ESC handler | 30min |
| - | Light `--negative #DC2626` 4.46:1 borderline FAIL | 5min (trocar pra `--negative-deep`) |

---

## 🟢 O que MELHOROU pós Wave 10A (Wave 10A foi líquido positivo aqui)

✅ **2 P0 contraste de texto (Wave 9)** fechados pelos tokens novos `--text-muted/--text-faint`:
- Light `--text-muted`: 4.48 → **5.90:1** AAA ✓
- Light `--text-faint`: 2.41 → **4.70:1** AA ✓
- Dark `--text-faint`: 2.94 → **5.87:1** AA ✓

✅ **`--site-fg-dim`**: 3.98 → **6.62:1** (Galadriel ajustou de bonus)

✅ **Skip link** visível em todos temas: 15.65 / 16.88 / **20.12:1** AAA

✅ **Lime sobre preto em noir** (botão primary): **16.54:1** AAA (mantido)

✅ **6/6 crons usam `lib/cron-auth.js`** (Wave 5 sólida, sem regressão)

✅ **LinkedIn raw TTL** end-to-end funcional (schema + cron + parser + audit log)

✅ **`safeExternalUrl`**: zero ocorrências de `z.string().url()` permissivo

✅ **HNSW index restaurado** (mas vai dropar de novo — P0.6)

✅ **`/candidaturas` reroute estrutural OK** (imports sobrevivem, middleware funciona)

✅ **SrcChip XSS-safe** por construção (contraste 6.10/4.78/7.88:1 nos 3 temas)

✅ **Modal canonical** Faramir: WAI-ARIA APG completo (focus trap, ESC, return focus, scroll lock)

✅ **`/estagios → /linkedin` 404** fixado

✅ **appshell-user clicável** com aria-label

---

## 📊 Stats convergências

| Categoria | Convergências 2+ anéis | Únicos |
|---|---|---|
| P0 crítico | 3 (on-primary parcial, theme toggle FAB, /candidaturas topbar) | 7 |
| P1 alto | 0 (todos isolados em seus dominios) | 14 |
| P2/P3 | 1 (--site-fg-dim) | 30+ |

---

## 🎯 Wave 12 Proposta — Consolidação Defensiva

Ordem priorizada por **impacto × esforço**:

### Sprint 1 — Quick wins críticos (~3h)
1. Aplicar pattern `--on-primary` em 17 classes (Arwen + Elrond P0)
2. Fix theme toggle mobile (Arwen + Elrond P0)
3. Remover topbar duplicado de /candidaturas (Arwen)
4. Override `--on-primary: #0D1117` em dark theme (Elrond P0)
5. Bumpar EXPECTED_MIGRATIONS pra 21 (Saruman)
6. Fix dead link/instrução mentirosa em /cvs-adaptados empty state (Éowyn)
7. Criar variant `.ct-page-header-title.tool` (Arwen)

### Sprint 2 — Loop fechado real (~3-5 dias)
8. **Portar TailorModal + SaveJobButton pro RadarClient** (Éowyn — destrava 1→2 e 1→4)
9. **Render OutcomeSurveyModal no dashboard quando `?survey=30d`** (Éowyn — destrava 6→7)
10. Render WelcomeModal first-login (Éowyn)
11. Streaks visíveis no AppShell (Gwaihir backlog Wave 9)

### Sprint 3 — Hardening segurança (~4h)
12. P1.1: Restringir `TailorBody.vaga` schema (Sauron)
13. P1.2: Restringir `OppBody.perfil` schema (Sauron)
14. P1.3: Rate-limit em adminLoginAction (Sauron)
15. P1.4: Sanitize PII em console.error (~40 call-sites) (Sauron)

### Sprint 4 — A11y refator (~8-12h)
16. Refatorar 3 modais ad-hoc para usar `<Modal>` canonical (Elrond)
17. NotificationsBell `<li>` → `<button>` (Elrond)
18. SiteNav mobile ESC handler (Elrond)

### Sprint 5 — Backend robustez (~3-4h)
19. TX em PATCH applications (Saruman P1.1)
20. `@@unique` em applications (Saruman P1.2)
21. Outer try/catch em crons (Saruman P1.5)
22. Hook pre-commit pra preservar HNSW index (Saruman P0.6)

---

## 🚦 Recomendação final ao Founder

**Wave 12 — Consolidação Defensiva ANTES de Wave 10B/feature nova:**

- Sprint 1 (~3h) → **OBRIGATÓRIO** — corrige bugs visíveis em produção
- Sprint 2 (~3-5 dias) → **DECISÃO ESTRATÉGICA** — destravar loop central é o que justifica o produto. SEM isso, "tese 80% no código, 55% nos pixels" continua válido.
- Sprint 3 (~4h) → **ANTES DO PRIMEIRO USUÁRIO REAL** — fechar P1s segurança da Wave 4.
- Sprint 4-5 → **POST-piloto** — polish a11y + backend robustez.

**Decisão Sérgio:** dispatcho Sprint 1 + 2 agora (Wave 12A + 12B)? Ou paramos pra revisar os 5 docs primeiro?
