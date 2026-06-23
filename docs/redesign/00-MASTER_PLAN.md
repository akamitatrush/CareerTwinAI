# Master Plan — Migração para Claude Design

Branch: `redesign/claude-design` · Base: `3db406b` (main)
Última revisão: 2026-06-22 · Autor: orquestração multi-agente (FE + BE + DevOps)

---

## Sumário

1. [TL;DR](#tldr)
2. [Estimativa consolidada de esforço](#estimativa-consolidada-de-esforço)
3. [Pré-requisitos críticos (PARAR ANTES de começar)](#pré-requisitos-críticos-parar-antes-de-começar)
4. [Decisões de produto pendentes](#decisões-de-produto-pendentes)
5. [Arquitetura — visão consolidada](#arquitetura--visão-consolidada)
6. [Roadmap em 6 fases](#roadmap-em-6-fases)
7. [Caminho crítico e dependências](#caminho-crítico-e-dependências)
8. [Riscos top 7](#riscos-top-7)
9. [Critério de "pronto pra produção"](#critério-de-pronto-pra-produção)
10. [Alternativas (escopo reduzido)](#alternativas-escopo-reduzido)
11. [Próximas ações de orquestração](#próximas-ações-de-orquestração)

---

## TL;DR

A migração para "Claude Design" é uma reescrita visual + reorganização estrutural completa do frontend, com mudanças moderadas no backend (1 modelo novo, ~5 endpoints novos, refactor de outros) e overhead operacional significativo. A funcionalidade-core do produto **já existe** — o trabalho é reorganizar 6 telas em rotas dedicadas, trocar paleta/tipografia, e adicionar 4-5 features visíveis no mock que o produto atual não entrega ainda.

**Esforço total estimado:** 305-333 horas de dev focado (8-10 semanas com 1 dev em capacidade boa, ou ~4 semanas com 2 devs em paralelo). **Não é trivial.** Recomendação: ler [Alternativas](#alternativas-escopo-reduzido) antes de comprometer.

**Antes de começar a migração, 3 bugs/gaps em `main` precisam ser resolvidos** (privacy/terms, CSP bloqueando observability, Neon branch isolation). Detalhe em [Pré-requisitos](#pré-requisitos-críticos-parar-antes-de-começar).

---

## Estimativa consolidada de esforço

| Camada | Horas | % do total |
|---|---|---|
| **Frontend** (5 sprints: foundation + 5 telas + cleanup) | 185h | 60% |
| **Backend** (1 modelo + 5 endpoints + refactors + observability) | 73h | 24% |
| **DevOps + QA + Security** (Vercel preview, CI, testes, LGPD docs) | 47h | 15% |
| **Subtotal core** | **305h** | **100%** |
| Item deferred 1 — Sub-scores determinísticos (corrige bug filosófico) | +12h | — |
| Item deferred 2 — ATS analyzer (feature do mock não implementada) | +16h | — |
| **Total incluindo deferred** | **333h** | — |

**Calendar realista:**
- 1 dev senior, 80% capacity: ~10 semanas
- 2 devs em paralelo (1 FE + 1 BE): ~5 semanas
- 3 devs (1 FE + 1 BE + 1 DevOps/QA): ~3 semanas

**Estes números pressupõem zero retrabalho.** Multiplique por 1.3-1.5 pra cenário realista.

---

## Pré-requisitos críticos (PARAR ANTES de começar)

Os 3 agentes identificaram **bugs/gaps em produção HOJE** que devem ser resolvidos **em `main`** antes do trabalho na branch `redesign/claude-design`, senão a migração herda dívida acumulada.

### PR1 — Fix CSP pra liberar observabilidade (URGENTE, ~1h)

**Sintoma:** `middleware.js` define `connect-src 'self'` na CSP. Isso **bloqueia todas as chamadas pra `us.i.posthog.com` e `*.ingest.sentry.io`**.

**Impacto:** desde o commit `2d14dad` (Sentry+PostHog adicionados), **provavelmente nenhum evento de produto está chegando em prod**. Toda a observabilidade que pensamos ter está silenciosamente quebrada.

**Fix:** adicionar `https://us.i.posthog.com` e `https://*.ingest.sentry.io` (e `https://o*.ingest.us.sentry.io`) no `connect-src`. Validar no DevTools.

**Por que antes:** se não fizer, a versão Claude Design vai parecer ter "quebrado a observabilidade" quando na verdade já estava quebrada.

### PR2 — Privacy/Termos (LGPD, ~5h sem advogado, ~10h com revisão)

**Sintoma:** produto coleta CV/LinkedIn/GitHub data sem `/privacidade` nem `/termos` públicos. `/meus-dados` cumpre 80% do que LGPD pede, mas falta o documento explicativo.

**Risco:** ANPD pode notificar. Pior: investidor faz due diligence, vê que não tem privacy policy, mata o deal.

**Fix:** criar `/privacidade` (rota pública) com texto LGPD-compliant cobrindo: dados coletados, finalidade, base legal (consentimento), retenção, direitos do titular, contato DPO. `/termos` mais simples cobrindo uso aceitável.

**Por que antes:** Claude Design adiciona novas superfícies que coletam dados (filtros, % completude rastreado). Quanto mais features novas, mais exposição sem cobertura jurídica.

### PR3 — Neon branch automático ou DB staging dedicado (BLOQUEIO ARQUITETURAL, ~2h)

**Sintoma:** se Vercel preview deploys da branch `redesign/claude-design` apontarem pro mesmo DB de produção, qualquer `prisma migrate` em preview vai corromper prod.

**Fix:** configurar **Neon branch automático** (feature do Neon — cada PR cria branch isolado do DB) OU provisionar Postgres staging dedicado.

**Por que antes:** o segundo commit da branch já deve rodar `prisma generate`. Sem isolamento, qualquer feature nova que toque schema vira risco.

### Outros pré-requisitos (não bloqueantes, mas valem fazer)

- **PR4 — `/api/health` route** (~30min). Destrava UptimeRobot agora; serve `main` e a nova versão.
- **PR5 — Atualizar CI triggers** pra incluir `redesign/claude-design` (já está incluído — verificar). Sem isso a branch não roda CI desde o primeiro commit.
- **PR6 — `CONTRIBUTING.md`** com política de schema expand/contract. Documenta a regra "campos novos sempre nullable, sem destrutivas" antes do primeiro PR na branch.

**Tempo total PR1-PR6 em main:** ~10-15h, pode ser feito em 1-2 dias antes de começar a migração.

---

## Decisões de produto pendentes

Frontend agent identificou **8 inconsistências entre o mock e o produto atual** que precisam de decisão antes (ou durante) a migração. Compilei aqui pra ficar visível:

| # | Pergunta | Recomendação |
|---|---|---|
| 1 | Mock tem só upload PDF; produto atual tem textarea pra colar texto. **Manter textarea?** | **Manter.** PDFs nem sempre estão à mão; perde-se 20% de conversão sem ela. |
| 2 | Live recalc de score (concluir microação → score sobe na hora) existe no Report atual mas sumiu do mock. **Manter?** | **Manter.** É um dos diferenciais auditáveis do produto. Adapta a UX do mock pra acomodar. |
| 3 | Modais "Treinar entrevista" e "Conversar com gêmeo" não aparecem no mock. **Onde vão?** | **/dashboard floating buttons** ou rota `/treinar`. Não cortar — são funcionalidades que diferenciam. |
| 4 | Mock mostra 8 requirements em /gaps; produto gera 3-5. **Expandir `/api/analyze`?** | **Sim,** parametrizar quantidade. 6-8 é mais útil que 3-5. |
| 5 | Mock separa salário, modelo, senioridade; produto guarda como string única. **Refatorar?** | **Sim,** parse estruturado por provider (Adzuna já entrega salário separado). |
| 6 | Persona Mariana onipresente no mock. **Virou demo? Empty-state? Sample CV?** | **Sample CV** (`lib/sample.js` já existe). Não mockar usuário fake em produção. |
| 7 | Sidebar do mock mostra "nome + targetRole" no rodapé; produto atual mostra email. **O que mostrar?** | **Nome + cargo-alvo** (alinhado ao mock). Email só em `/conta`. |
| 8 | `/transparencia` é rota nova. **Entrada permanente na sidebar?** | **Sim,** valida o pitch ("número = cálculo auditável"). |

Decisões 1, 2, 3 são as mais impactantes. Vale o owner topar antes de codar.

---

## Arquitetura — visão consolidada

### Frontend

- **Stack:** Next.js 14 App Router (mantém), React 18, CSS variables, sem libs novas
- **Layout:** AppShell com sidebar 252px desktop + header colapsável mobile, breakpoint 880px
- **Default theme:** light com creme `#F6F5F2` (oposto do dark atual). Dark adiado.
- **Rotas novas:** `/dashboard`, `/gaps`, `/oportunidades`, `/plano`, `/transparencia` em route group `(app)`
- **`/meu-gemeo`:** redirect → `/dashboard`. Report.js explode em 5 telas distintas.
- **Componentes:** 25 novos no design system (`<ScoreRing>`, `<SubScoreList>`, `<MedianaComparison>`, `<KPIStripCard>`, `<JobCard>`, `<FitRing>`, `<ScoreOverTimeChart>`, `<TimelineRow>`, etc).
- **Score reveal:** SVG renderizado server-side com valor final (evita bug "0 piscando" do produto atual).

Detalhes: [`01-FRONTEND.md`](./01-FRONTEND.md) · 1068 linhas.

### Backend

- **Stack:** Next.js API routes + Prisma 6 (PostgreSQL) + Auth.js v5 — mantém.
- **Novo modelo:** `Benchmark` (role, percentile, value, source, sampleSize, scrapedAt) — alimenta a "mediana de contratados = 78".
- **Reaproveitado:** `Gap.completedAt` e `PlanItem.completedAt` (campos órfãos hoje) viram fonte da linha do tempo.
- **% completude:** cálculo em runtime (`lib/metrics/completeness.js`), não persiste.
- **Endpoints novos chave:**
  - `GET /api/profile/completeness` — % do perfil preenchido
  - `GET /api/score/latest-with-history` — snapshot atual + delta vs último
  - `GET /api/gaps/summary` — KPI strip (vagas analisadas, skills, gaps, aderência)
  - `GET /api/gaps/requirements` — skills do mercado com frequência
  - `GET /api/history/score` — todas snapshots pro chart
  - `GET /api/history/actions` — UNION de 5 fontes pra timeline (alto risco IDOR — atenção)
  - Refactor `POST /api/opportunities` — adicionar filtros (senioridade/modelo/minMatch), subir limit pra 24
- **Mediana de contratados:** stub mockado no MVP, real depois (parceria com Solides/InHire/Glassdoor).
- **Dívida arquitetural revelada:** sub-scores ainda gerados pela LLM em `lib/prompts.js:30-35` — viola o princípio "número = cálculo determinístico". Custa +12h pra migrar (deferred).

Detalhes: [`02-BACKEND.md`](./02-BACKEND.md) · 669 linhas.

### DevOps / QA / Security

- **Branch isolation:** main produção intocada · redesign/claude-design preview Vercel automático.
- **Promoção:** PR redesign → main, CI verde, smoke test, prisma migrate deploy. Rollback via revert.
- **Cobertura de testes:** mantém 112 unit tests; adiciona ~30 novos (componentes + métricas) + 5-8 e2e specs (onboarding flow, filtros, navegação sidebar, toggle tema).
- **Performance budgets:** LCP < 2.5s, bundle por rota < 100KB, API p95 < 800ms.
- **Custo previsto:** $30-50/mês pra 1k MAU (Vercel free + Neon free + Sentry/PostHog free).
- **LGPD:** `/privacidade` + `/termos` precisam ser escritos (PR2 acima).

Detalhes: [`03-PRODUCTION.md`](./03-PRODUCTION.md) · 521 linhas.

---

## Roadmap em 6 fases

Fases ordenadas pra **maximizar feedback cedo** (visual change early, plumbing depois). Cada fase termina em um deploy preview funcional, mesmo que parcial.

### Fase 0 — Pré-requisitos em `main` (10-15h)
- PR1: Fix CSP pra liberar PostHog/Sentry
- PR2: `/privacidade` + `/termos`
- PR3: Neon branch automático ou staging DB
- PR4: `/api/health`
- PR5: Verificar CI triggers cobrem a branch redesign

**Deliverable:** main mais segura, preview deploys isolados.

### Fase 1 — Foundation da nova identidade (20-25h)
- Migrar paleta no `globals.css` (índigo + damasco + verde sereno + âmbar + creme)
- Trocar Bricolage Grotesque por Plus Jakarta Sans (body) + Spectral (display serif)
- Default light com creme `#F6F5F2`. Dark mode adiado.
- AppShell esqueleto (sidebar + header mobile + nav básica)
- Route group `(app)/` com layout
- Cleanup hardcoded colors em components/

**Deliverable:** versão Claude Design **visualmente reconhecível**, mesmo com conteúdo das telas antigas dentro.

### Fase 2 — Backend foundation (15-20h)
- Modelo `Benchmark` no Prisma (migration nullable)
- `/api/profile/completeness`
- `/api/score/latest-with-history`
- Stub mediana com label "estimativa em construção"
- Refactor `/api/opportunities` aceitando filtros via body (não query string)

**Deliverable:** backend pronto pra alimentar as telas novas.

### Fase 3 — Dashboard + Análise de gaps (35-45h)
- Componentes: `<ScoreRing>`, `<SubScoreList>`, `<MedianaComparison>`, `<ActionCard>`, `<ProfileSnapshot>`, `<KPIStripCard>`, `<RequirementRow>`, `<SkillChip>`
- `/dashboard` página completa
- `/gaps` página completa
- `/api/gaps/summary` + `/api/gaps/requirements`

**Deliverable:** as 2 telas mais usadas funcionando na nova identidade. Cabe parar aqui se quiser smoke test antes do resto.

### Fase 4 — Radar + Plano + Transparência (50-65h)
- `/oportunidades` com filtros (senioridade, modelo, aderência min)
- `/plano` com line chart SVG + timeline de ações (`/api/history/score` + `/api/history/actions`)
- `/transparencia` com fórmula + data sources + LGPD card

**Deliverable:** 5 das 6 telas do mock prontas. Conta + Candidaturas usam AppShell mas estética nova.

### Fase 5 — Onboarding refresh (20-25h)
- Reescrever `/` em split-panel
- 3 source cards (CV/LinkedIn/GitHub) com states (pending/loading/done)
- Bloco LGPD em destaque

**Deliverable:** experiência de entrada alinhada ao mock.

### Fase 6 — Polish + QA + cleanup (40-50h)
- Migrar restante dos hardcodes
- Testes unit + e2e + acessibilidade
- `/meu-gemeo` → redirect pra `/dashboard`
- Lighthouse > 90 em todas as rotas
- Smoke test manual completo (checklist em `03-PRODUCTION.md`)
- Merge PR final

**Deliverable:** redesign pronto pra produção.

---

## Caminho crítico e dependências

```
Fase 0 (pré-req main) ──► Fase 1 (FE foundation) ──┬─► Fase 3 (Dash+Gaps) ──┬─► Fase 5 (Onboarding)
                          Fase 2 (BE foundation) ──┘                        │
                                                                           Fase 4 (Radar+Plano+Transp)
                                                                            │
                                                                            └─► Fase 6 (Polish+QA)
```

**Paralelizável:**
- Fase 1 (FE) e Fase 2 (BE) em paralelo (devs separados)
- Fase 4 telas (Radar, Plano, Transparência) entre si em paralelo

**Sequencial obrigatório:**
- Fase 0 antes de tudo (CSP/LGPD/DB isolation são pré-req)
- Fase 1+2 antes de Fase 3 (foundation antes de páginas)
- Fase 6 último (cleanup depende de tudo)

---

## Riscos top 7

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | **Decisão de marca muda no meio** (3ª vez na sessão) | Média | Crítico | Confirmar com time da Tera antes de Fase 1 |
| 2 | **Mediana de contratados é vaporware** | Alta | Médio | Stub com label "em construção" + plano de parceria 6 meses |
| 3 | **Coexistência dark legado + light Claude** durante migração | Alta | Médio | Eliminar modais legados antes da Fase 3 ou criar shim |
| 4 | **Line chart SVG dinâmico** subestimado | Média | Médio | Spike de 4h na Fase 2 pra validar |
| 5 | **AppShell + route groups + CSP nonce** combinação delicada Next 14 | Média | Alto | Spike de 2h em route dummy antes da Fase 1 |
| 6 | **Rate limit em memória furado** em multi-instance Vercel | Alta | Médio | Migrar pra Upstash Redis na Fase 2 (4h extras) |
| 7 | **Sub-scores LLM não-determinísticos** quebram pitch "auditável" | Alta | Alto | Migrar pra fórmulas determinísticas (deferred 12h) |

---

## Critério de "pronto pra produção"

Antes do merge final `redesign/claude-design` → `main`:

- [ ] 100% das 6 telas do mock implementadas
- [ ] Testes: ≥ 130 unit + ≥ 6 e2e specs passando
- [ ] Lighthouse Performance > 90 em todas as rotas autenticadas
- [ ] Lighthouse Accessibility > 95 em todas as rotas
- [ ] Smoke test manual de 17 itens (checklist em 03-PRODUCTION.md) passou
- [ ] Schema migration testada em DB staging (zero erro)
- [ ] CSP atualizada pra novas origins (se houver)
- [ ] Sentry + PostHog recebendo eventos em produção (validado em preview)
- [ ] `/privacidade` + `/termos` publicados
- [ ] Documentação atualizada (README, ARCHITECTURE, PRODUTO)
- [ ] Skill `seguranca-careertwin` aplicada em todos os PRs que tocaram auth/Prisma/LLM/PII
- [ ] Decisões de produto pendentes (8 itens da [seção 4](#decisões-de-produto-pendentes)) tomadas e implementadas

---

## Alternativas (escopo reduzido)

305h é caro. Três caminhos alternativos pra se você quiser cortar escopo:

### Opção A — Migração visual apenas (Fase 0 + Fase 1, ~30-40h)
Troca paleta + tipografia + light default. Mantém scroll vertical do Report atual.
**Custo:** ~35h. **Resultado:** parece com o mock em 70%, sem reorganizar estrutura.
**Para quem:** quer mostrar mudança ao time da Tera rápido, sem comprometer 2 meses.

### Opção B — Migração visual + AppShell sidebar (Fases 0-2, ~70-90h)
Acrescenta sidebar e route group, mas mantém Report.js inteiro como `/dashboard` (sem quebrar em 5 telas).
**Custo:** ~80h. **Resultado:** estrutura sidebar correta, telas internas ainda monolíticas.
**Para quem:** dá pra mostrar como protótipo navegável sem pagar o preço da reorganização IA completa.

### Opção C — Full Claude Design (Fases 0-6, ~305h)
O plano completo desse documento.
**Para quem:** decidiu pelo redesign como direção final + tem time/tempo pra executar.

### Opção D — Não migrar agora
Mostra mock pro time da Tera, deixa eles decidirem. Mantém produto atual em prod, continua polindo.
**Custo:** 0h migração + 10h iteração no produto atual.
**Para quem:** ainda não tem consenso de marca, ou quer priorizar tração antes de UX premium.

**Minha recomendação como senior advisor:** **Opção A ou D primeiro.** Razões:

- Marca ainda não está decidida com time
- Produto atual em prod já funciona
- 305h é 8-10 semanas — muito investimento sem validação
- Opção A entrega 70% da sensação visual em ~35h
- Com a Opção A no ar, conversa com a Tera vira concreta: "olha, podemos ir mais fundo, vale o investimento?"

---

## Próximas ações de orquestração

**Antes do próximo commit na branch:**

1. **Você decide opção (A/B/C/D)** baseado em apetite de tempo e validação com time
2. **Você decide as 8 inconsistências de produto** (seção 4) — pode ser durante, mas algumas afetam dia 1
3. **Eu rodo os 3 PRs de pré-requisito em `main`** (CSP fix, /privacidade stub, Neon branch) — independente da opção escolhida, esses 3 são valor
4. **Eu pusho a branch atual pra GitHub** pra Vercel fazer preview deploy (mesmo vazia, valida pipeline)
5. **Confirmamos com time da Tera** antes de comprometer com Opção B ou C

**Se a escolha for opção A (recomendada):**
- Próxima sessão: dispatcho 2 agentes em paralelo (Frontend foundation + cleanup hardcodes)
- Calendar: 1-2 sessões médias resolvem

**Se a escolha for opção C (full):**
- Próxima sessão: PRs de pré-requisito em main (~10-15h)
- Calendar: 8-10 semanas de trabalho coordenado, 2-3 sessões grandes por semana

---

## Anexos

- [`01-FRONTEND.md`](./01-FRONTEND.md) — arquitetura frontend completa (1068 linhas)
- [`02-BACKEND.md`](./02-BACKEND.md) — arquitetura backend completa (669 linhas)
- [`03-PRODUCTION.md`](./03-PRODUCTION.md) — DevOps + QA + Security (521 linhas)
- [`../../README.md`](../../README.md) — produto atual
- [`../PRODUTO.md`](../PRODUTO.md) — especificação produto + concorrência
- [`../UX_AUDIT.md`](../UX_AUDIT.md) — audit UX (referências internacionais + BR)
- [`../REBRAND_CANDIDATES.md`](../REBRAND_CANDIDATES.md) — 22 nomes verificados

---

*Documento gerado pela orquestração multi-agente em 2026-06-22. Os 3 docs especializados (FE/BE/DevOps) são fonte da verdade — este Master Plan é síntese pra decisão executiva.*
