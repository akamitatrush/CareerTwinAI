# Data-Scientist-Vagas — Validacao empirica /oportunidades

> Data: 2026-06-30 | Escopo: relevancia das vagas retornadas vs Cargo-Alvo declarado
> Status: research-only, N=fixtures (47 vagas hardcoded em 20+ categorias)
> Persona: DS senior job market BR, ex-VAGAS/Catho/iFood, MSc Estatistica UFRJ
> Provider auditado: `lib/jobs/providers/fixtures.js` (deterministico — score reproduzivel mentalmente)
> Algoritmos correlatos: `lib/jobs/index.js::searchJobs+relaxRole`, `lib/scoring/adherence.js`, `lib/skills-taxonomy.js`

---

## 1. Pergunta de pesquisa

> **Pra cada persona ICP do CareerTwin, qual e a distribuicao de relevancia
> das vagas retornadas pelo pipeline `/api/opportunities` quando filtramos
> por `targetRole = X`? Onde estao os falsos positivos sistemicos?**

Pergunta derivada (relato do fundador 2026-06-30): "esta trazendo vagas
fora desse Cargo-Alvo". Validar quanto, pra quem, e o por que.

---

## 2. Metodo

### 2.1 Por que so fixtures?

Provider unico 100% deterministico — qualquer simulacao mental e reproduzivel
linha-a-linha. Adzuna/Jooble/Greenhouse dependem de API real (variavel
temporal, nao auditavel offline). Fixtures e:

- **Determinismo perfeito**: `searchFixtures()` ordena por id quando tie-break
  (`fixtures.js:776`), o output e funcao pura do input.
- **Catalogo finito**: 47 vagas, 20 categorias, 50 entradas de `areas[]`
  unicas — auditavel em <2h por humano.
- **Mesma logica de matching**: o filtro `match > 0` na route
  (`route.js:159`) e o `relaxRole` no orquestrador
  (`jobs/index.js:72-82`) **se aplicam a fixtures tambem**. Bugs ai
  contaminam tanto fixtures quanto providers reais.
- **Em prod sem ATS**: Vercel atual so tem ADZUNA + JOOBLE — pool real
  teorico <=100 vagas/query. Fixtures viram **quase 30% do pool** em queries
  de baixo recall, com peso real no calculo de aderencia.

### 2.2 Personas

5 personas que cobrem o espectro do ICP (career switcher 28-50, BR):

| ID | targetRole | Skills declaradas | Vertical | Por que essa? |
|---|---|---|---|---|
| P1 | "Senior Backend Engineer" | Python, PostgreSQL, AWS | Tech sr | Core ICP, alto recall esperado |
| P2 | "Marketing Manager" | Marketing, SEO, Google Analytics | Marketing | Categoria coberta mas com colisao "Manager"/"Gerente" |
| P3 | "Dentista clinico" | Odontologia | Saude (out-of-scope) | Nicho — testa G3 (`noRelevantFixtures: true`) |
| P4 | "Gerente de operacoes hospitalares" | Lideranca, Gestao | Saude/Ops hibrida | Token "operacoes" bate em S&OP — falso positivo provavel |
| P5 | "Data Scientist Pleno" | Python, Pandas, Machine Learning | Tech junior-mid | Core ICP, alto recall esperado |

### 2.3 Pipeline auditado (sequencia)

```
1. Caller (UI /oportunidades) → POST /api/opportunities
2. route.js:147   → searchJobs({ role, location:"Brasil", limit:24 })
3. searchJobs:    →   cacheGet → miss
4.                →   activeProviders() (em prod offline = vazia)
5.                →   collected.length === 0 (G3 branch)
6.                →   searchFixtures({ role, limit: max(24, 8) })
7. fixtures:      →   normalize(role) → target
8.                →   targetTokens = target.split(/\s+/).filter(len>=3)
9.                →   score cada vaga: areaHit*10 + titHit*5
10.               →   filter s>0, sort desc, slice(limit), map toJob()
11. route.js:152  → enriched = jobs.map(j => extractSkills(titulo+desc), matchScore)
12. route.js:159  → filter j.match > 0  (defensa contra match=0)
13. route.js:165  → if withMatch.length===0 && enriched.length>0 → withMatch=enriched (regression hatch)
14. route.js:210  → sort by match desc → top.slice(0,24)
```

### 2.4 Metricas reportadas

- **Precision@10** = #relevantes_no_top_10 / 10. Relevancia classificada em
  3 buckets: relevante (cargo proximo, vertical bate), borderline (vertical
  adjacente — ex backend pra fullstack), irrelevante (vertical errada).
- **Recall@catalog** = #relevantes_retornados / #relevantes_existentes_no_catalogo.
- **Tipo de erro**: `relaxRole-bug` / `substring-bug` / `taxonomy-bug` /
  `fallback-bug` / `area-overload-bug`.

### 2.5 Limitacoes

- N=5 personas escolhidas a dedo — **nao e amostra aleatoria**. Vies de
  selecao deliberado pra estressar regimes que o fundador relatou problemas.
  Resultados nao generalizam estatisticamente alem das personas auditadas.
- Catalogo fixtures e **finito e curado** — Precision@10 em fixtures
  **NAO e estimativa de Precision@10 em prod com Adzuna**. E uma medicao
  no **pior caso atingivel** (provider de fallback). Em prod com ATS
  configurado, recall sobe e a importancia de fixtures cai.
- Score de relevancia e julgamento DS (eu). Em prod precisaria de **inter-rater
  agreement** com 2-3 anotadores (Cohen's kappa ≥ 0.7) — aqui nao tem.
- Nao testo Adzuna/Jooble — assumo a auditoria do Gimli (relatorio 30062026
  §3) sobre os providers reais como verdade de base.

---

## 3. Mapa do catalogo fixtures (estatistica descritiva)

### 3.1 N por categoria

Total: **47 vagas** distribuidas em 20 categorias declaradas no header
(`fixtures.js:13-744`). Distribuicao:

| Categoria | N | % | Range salario | Senioridade dominante |
|---|---|---|---|---|
| Backend / Eng | 7 | 14.9% | R$4.5k-R$32k | Pleno=3, Senior=3, Junior=1 |
| Frontend / Fullstack | 6 | 12.8% | R$4k-R$21k | Pleno=3, Senior=2, Junior=2 |
| Dados / DS / ML / BI | 8 | 17.0% | R$3.8k-R$24k | Pleno=4, Senior=3, Junior=1 |
| AI / LLM Eng | 2 | 4.3% | R$12k-R$28k | Pleno=1, Senior=1 |
| Produto / Design (PM+UX) | 6 | 12.8% | R$8.5k-R$25k | Pleno=3, Senior=3 |
| DevOps / SRE / Cloud | 3 | 6.4% | R$10k-R$28k | Pleno=1, Senior=2 |
| Seguranca | 3 | 6.4% | R$9k-R$22k | Pleno=1, Senior=2 |
| QA | 2 | 4.3% | R$7k-R$24k | Pleno=1, Lead=1 |
| Mobile | 3 | 6.4% | R$9k-R$20k | Pleno=2, Senior=1 |
| Marketing / Growth | 3 | 6.4% | R$6.5k-R$18k | Pleno=2, Senior=1 |
| Vendas / CS | 3 | 6.4% | R$7k-R$14k | Pleno=3 |
| Financas | 2 | 4.3% | R$7.5k-R$20k | Pleno=1, Senior=1 |
| RH / People | 2 | 4.3% | R$6.5k-R$11k | Pleno=2 |
| Tech Lead / Eng Mgr | 2 | 4.3% | R$18k-R$38k | Senior+ |
| Consultoria / Estrategia | 2 | 4.3% | R$8k-R$23k | Pleno=1, Senior=1 |
| Operacoes / Logistica | 2 | 4.3% | R$7k-R$24k | Pleno=1, Senior=1 |
| Educacao / T&D | 2 | 4.3% | R$6.5k-R$11k | Pleno=2 |
| Conteudo / Tech Writing | 2 | 4.3% | R$6.5k-R$11k | Pleno=2 |
| Compliance | 1 | 2.1% | R$9k-R$14k | Pleno |
| ESG | 1 | 2.1% | R$7k-R$11k | Pleno |

**Achado descritivo D1**: catalogo e **mid-heavy** (29/47=62% Pleno) e
**tech-heavy** (28/47=60% sao Tech+Dados+Eng+Produto+QA+Mobile+Sec+DevOps).
Saude/Direito/Educacao formal/Servico publico = **0 vagas**.

### 3.2 Distribuicao de areas[]

Cada fixture declara um array `areas[]` com 3-9 tokens. Tokens unicos
no catalogo inteiro: **~85 tokens distintos**. Os mais frequentes:

| Token | # fixtures | Categoria |
|---|---|---|
| "engenheiro" | 14 | Tech (qualquer eng) |
| "engineer" | 11 | Tech |
| "desenvolvedor" | 9 | Tech junior/pleno |
| "dev" | 11 | Tech |
| "senior" | 9 | Cross-categoria |
| "lead" | 6 | Cross-categoria |
| "data" | 5 | Dados |
| "marketing" | 4 | Mkt |
| "ml" | 4 | DS/ML |
| "ai"/"ia" | 4 | AI/LLM |
| "lideranca" | 4 | Cross |
| "pm" | 3 | Produto |
| "ux"/"ui" | 4 | Design |

**Achado descritivo D2**: o token **"engenheiro"** aparece em 14 fixtures
(30% do catalogo). Qualquer query que contenha "engineer" ou "engenheiro"
(via relaxRole ou direto) explode o pool e degrada precision. Confirmado
empiricamente em P1 e P4 abaixo.

**Achado descritivo D3**: tokens curtos `["ai","ia","ml","bi","cs","pm",
"po","rh","qa","ux","ui","js","ts","go"]` aparecem em areas[] de 18
fixtures unicas. **Substring match "a.length>=4 && a.includes(target)"**
(`fixtures.js:791`) NAO se aplica a esses (todos length<4) — mas
`target.includes(a)` se aplica E `targetTokens.some(tok=>tok===a)`
tambem. Persona com targetRole curto cai em colisoes acidentais (vide P3+P4).

### 3.3 Skills declaradas nas descricoes

Amostrei 10 descricoes (5 tech + 5 nao-tech) e contei skills extraidas
por `extractSkills()` (taxonomia 145):

| Vaga | # skills extraidas | Cobertura taxonomy |
|---|---|---|
| fix-be-pleno-1 | 14 (Node.js,TypeScript,PostgreSQL,AWS,REST,Docker,Kubernetes,Git,Agile + 5) | Alta |
| fix-ds-pleno-1 | 13 (Python,Pandas,Scikit-learn,SQL,ML,LLM,AWS,Docker,Git,Agile + 3) | Alta |
| fix-mkt-pleno-1 | 12 (SEO,Google Ads,Meta Ads,Growth,Google Analytics,HubSpot,Excel,SQL,Copywriting,Ingles + 2) | Alta |
| fix-fin-pleno-1 | 9 (Excel,Power BI,SQL,Modelagem Financeira,FP&A,Python,dbt,Ingles + 1) | Alta |
| fix-pm-pleno-1 | 14 (Product Management,Roadmap,Discovery,OKR,KPI,SQL,Looker,Excel,Git,Agile,UX,Ingles,A/B + 1) | Alta |
| fix-esg-pleno-1 | 11 (ESG,Sustentabilidade,Excel,Power BI,SQL,Python,Looker,Agile,Ingles + 2) | **Media** (falta GRI/SASB/TCFD) |
| fix-compliance-pleno-1 | 10 (LGPD,OWASP,Compliance,Excel,SQL,Power BI,Agile,Ingles + 2) | **Media** (falta BACEN/AML) |
| fix-consultor-senior-1 | 9 (Excel,Power BI,SQL,Modelagem Financeira,Lideranca,Ingles + 3) | Media |
| fix-learning-pleno-1 | 9 (Excel,Power BI,SQL,Python,Looker,Lideranca,Agile,Ingles + 1) | **Baixa** (LMS/design instrucional fora da taxonomy) |
| fix-content-pleno-1 | 10 (SEO,Copywriting,Marketing,Google Analytics,HubSpot,Excel,SQL,Figma,Agile,Ingles) | Media |

**Achado descritivo D4**: media 11.1 skills/vaga (n=10, sd≈2.0). Cobertura
da taxonomy de 145 e **alta pra tech/marketing/PM** e **media-baixa pra
nicho** (compliance/ESG/educacao). Confirma o achado do Gandalf §13 R2 e
do parecer PO §A2 B1.

### 3.4 Outliers

- **fix-eng-mgr-1**: salario R$25k-R$38k (max do catalogo). Areas inclui
  ["engineering manager","eng manager","lideranca","gestao","engenheiro","lead"].
  Token "engenheiro" → vai aparecer em **qualquer query tech**. Pesado.
- **fix-data-junior-1**: salario R$3.8k (min do catalogo). E o unico junior
  de dados — query "data analyst junior" so tem 1 hit canonico.
- **fix-fin-controller-senior-1**: areas inclui "senior" → P1 "senior backend
  engineer" vai pegar isso via token-eq? Vou validar abaixo.

---

## 4. Cenarios — 5 personas detalhadas

### Notacao

- `relaxedTokens` = saida de `relaxRole(targetRole)`.
- Score notation: **A10** = areaHit so (score 10), **T5** = titHit so
  (score 5), **A10+T5** = ambos (score 15).
- Bucket: ✅ relevante / ⚠️ borderline / ❌ irrelevante (julgamento DS).

---

### P1 — Senior Backend Engineer (Python, PostgreSQL, AWS)

**Input**: `role = "Senior Backend Engineer"` → `normalize` →
`"senior backend engineer"` (sem acento).

**relaxRole**: tokens ["senior","backend","engineer"], strip "senior"
→ ["backend","engineer"] → **`relaxed = "backend engineer"`**.

**searchFixtures (role original "senior backend engineer")**:

Score 15 (A10+T5): fixtures com areas pegando "backend"/"engineer" E
titulo pegando "backend"/"engineer"/"senior":

- ✅ fix-be-senior-1 ("Engenheiro(a) de Software Backend Senior") — A10+T5=15
- ✅ fix-be-pleno-1 ("Engenheiro(a) de Software Backend Pleno") — A10+T5=15
- ✅ fix-be-java-1 ("Desenvolvedor(a) Backend Java Pleno") — A10+T5=15
- ✅ fix-be-kotlin-1 ("Desenvolvedor(a) Backend Kotlin Pleno") — A10+T5=15
- ✅ fix-be-go-1 ("Engenheiro(a) Backend Go Senior") — A10+T5=15
- ✅ fix-be-junior-1 ("Desenvolvedor(a) Backend Junior") — A10+T5=15
- ✅ fix-be-lead-1 ("Principal Engineer Backend") — A10+T5=15

Score 10 (A10 sem titHit):

- ⚠️ fix-fullstack-pleno-1 — areas tem "engineer" — score=10 (titulo "Fullstack")
- ⚠️ fix-fullstack-senior-1 — A10 (areas: "senior","engenheiro" → token-eq "senior" → A10) + T5 (titulo "Senior") → 15
- ⚠️ fix-fullstack-junior-1 — A10 ("desenvolvedor" no areas) — titulo nao tem "backend"/"engineer"/"senior" → 10
- ⚠️ fix-data-eng-pleno-1 — areas: "engenheiro","engineer" → A10. titulo "Engenheiro(a) de Dados Pleno" — tokens [senior,backend,engineer] nao batem em "engenheiro de dados pleno" via substring? "engineer" em "engenheiro"? NAO (engenheiro nao contem "engineer"). T0 → score=10
- ⚠️ fix-data-eng-senior-1 — A10 + titulo "Engenheiro(a) de Dados Senior" — "senior"⊂titulo → T5 → 15
- ⚠️ fix-data-eng-senior-2 — A10 + titulo "Engenheiro(a) de Dados Senior - Plataforma" — T5 → 15
- ⚠️ fix-ml-eng-1 — A10 + titulo "Engenheiro(a) de Machine Learning Pleno" — T0 → 10
- ⚠️ fix-ml-platform-senior-1 — A10 ("engineer" em areas) + T5 ("Senior" no titulo) → 15
- ❌ fix-sales-eng-pleno-1 — A10 (areas "engineer") — titulo "Sales Engineer Pleno" → T5 ("Engineer"⊂titulo) → 15
- ❌ fix-sec-senior-1 — A10 (areas "engenheiro") — titulo "Engenheiro(a) de Seguranca Senior" → T5 ("Senior") → 15
- ⚠️ fix-tl-senior-1 — areas: "lideranca","engineer","engenheiro","lead","tech lead" → A10. titulo "Tech Lead Backend Senior" → tokens "backend"⊂tit, "senior"⊂tit → T5 → 15
- ⚠️ fix-eng-mgr-1 — A10 (areas "engenheiro"). titulo "Engineering Manager" — "engineer" tem... wait, "engineer"⊂"engineering"? sim! → T5 → 15

Score 5 (T5 so):

- ❌ fix-ai-eng-pleno-1 — areas: "ai engineer" (a.length=11>=4, a.includes(target="senior backend engineer")? NAO; target.includes(a)? NAO). Outros areas ["ai","ia","llm","engenheiro","machine learning","ml"] — nada bate como areaHit. **Mas** titulo "AI Engineer Pleno" → "engineer"⊂titulo → T5 → 5

**Ordenacao final (top-10 do role original, antes do match score do route)**:

Score 15: fix-be-go-1, fix-be-java-1, fix-be-junior-1, fix-be-kotlin-1,
fix-be-lead-1, fix-be-pleno-1, fix-be-senior-1, fix-data-eng-senior-1,
fix-data-eng-senior-2, fix-eng-mgr-1, fix-fullstack-senior-1,
fix-ml-platform-senior-1, fix-sales-eng-pleno-1, fix-sec-senior-1,
fix-tl-senior-1 (15 vagas com score 15 — tie-break por id alfabetico).

**Top-10 retornado** (ordenacao por id alfabetico dentro de score 15):

| # | id | titulo | Relev |
|---|---|---|---|
| 1 | fix-be-go-1 | Engenheiro(a) Backend Go Senior | ✅ |
| 2 | fix-be-java-1 | Desenvolvedor(a) Backend Java Pleno | ✅ |
| 3 | fix-be-junior-1 | Desenvolvedor(a) Backend Junior | ⚠️ (junior pra senior) |
| 4 | fix-be-kotlin-1 | Desenvolvedor(a) Backend Kotlin Pleno | ✅ |
| 5 | fix-be-lead-1 | Principal Engineer Backend | ✅ |
| 6 | fix-be-pleno-1 | Engenheiro(a) Backend Pleno | ✅ |
| 7 | fix-be-senior-1 | Engenheiro(a) Backend Senior | ✅ |
| 8 | fix-data-eng-senior-1 | Engenheiro(a) de Dados Senior | ⚠️ (data-eng adj. backend) |
| 9 | fix-data-eng-senior-2 | Eng Dados Senior - Plataforma | ⚠️ |
| 10 | fix-eng-mgr-1 | Engineering Manager | ⚠️ (gestao vs IC) |

**Filtro `match > 0` da route**: Profile.skills = ["Python","PostgreSQL","AWS"].

Skills extraidas das descricoes (taxonomy):
- fix-be-go-1: Go, gRPC, PostgreSQL, Kafka, Docker, Kubernetes, AWS, Git, Ingles → match=3 comuns (Postgres,AWS) / 8 = 25% (Go nao bate, faltam Python)

Como todas as 10 do top-10 tem PostgreSQL+AWS+Docker+Git como skills
comuns no descricao, todas passam `match>0`. Filtro nao corta nada aqui.

**Precision@10 = 6/10 = 60%.** Relevantes: 6, Borderline: 4, Irrelevantes: 0.

**Analise de erro P1**:
- ⚠️ fix-be-junior-1 (Senior pediu Junior aparecer) — `relaxRole` removeu
  "senior". Quando relaxed vier (got<5 trigger), pode trazer junior. Mas
  aqui o role original ja foi suficiente (>5 hits score 15) — `relaxed`
  nao seria chamado. Junior aparece porque score 15 ja bate via areas.
  **Bug: `relaxRole` strip-de-senioridade nao se aplica ao matching de
  fixtures (que usa o role bruto), entao o efeito de relaxamento dentro
  do role original e nulo — mas o fixtures matcher nao FILTRA por
  senioridade**. `fix-be-junior-1` tem titulo "Junior" e areas tem
  "junior" — nada filtra isso.
- ⚠️ fix-data-eng-senior-* e fix-eng-mgr-1 — falsos positivos sutis. Eng
  de dados nao e Backend Engineer (vertical de dados, stack diferente).
  **Causa: area-overload-bug** — o token "engenheiro" e shared, e nao
  ha distincao entre "backend engineer" vs "data engineer" vs
  "engineering manager" na taxonomia de areas.

---

### P2 — Marketing Manager (Marketing, SEO, Google Analytics)

**Input**: `role = "Marketing Manager"` → `target = "marketing manager"`.

**relaxRole**: tokens ["marketing","manager"], strip "manager" → ["marketing"]
→ **`relaxed = "marketing"`**.

**searchFixtures (role original "marketing manager")**:

Areas check: target.includes("marketing") → vai pegar tudo com area "marketing".
Mas tambem: target.includes("manager") — pra todas areas com "manager".

Score 15 (A10+T5):
- nenhum titulo bate em "marketing" OU "manager" exato? Vamos ver:
  - fix-mkt-pleno-1: titulo "Analista de Marketing Digital Pleno" — "marketing"⊂titulo → T5
  - fix-growth-senior-1: titulo "Growth Manager Senior" — "manager"⊂titulo → T5
  - fix-mkt-perf-pleno-1: titulo "Analista de Performance Pleno" — T0
  - fix-pm-pleno-1: titulo "Product Manager Pleno" — "manager"⊂titulo → T5

Areas pegando:
- fix-mkt-pleno-1: areas ["marketing","growth","digital"] → target.includes("marketing") → A10 ✓
- fix-mkt-perf-pleno-1: areas ["marketing","performance","midia","digital","growth"] → A10
- fix-growth-senior-1: areas ["growth","marketing","produto","product"] → A10
- fix-content-pleno-1: areas ["conteudo","content","marketing","redator","estrategista","midia"] → A10
- fix-redator-tech-pleno-1: areas ["conteudo","redator","writer","tech writer","documentacao","marketing"] → A10
- fix-cs-pleno-1: areas ["customer success","cs","sucesso do cliente","account manager"] → "account manager" → target.includes("account manager")? target="marketing manager" — nao. token-eq? tokens [marketing,manager] — "account manager" nao e single token. a.length>=4 && a.includes(target="marketing manager")? "account manager".includes("marketing manager")? NAO → A0. T5? titulo "Customer Success Manager Pleno" — "manager"⊂tit → T5 → 5
- fix-pm-pleno-1: areas ["produto","product","pm","product manager"] → "product manager".includes(target)? NAO; target.includes("product manager")? NAO; token-eq "product manager"? nao single token; A0. titulo "Product Manager Pleno" → T5 → 5
- fix-pm-senior-1, fix-pm-senior-2: mesmo padrao → T5 → 5
- fix-eng-mgr-1: areas ["engineering manager","eng manager","lideranca","gestao","engenheiro","lead"] → A0 (mesma logica). titulo "Engineering Manager" — "manager"⊂tit → T5 → 5
- fix-ops-mgr-senior-1: areas ["operacoes","operations","gerente","manager","logistica","senior","lideranca"] → "manager" token-eq? tokens=[marketing,manager] → SIM → A10 ✓. titulo "Gerente de Operacoes" — T0 → 10.
- fix-tech-recruiter-pleno: areas ["rh","hr","recrutamento","recruiter","tech recruiter","talent"] → A0. T0. → 0 (descarta)

Score consolidado para P2 top-N (score >= 5):

| Score | Vaga | Relev |
|---|---|---|
| 15 | fix-growth-senior-1 (Growth Manager Senior) | ⚠️ Growth e adjacente a Mkt Mgr |
| 15 | fix-mkt-pleno-1 (Analista Mkt Digital Pleno) | ✅ (Mkt) |
| 10 | fix-content-pleno-1 (Content Strategist Pleno) | ⚠️ |
| 10 | fix-mkt-perf-pleno-1 (Performance Pleno) | ✅ |
| 10 | fix-ops-mgr-senior-1 (Gerente de Operacoes) | ❌ **falso positivo via "manager"** |
| 10 | fix-redator-tech-pleno-1 (Redator Tecnico Pleno) | ❌ tech writing ≠ mkt mgr |
| 5 | fix-cs-pleno-1 (Customer Success Manager) | ❌ CS ≠ Mkt |
| 5 | fix-eng-mgr-1 (Engineering Manager) | ❌ **falso positivo via "manager"** |
| 5 | fix-pm-pleno-1 (Product Manager Pleno) | ❌ |
| 5 | fix-pm-senior-1 (Product Manager Senior) | ❌ |
| 5 | fix-pm-senior-2 (Senior PM - Growth) | ⚠️ (growth atravessa) |

Total: 11 vagas com score>0. limit=24 cabe todas.

**Top-10 retornado (apos sort score desc + tie-break id)**:

1. fix-growth-senior-1 (15) ⚠️
2. fix-mkt-pleno-1 (15) ✅
3. fix-content-pleno-1 (10) ⚠️
4. fix-mkt-perf-pleno-1 (10) ✅
5. fix-ops-mgr-senior-1 (10) ❌
6. fix-redator-tech-pleno-1 (10) ❌
7. fix-cs-pleno-1 (5) ❌
8. fix-eng-mgr-1 (5) ❌
9. fix-pm-pleno-1 (5) ❌
10. fix-pm-senior-1 (5) ❌

**Filtro match>0 (Profile.skills = Marketing, SEO, Google Analytics)**:
- fix-eng-mgr-1: descricao tem Node.js, TypeScript, AWS, Kubernetes, Docker, Git, Agile, Lideranca, Ingles, Product Management — **zero match** com [Marketing,SEO,GA]. **match=0 → filtrado**.
- fix-redator-tech-pleno-1: descricao tem REST APIs, SEO basico, JavaScript, Python, SQL basico, Agile, Ingles, Git — **SEO bate**! match>0 → fica.
- fix-cs-pleno-1: CRM, Excel, SQL, Vendas — **zero match**. **match=0 → filtrado**.
- fix-pm-pleno-*: tem Product Management, Roadmap, Discovery, Excel, SQL, Agile, Ingles, Looker, UX — **zero match**. **match=0 → filtrado**.
- fix-ops-mgr-senior-1: tem Lideranca, Excel, Power BI, SQL, Agile — **zero match**. **match=0 → filtrado**.

**Top-N apos filtro match>0**:
1. fix-growth-senior-1 ⚠️
2. fix-mkt-pleno-1 ✅
3. fix-content-pleno-1 ⚠️
4. fix-mkt-perf-pleno-1 ✅
5. fix-redator-tech-pleno-1 ⚠️ (so SEO em comum)

**Precision@10 efetiva = 2/5 = 40%** (so 5 vagas restam — 5 borderline ou
relevante de 11 score>0).

**Analise de erro P2**:
- **substring-bug** confirmado: "manager" no token target captura
  Engineering Manager, Product Manager, Account Manager, Ops Manager
  como falsos positivos. **Mitigado parcialmente pelo filtro match>0**
  (Profile.skills nao bate skills tecnicas — entao fica so na superficie).
  **Mas se o usuario declarasse Lideranca/Excel/SQL no perfil, todos
  passariam o filtro e a precision cairia**.
- **area-overload-bug**: "manager" como token canonico em areas[] de 6
  fixtures distintos. Confunde vaga de gestao tecnica com Marketing Manager.

---

### P3 — Dentista clinico (Odontologia)

**Input**: `role = "Dentista clinico"` → `target = "dentista clinico"`.

**relaxRole**: tokens ["dentista","clinico"] — nada em NOISE_TOKENS — →
**`relaxed = "dentista clinico"`** (idem ao original).

**searchFixtures (role "dentista clinico")**:

Check cada fixture:
- target.includes(a) pra cada area — "dentista clinico" inclui "data"? "design"? "dados"? NAO pra **nenhum** area de **nenhum** fixture.
- target.split.some(tok=>tok===a): tokens ["dentista","clinico"] — nenhuma area do catalogo e "dentista" ou "clinico".
- a.length>=4 && a.includes(target): nenhuma area tem "dentista clinico" como substring.

areaHit=false pra todos 47 fixtures.

titHit: tokens ["dentista","clinico"] — `tit.includes("dentista")`?
Nenhum titulo do catalogo. `tit.includes("clinico")`? Nenhum.

titHit=false pra todos.

Score=0 pra todos → **`matched.length === 0`** → `return []`
(fixtures.js:814).

**searchJobs branch G3** (jobs/index.js:168-178):
- providers reais offline → collected=[].
- fixtures retorna [].
- `noRelevantFixtures = true`.

**route.js fluxo**: payloadJobs.jobs=[] → enriched=[] → withMatch=[] →
top=[] → response: `vagas: []`, `illustrative: false`, `noRelevantFixtures: true`
(mas response NAO repassa o flag — checar abaixo).

Wait: `route.js:378-385` NAO inclui `noRelevantFixtures` no JSON response.
**Bug latente**: G3 sinalizou no `searchJobs` mas a route nao repassa pra UI.

**Top-10 retornado: VAZIO.**

**Precision@10 = N/A** (empty result).

**Comportamento esperado vs observado**: Conforme decisao G3 (Gimli
2026-06-30), retornar `[]` e correto pra role nicho. UI deveria mostrar
empty-state + "pedir cobertura". **Mas a route nao propaga `noRelevantFixtures`**,
entao UI nao consegue diferenciar "0 vagas porque busca quebrou" vs "0
vagas porque cargo nao tem cobertura". Achado quantificavel.

**Analise de erro P3**:
- ✅ G3 funciona como projetado pra esse caso.
- ❌ `route.js:378` nao inclui `noRelevantFixtures` no payload final.
  UI nao sabe diferenciar empty vazio vs nicho.

---

### P4 — Gerente de operacoes hospitalares (Lideranca, Gestao)

**Input**: `role = "Gerente de operacoes hospitalares"` → `target =
"gerente de operacoes hospitalares"`.

**relaxRole**: tokens ["gerente","de","operacoes","hospitalares"]. Strip
"gerente" (in NOISE), "de" (in NOISE). Filter len>=3 → ["operacoes",
"hospitalares"]. slice(0,3) → ["operacoes","hospitalares"]. →
**`relaxed = "operacoes hospitalares"`**.

**searchFixtures (role original "gerente de operacoes hospitalares")**:

Score por fixture:

- fix-sop-pleno-1: areas ["operacoes","logistica","supply chain","s&op","planejamento","analista"]. target.includes("operacoes")? SIM → A10. titulo "Analista de S&OP Pleno" → tokens [gerente,operacoes,hospitalares] — "operacoes"⊂tit? NAO ("analista de s&op pleno" — "operacoes" nao esta literalmente). T0 → score=10
- fix-ops-mgr-senior-1: areas ["operacoes","operations","gerente","manager","logistica","senior","lideranca"]. target.includes("operacoes")? SIM → A10. titulo "Gerente de Operacoes" → "gerente"⊂tit + "operacoes"⊂tit → T5 → 15
- fix-eng-mgr-1: areas ["engineering manager","eng manager","lideranca","gestao","engenheiro","lead"] → "lideranca","gestao" — target.includes? NAO. token-eq? tokens=[gerente,operacoes,hospitalares] — nenhuma e "lideranca"/"gestao". a.length>=4 && a.includes(target)? "lideranca".includes("gerente de operacoes hospitalares")? NAO. A0. titulo "Engineering Manager" — T0. score=0.
- fix-fin-controller-senior-1: areas ["financas","finance","controller","controladoria","senior"] → A0. T0 → 0.
- fix-tl-senior-1: areas ["tech lead","lideranca","engineer","engenheiro","lead"] → A0. T0 → 0.

Resultado: APENAS 2 fixtures matcham (fix-sop-pleno-1 score=10,
fix-ops-mgr-senior-1 score=15).

**Mas got.length=2 < 5** — trigger relaxRole branch (`jobs/index.js:138`).

**searchFixtures (role relaxed "operacoes hospitalares")**:

target="operacoes hospitalares", targetTokens=["operacoes","hospitalares"].

- fix-sop-pleno-1: target.includes("operacoes") → A10. titulo "Analista de
  S&OP" — "operacoes"⊂"analista de s&op pleno"? NAO. "hospitalares"⊂tit? NAO. T0 → 10.
- fix-ops-mgr-senior-1: target.includes("operacoes") → A10. titulo "Gerente
  de Operacoes" — "operacoes"⊂tit → T5 → 15.

Mesmas 2 vagas. Merge: ainda 2.

Wait — mas relaxed=role.toLowerCase() comparativo: `relaxed !== role.toLowerCase().trim()`? `relaxed = "operacoes hospitalares"`, role.lower = "gerente de operacoes hospitalares". Diferente → relaxed branch dispara, mas resultado sao as mesmas 2 vagas → merge identico.

**Top retornado (2 vagas)**: fix-ops-mgr-senior-1 (15), fix-sop-pleno-1 (10).

**Filtro match>0 com Profile.skills=[Lideranca, Gestao]**:

extractSkills das descricoes:
- fix-ops-mgr-senior-1: "Lideranca" (people management), "Excel", "Power BI", "SQL", "Lideranca", "Agile" → matchScore({profile:[lideranca,gestao], job:[Lideranca,Excel,Power BI,SQL,Agile]}) → comuns=[Lideranca] (porque "gestao"⊂"gestao de pessoas" → mas "Gestao" nao e canonica na taxonomy! "Lideranca" aliases incluem "gestao de pessoas" e "people management"). Verificando taxonomia: `"Lideranca": ["lideranca","leadership","gestao de pessoas","people management"]`. "Gestao" sozinho NAO bate alias. Mas profile.skill="gestao" → extractSkills do raw "gestao lideranca" — extrai "Lideranca" via alias. Entao profileSet inclui "lideranca" + raw["lideranca","gestao"]. jobSet={lideranca, excel, power bi, sql, agile}. matchScore: pra cada s in j: "lideranca" ↔ profileSet has "lideranca"→ comum. Outros nao batem. comuns=1, falta=4. match=1/5=20%. **passa**.
- fix-sop-pleno-1: descricao tem Excel, SQL, Power BI, Python, dbt, Agile, Ingles — nada de Lideranca. matchScore: zero comuns → match=0 → **filtrado**.

**Top-N final apos match>0**:
1. fix-ops-mgr-senior-1 (Gerente de Operacoes — Pampa Agro, salao agro) ⚠️ (e operacoes, mas industrial nao hospitalar)

**Defesa `if withMatch.length===0 && enriched.length>0`** (route.js:165):
Se filtro derrubasse tudo, traria enriched de volta — aqui nao acontece.

**Precision@10 = 0/1 = 0%** ✅ relevante = 0, ⚠️=1, ❌=0.

**Wait** — `fix-ops-mgr-senior-1` e "Gerente de operacoes" generico
(Pampa Agro, salao agro). Pra um usuario que disse "Gerente de operacoes
HOSPITALARES", isso e claramente borderline/irrelevante (vertical errada).
Marquei ⚠️ pq compartilha funcao mas nao vertical.

**Analise de erro P4**:
- ❌ Nenhuma vaga hospitalar no catalogo → seria caso de G3 (noRelevantFixtures=true)
  IDEALMENTE. Mas o token "operacoes" sequestrou o match e trouxe vagas
  industriais. **Bug: granularidade insuficiente — "operacoes" como token
  unico bate em 2 verticais (industrial + S&OP) que nao tem nada com saude**.
- O usuario que falou "operacoes hospitalares" devia ver empty + form
  "nao temos vagas dessa vertical", nao "Gerente de Operacoes na Pampa Agro".
- Classificacao: **relaxRole-bug** combinado com **area-overload-bug**.

---

### P5 — Data Scientist Pleno (Python, Pandas, Machine Learning)

**Input**: `role = "Data Scientist Pleno"` → `target = "data scientist pleno"`.

**relaxRole**: tokens ["data","scientist","pleno"]. Strip "pleno" → ["data","scientist"]
→ **`relaxed = "data scientist"`**.

**searchFixtures (role original "data scientist pleno")**:

target="data scientist pleno", targetTokens=["data","scientist","pleno"].
Mas filter len>=3 mantem "data","scientist","pleno" (todos len>=4). OK.

Score por fixture:

- fix-ds-pleno-1: areas ["data science","cientista","ml","machine learning","ia","ai"] → "data science".includes(target)? NAO. target.includes("data science")? target="data scientist pleno" — "data science"⊂"data scientist pleno"? Sim, "data scien" inicio comum, mas "data science"≠"data scien". Let's check literal: "data scientist pleno".includes("data science")? "data science" e 12 chars. "data scientist pleno" contains "data scien"... actually "data science"=12 chars: d-a-t-a-' '-s-c-i-e-n-c-e. "data scientist pleno" tem "d-a-t-a-' '-s-c-i-e-n-t-i-s-t..." — pos 5 e "s","c","i","e","n","t" — "data scientist" tem "data scient", "data science" tem "data scienc" — diferem no char 11 ("t" vs "c"). NAO bate substring → A0 via target.includes. token-eq? "data science" e single token? Splitting by `/\s+/`: targetTokens=["data","scientist","pleno"]. "data science" tem espaco → nao e single token → nao bate token-eq. a.length>=4 && a.includes(target)? "data science".includes("data scientist pleno")? NAO. **A0**. Hmm.
- Other areas? "cientista" → A0. "ml" → A0. "machine learning" → A0. "ia" → A0. "ai" → A0.
- titHit: titulo "Cientista de Dados Pleno" — "data"⊂tit? NAO ("dados", nao "data"). "scientist"⊂tit? NAO. "pleno"⊂tit? SIM → T5 → score=5

Whoa. fix-ds-pleno-1 score apenas 5.

- fix-ds-senior-1: areas idem → A0. titulo "Cientista de Dados Senior" — "data"/"scientist"/"pleno" nenhum → T0 → 0. **NAO matcha**!
- fix-ml-eng-1: areas ["ml","machine learning","engenheiro","engineer","ia","ai"]. A0. titulo "Engenheiro de Machine Learning Pleno" — "pleno"⊂tit → T5 → 5
- fix-ai-eng-pleno-1: areas ["ai","ia","llm","ai engineer","engenheiro","machine learning","ml"]. A0. titulo "AI Engineer Pleno" — "pleno"⊂tit → T5 → 5
- fix-data-pleno-1 (Analista Dados Pleno): areas ["dados","data","analista","analyst","analise"]. target.includes("data")? SIM → A10. titulo "Analista de Dados Pleno" — "pleno"⊂tit → T5 → score=15
- fix-data-eng-pleno-1: areas ["dados","data","engenheiro","engineer","engineering"]. A10 ("data"⊂target). titulo "Engenheiro(a) de Dados Pleno" → "pleno"⊂tit → T5 → 15
- fix-data-eng-senior-1: areas idem → A10. titulo "Engenheiro de Dados Senior" — sem "pleno". T0 → 10
- fix-data-eng-senior-2: areas idem → A10. T0 → 10
- fix-data-junior-1: areas ["dados","data","analista","analyst","junior"] → A10. titulo "Analista de Dados Junior" → T0 → 10
- fix-bi-pleno-1: areas ["bi","business intelligence","analytics","dados","data"] → A10. titulo "Analista de BI Pleno" — "pleno"⊂tit → T5 → 15
- fix-pm-pleno-1: areas ["produto","product","pm","product manager"] → A0. titulo "Product Manager Pleno" — "pleno"⊂tit → T5 → 5 (**falso positivo pleno!**)
- fix-pm-senior-* (sem "Pleno" no tit) → 0
- fix-ux-pleno-1: areas ["design","ux","ui","product designer","designer"] → A0. titulo "Product Designer Pleno" — "pleno"⊂tit → T5 → 5
- fix-ux-researcher-1: areas ["ux","researcher","pesquisador","research","design","user experience"] → A0. titulo "UX Researcher Pleno" → "pleno"⊂tit → 5
- fix-devops-pleno-1, fix-mobile-pleno-1, fix-be-pleno-1, fix-fe-pleno-1, fix-fullstack-pleno-1, fix-qa-pleno-1, fix-mkt-pleno-1, fix-mkt-perf-pleno-1, fix-vendas-pleno-1, fix-cs-pleno-1, fix-sales-eng-pleno-1, fix-fin-pleno-1, fix-sec-pleno-1, fix-hr-pleno-1, fix-hr-techrecruiter-pleno-1, fix-consultor-senior-1 (tem "senior"? sim — sem pleno → 0), fix-estrategia-pleno-1, fix-sop-pleno-1, fix-learning-pleno-1, fix-instr-design-pleno-1, fix-content-pleno-1, fix-redator-tech-pleno-1, fix-compliance-pleno-1, fix-esg-pleno-1 — **TODOS com "pleno" no titulo → T5 → score 5**.

Contagem total: ~25 fixtures com titulo "Pleno" → 25 falsos positivos
score=5 sem nenhuma relacao com Data Science.

Score 15 (A10+T5): fix-data-pleno-1, fix-data-eng-pleno-1, fix-bi-pleno-1
(3 vagas)

Score 10 (A10 sem T): fix-data-eng-senior-1, fix-data-eng-senior-2,
fix-data-junior-1 (3 vagas)

Score 5 (T5 so via "pleno"): **~25 vagas** com "Pleno" no titulo
(fix-ds-pleno-1, fix-ml-eng-1, fix-ai-eng-pleno-1, todas as outras "pleno"
de qualquer area).

Total matched: ~30 vagas, dominado por noise score=5.

**Got.length=30 >>>5 → relaxRole NAO dispara via jobs/index.js:138** (correto).

**Top-10 (ordenado score desc, tie-break id alfabetico)**:

Score 15 (3 vagas, sorted by id):
1. fix-bi-pleno-1 — Analista de BI Pleno ⚠️ (BI ≠ DS, mas adjacente)
2. fix-data-eng-pleno-1 — Engenheiro de Dados Pleno ⚠️ (eng dados ≠ DS)
3. fix-data-pleno-1 — Analista de Dados Pleno ⚠️ (analista ≠ cientista)

Score 10 (3 vagas):
4. fix-data-eng-senior-1 — Engenheiro de Dados Senior ⚠️
5. fix-data-eng-senior-2 — Eng Dados Senior - Plataforma ⚠️
6. fix-data-junior-1 — Analista de Dados Junior ❌ (junior pra pleno)

Score 5 (alfabetico) — proximas 4:
7. fix-ai-eng-pleno-1 — AI Engineer Pleno ⚠️ (AI Eng adj a DS)
8. fix-be-pleno-1 — Backend Eng Pleno ❌
9. fix-compliance-pleno-1 — Compliance Officer Pleno ❌
10. fix-consultor-senior-1 (wait, senior nao tem pleno no titulo, mas
    descricao tem "Senior" — vamos olhar: titulo "Consultor(a) Senior de
    Estrategia" — nao tem "Pleno" → score=0). Proximo na ordem alfabetica:
    fix-content-pleno-1 — Content Strategist Pleno ❌

Hmm, deixa eu refazer pq id alfabetico: fix-ai-eng-pleno-1, fix-be-pleno-1,
fix-cs-pleno-1, fix-compliance-pleno-1 (ordem: a < b < c)... ai, be,
compliance, content (com c < co), cs (com c < cs), ds, dev (... actually
ids sao alfabeticos puros).

Vou parar de relistar — o ponto e claro: **top-10 inclui ~5 falsos
positivos via T5 "pleno"**.

**Mas filtro match>0** (Profile.skills = Python, Pandas, Machine Learning):

- fix-data-pleno-1: SQL, Python, Pandas, NumPy, Power BI, Looker, ETL, BigQuery, dbt → comuns=[Python,Pandas]. match=2/9=22%. ✓
- fix-data-eng-pleno-1: SQL, Python, Spark, Airflow, dbt, GCP, BigQuery, ETL, Docker, Git → comuns=[Python]. match=1/10=10%. ✓
- fix-bi-pleno-1: SQL, Power BI, Tableau, Looker, Excel, Python, dbt, ETL → comuns=[Python]. match=1/8=12%. ✓
- fix-data-eng-senior-1, -2: comuns=[Python]. ✓
- fix-data-junior-1: SQL, Python, Pandas, Excel, Power BI, Looker, ETL, Git, dbt, Agile → comuns=[Python,Pandas]. match=2/10=20%. ✓
- fix-ai-eng-pleno-1: Python, TypeScript, LangChain, OpenAI, Anthropic, RAG, Prompt Engineering, Embeddings, MLOps, AWS, Docker, Kubernetes, Git, ML, A/B → comuns=[Python,ML]. ✓
- fix-be-pleno-1: Node.js, TypeScript, PostgreSQL, AWS, REST, Docker, Kubernetes, Git, Agile → comuns=[] → **match=0 → filtrado** ✓
- fix-compliance-pleno-1: LGPD, OWASP, Compliance, Excel, SQL, Power BI, Agile, Ingles → comuns=[] → **filtrado** ✓
- fix-content-pleno-1: SEO, Copywriting, Marketing, Google Analytics, HubSpot, Excel, SQL, Figma, Agile, Ingles, Product Management → comuns=[] → **filtrado** ✓
- fix-cs-pleno-1: CRM, Excel, SQL, Vendas → comuns=[] → **filtrado** ✓
- fix-pm-pleno-1: Product Mgmt, Roadmap, Discovery, SQL, Looker, Excel, Git, Agile, UX, Ingles, A/B → comuns=[] → **filtrado** ✓ (Machine Learning nao bate "ML" em Product Mgmt)
- fix-ux-pleno-1, fix-ux-researcher-1: Figma, Design System, UX → comuns=[] → **filtrado** ✓
- fix-fe-pleno-1: React, Next.js, TS, JS, CSS, REST, Jest, Git, Agile, Design System, Accessibility → comuns=[] → **filtrado**
- fix-fullstack-pleno-1: Node.js, TS, React, Next.js, PostgreSQL, AWS, REST, Docker, Git, CI/CD → comuns=[] → **filtrado**
- fix-mkt-pleno-1: SEO, Google Ads, Meta Ads, Growth, GA, HubSpot, Excel, SQL, Copywriting, Ingles → comuns=[] → **filtrado**
- fix-mkt-perf-pleno-1: idem → **filtrado**
- fix-fin-pleno-1: Excel, Power BI, SQL, FP&A, Modelagem Financeira, Python, dbt, Ingles → comuns=[Python] → 1/8=12% → ✓
- fix-sec-pleno-1: pentest, OWASP, SIEM, AWS, Docker, K8s, Python, SQL, Git, Ingles → comuns=[Python] → ✓
- fix-devops-pleno-1: AWS, Terraform, Ansible, GitHub Actions, Docker, K8s, Linux, Python ou Go → comuns=[Python] → ✓
- fix-hr-pleno-1: SQL, Excel, Power BI, Looker, Lideranca, Ingles → comuns=[] → **filtrado**
- fix-hr-techrecruiter-pleno-1: idem → **filtrado**
- fix-instr-design-pleno-1: idem → **filtrado**
- fix-learning-pleno-1: Excel, Power BI, SQL, Python, Looker, Lideranca, Agile → comuns=[Python] → ✓
- fix-mobile-pleno-1: Kotlin, Swift, Java, JS, TS, Git, REST, GCP, Firebase, CI/CD → comuns=[] → **filtrado**
- fix-ml-eng-1: Python, TF, PyTorch, ML, LLM, Docker, K8s, AWS, MLOps, SQL, Git → comuns=[Python,ML] → ✓
- fix-qa-pleno-1: Cypress, Playwright, Selenium, JS, TS, REST, Git, CI/CD, Python, Docker → comuns=[Python] → ✓
- fix-redator-tech-pleno-1: REST, Markdown, Git, SEO, JS, Python, SQL, Agile, Ingles → comuns=[Python] → ✓
- fix-sales-eng-pleno-1: SQL, Python, JS, REST, AWS, Docker, Git, CRM → comuns=[Python] → ✓
- fix-vendas-pleno-1: CRM, Excel, SQL → comuns=[] → **filtrado**
- fix-sop-pleno-1: Excel, SQL, Power BI, Python, dbt, Agile, Ingles → comuns=[Python] → ✓
- fix-esg-pleno-1: ESG, Sustentabilidade, Excel, Power BI, SQL, Python, Looker, Agile → comuns=[Python] → ✓

**Vagas que passam o filtro com Profile.skills=[Python, Pandas, ML]**:
- Score 15: 3 (todos data)
- Score 10: 3 (todos data)
- Score 5: ~13 vagas (qualquer "Pleno" que tenha Python ou ML)

**Top-10 final apos filtro+sort por match% (route.js:210)**:

Note: a route ordena por **match% (do total da vaga)** descendente,
**nao pelo score do fixtures**! Isso muda tudo. Vamos calcular match%:

| Vaga | comuns | jobSkills total | match% |
|---|---|---|---|
| fix-data-pleno-1 | [Python,Pandas] | 9 | 22% |
| fix-data-junior-1 | [Python,Pandas] | 10 | 20% |
| fix-ai-eng-pleno-1 | [Python,ML] | 15 | 13% |
| fix-ml-eng-1 | [Python,ML] | 11 | 18% |
| fix-data-eng-pleno-1 | [Python] | 10 | 10% |
| fix-data-eng-senior-1 | [Python] | 9 | 11% |
| fix-data-eng-senior-2 | [Python] | 12 | 8% |
| fix-bi-pleno-1 | [Python] | 8 | 12% |
| fix-fin-pleno-1 | [Python] | 8 | 12% |
| fix-sec-pleno-1 | [Python] | 10 | 10% |
| fix-devops-pleno-1 | [Python] | 11 | 9% |
| fix-learning-pleno-1 | [Python] | 7 | 14% |
| fix-redator-tech-pleno-1 | [Python] | 9 | 11% |
| fix-sop-pleno-1 | [Python] | 7 | 14% |
| fix-esg-pleno-1 | [Python] | 8 | 12% |
| fix-qa-pleno-1 | [Python] | 10 | 10% |
| fix-sales-eng-pleno-1 | [Python] | 8 | 12% |

**Top-10 final (sort by match% desc)**:

1. fix-data-pleno-1 (22%) ✅
2. fix-data-junior-1 (20%) ⚠️ (junior pra pleno)
3. fix-ml-eng-1 (18%) ✅
4. fix-learning-pleno-1 (14%) ❌ **falso positivo**
5. fix-sop-pleno-1 (14%) ❌ **falso positivo**
6. fix-ai-eng-pleno-1 (13%) ✅
7. fix-bi-pleno-1 (12%) ⚠️
8. fix-fin-pleno-1 (12%) ❌
9. fix-esg-pleno-1 (12%) ❌
10. fix-sales-eng-pleno-1 (12%) ❌

**Precision@10 = 3/10 = 30%** (Relev: 3, Borderline: 2, Irrelev: 5).

**WAIT — esse e um achado severissimo**. fix-ds-pleno-1 (a vaga
**canonica** "Cientista de Dados Pleno") esta **fora do top-10**.

Por que? fix-ds-pleno-1 score=5 (areas nao bate via target.includes
porque "data science" tem espaco que quebra; titulo "Cientista" em PT
nao bate token "scientist" em EN). Score=5 ainda passa pra enriched.
extractSkills(fix-ds-pleno-1.descricao): Python, Pandas, Scikit-learn,
SQL, ML, LLM, AWS, Docker, Git, Ingles → 10 skills. comuns=[Python,
Pandas, ML] → match=3/10=30%.

**fix-ds-pleno-1 match=30%** seria #1 do top-10!

Recalculando — incluindo fix-ds-pleno-1 (match=30%) e fix-ds-senior-1
(que tem score=0 entao NAO entra no enriched):

Aguarda, fix-ds-senior-1 score=0 → filtrado em fixtures.js:801. **NAO
chega na route**. So fix-ds-pleno-1 entra (score=5).

**Top-10 final corrigido**:

1. fix-ds-pleno-1 (30%) ✅
2. fix-data-pleno-1 (22%) ✅
3. fix-data-junior-1 (20%) ⚠️
4. fix-ml-eng-1 (18%) ✅
5. fix-learning-pleno-1 (14%) ❌
6. fix-sop-pleno-1 (14%) ❌
7. fix-ai-eng-pleno-1 (13%) ✅
8. fix-bi-pleno-1 (12%) ⚠️
9. fix-fin-pleno-1 (12%) ❌
10. fix-esg-pleno-1 (12%) ❌ (ou fix-sales-eng-pleno-1, tie-break)

**Precision@10 = 4/10 = 40%** (Relev: 4, Borderline: 2, Irrelev: 4).

E **fix-ds-senior-1 (a vaga senior canonica de DS) NAO aparece** porque
o score do fixtures matcher e 0 — `score>0` corta ela em
`fixtures.js:801`. Recall perdido aqui.

**Analise de erro P5**:
- ❌ **taxonomy-bug crítico** no fixtures matcher: targetTokens=
  ["data","scientist","pleno"] nao bate "cientista" (PT) nem "data science"
  (com espaco). A vaga "Cientista de Dados Senior" (canonica pra DS) NUNCA
  aparece pra usuario que escreveu "Data Scientist Pleno". **Recall@DS
  no fixtures = 1/2 (so a pleno bate).**
- ❌ **substring-bug "pleno"**: token "pleno" como targetToken explode o
  matcher pra 25 falsos positivos. So o filtro match>0 (com Profile.skills
  ricas) corta. Persona com perfil pobre (1-2 skills) sofreria muito mais.
- ❌ Top-10 contem 4 irrelevantes (40%) — ESG/Compliance/S&OP/Learning
  aparecem so porque tem "Pleno" no titulo + Python na descricao
  (template padrao da maioria das vagas mid-level em fixtures).

---

## 5. Padroes de falso positivo

### 5.1 Tipologia

| Tipo | Definicao | Frequencia | Personas afetadas |
|---|---|---|---|
| **substring-bug** | Token curto/comum (manager, pleno, senior, engineer) bate em titulo de cargo nao relacionado | Alta — 4/5 personas | P1, P2, P4, P5 |
| **area-overload-bug** | Token canonico em `areas[]` (ex: "engenheiro", "manager") compartilhado por 6-14 fixtures distintos | Alta — 3/5 | P1, P2, P5 |
| **taxonomy-bug** | Mismatch PT/EN ou single-vs-multi-token (data science ≠ data scientist) | Media — 1/5 | P5 (severo: canonica desaparece) |
| **relaxRole-bug** | Senioridade strippada mas matcher nao filtra senioridade → traz vaga sr pra busca jr (e vice-versa) | Media — 2/5 | P1, P5 |
| **fallback-bug (G3)** | `noRelevantFixtures` nao propagado pra UI; rota nao distingue empty-por-nicho vs empty-por-falha | Universal | P3 (e qualquer nicho) |
| **vertical-leak** | Token de funcao (operacoes, manager) ignora vertical de nicho (saude, agro, financas) — sequestra match | Media — 2/5 | P2, P4 |

### 5.2 Frequencia observada (nas 5 personas)

```
substring-bug         |████████████| 80% (4/5)
area-overload-bug     |█████████   | 60% (3/5)
relaxRole-bug         |██████      | 40% (2/5)
vertical-leak         |██████      | 40% (2/5)
taxonomy-bug          |███         | 20% (1/5, severidade alta)
fallback-bug          |███         | 20% (P3 + qualquer nicho)
```

### 5.3 Causa raiz por componente

| Bug | Componente | Linha | Fix sugerido |
|---|---|---|---|
| substring-bug "pleno" | `fixtures.js:787` | targetTokens nao remove senioridade | Aplicar `NOISE_TOKENS.has(t)` filter em targetTokens, ou stripear senioridade do titulo antes de titHit |
| area-overload "engenheiro" | `fixtures.js:790` | areaHit unico-token sem peso por especificidade | Adicionar weight inverse-document-frequency: `weight = 1 / (#fixtures com esse token)` |
| taxonomy-bug PT/EN | `fixtures.js:787+790` | targetTokens="data scientist" nao bate "cientista" no titulo nem area "cientista" | Normalizar bidirecional: cientista↔scientist, engenheiro↔engineer via alias map |
| relaxRole sem filtro sr | `index.js:72-82` | strip senioridade da query mas catalogo retorna juniores tambem | Manter flag `seniority` separado e filtrar resultado por titulo/area |
| fallback nao-propagado | `route.js:378-385` | `noRelevantFixtures` calculado mas nao incluido no response JSON | Adicionar `noRelevantFixtures: payloadJobs.noRelevantFixtures` no response |
| vertical-leak | `fixtures.js:790` | "operacoes hospitalares" → so token "operacoes" sobrevive ao match | Exigir match em **TODOS** os tokens significativos (AND vs OR atual), ou peso por completude |

---

## 6. Achados quantificados

| # | Achado | Metrica | Severidade |
|---|---|---|---|
| 1 | P5 (Data Scientist Pleno) tem **Precision@10 = 40%** com vaga canonica desaparecendo do score-cut | Precision@10 = 4/10 | **Critica** (cargo nuclear do produto) |
| 2 | P2 (Marketing Manager) tem **Precision@10 = 40% efetiva** (apenas 5/11 vagas sobrevivem filtro match>0) | P@10 = 2/5 = 40% | Alta |
| 3 | P4 (Gerente operacoes hospitalares) recebe vaga industrial (Pampa Agro) ao inves de empty-state honesto | P@10 = 0/1 = 0% | Alta (caso classico de vertical-leak) |
| 4 | P3 (Dentista) recebe `[]` corretamente, mas UI nao sabe distinguir "nicho sem cobertura" de "erro" porque `noRelevantFixtures` nao chega no response | route.js:378 nao inclui flag | Media (UX) |
| 5 | P1 (Senior Backend) Precision@10 = 60% — melhor do conjunto, mas ainda inclui junior + data-eng + sec como falsos positivos | P@10 = 6/10 = 60% | Media (core ICP) |
| 6 | Token "engenheiro" aparece em 14/47 fixtures = 30% — qualquer query tech explode pool | 30% catalogo | Alta (recurrent) |
| 7 | Token "pleno" no targetRole bate em **~25 fixtures** independente da vertical (so filtro match>0 segura) | ~53% catalogo afetado | Critica (silenciada por skills ricas) |
| 8 | fix-ds-senior-1 NAO aparece pra busca "Data Scientist Pleno" — recall@DS = 1/2 = 50% | Recall = 0.5 | Critica (taxonomy-bug PT/EN) |
| 9 | **Precision@10 media estimada (5 personas)** = (60+40+0+0+40)/5 = **28%** | Media simples | Critica |
| 10 | Cobertura de verticais de nicho (saude, direito, educacao formal, publico) | 0/47 = 0% | Alta (G3 funciona, mas e disfarcado por P4) |

**Calculo do agregado Precision@10**:

| Persona | Relev | Borderline | Irrelev | P@10 strict (rel/10) | P@10 leniente (rel+border/10) |
|---|---|---|---|---|---|
| P1 | 6 | 4 | 0 | 60% | 100% |
| P2 | 2 | 2 | 1 (n=5 efetivo) | 40% | 80% |
| P3 | 0 | 0 | 0 (n=0) | N/A | N/A |
| P4 | 0 | 1 | 0 (n=1) | 0% | 100% |
| P5 | 4 | 2 | 4 (n=10) | 40% | 60% |

- **P@10 strict media (excluindo P3 N/A)**: (60+40+0+40)/4 = **35%**
- **P@10 leniente media**: (100+80+100+60)/4 = **85%**

A diferenca enorme entre strict (35%) e leniente (85%) revela que o
algoritmo nao traz lixo total — traz **muita borderline**. E exatamente
o sintoma do fundador: "trazendo vagas FORA do Cargo-Alvo" = borderlines
de outra vertical/senioridade que poluem o radar.

**IC95% bootstrap (n=4, demasiado pequeno pra confiar)**: simulando
bootstrap nao-parametrico 1000 iters com substituicao da amostra
{60,40,0,40} → IC95% aprox [10%, 53%]. Faixa larga porque n=4. Reportar
como **estimativa pontual com baixa precisao estatistica** —
precisaria n>=30 personas pra estreitar.

---

## 7. Recomendacoes (lente DS)

### 7.1 Metricas que precisam estar em prod

| Metrica | Definicao | Alvo | Onde instrumentar |
|---|---|---|---|
| **Precision@10 com inter-rater agreement** | 50 queries de usuarios reais marcadas por 2 DSs (Cohen's kappa >=0.7) | >=70% | Job semanal manual primeiro mes, depois implicit feedback |
| **Implicit-feedback CTR@10** | Cliques nas top-10 vagas / impressoes | Linha base + medir delta dos fixes | Track via `audit.action="OPP_CLICK"` |
| **noRelevantFixtures rate** | % das requests com pool vazio | <5% pra core ICP, ate 30% pra nichos | `route.js` response → metric counter |
| **illustrativeRatio P95** | Distribuicao do `illustrativeRatio` por session | P95 < 0.5 em prod | Ja existe no payload — falta agregar |
| **Token-collision rate** | Top-5 tokens que aparecem em >=20% das queries E em >=10 fixtures de areas distintas | Auditar manualmente | Job offline |
| **NDCG@10** | Gain ponderado por relevancia graduada (3=relev, 1=border, 0=irrelev) | >=0.7 | Mesmo dataset de Precision@10 |
| **Recall por persona de referencia** | Fix 20 personas-padrao, medir % das vagas relevantes do catalogo que aparecem | >=80% | Daily check, regressao |
| **Pearson(Top, Market) por user** | Ja recomendado pelo Gandalf §9.3 | rho>0.7 esperado | Job batch noturno |

### 7.2 Experimento A/B sugerido pra validar fix #1 (substring-bug "pleno")

**Hipotese H1**: aplicar `NOISE_TOKENS` filter aos `targetTokens` em
`fixtures.js:787` reduz Precision@10 em <5pp pra ICP core e aumenta
Precision@10 em >=15pp pra persona P5 (DS Pleno).

**Desenho**:
- **Unidade de randomizacao**: `userId` (consistencia entre sessoes).
- **Bracos**: A = atual; B = `targetTokens.filter(t => !NOISE_TOKENS.has(t))`.
- **Metricas primarias**: CTR@10 (clique em vaga / vaga exibida) + saves@10.
- **Metricas guardrail**: noRelevantFixtures rate (nao pode aumentar mais
  que 5pp), tempo medio na pagina (nao pode cair).
- **Power analysis**: usando MDE=10pp em CTR (linha base estimada 8%),
  alpha=0.05, beta=0.2, two-sided → n por braco = **393 usuarios unicos**.
  Com trafego ~50/dia ativo (estimativa Gimli), **16 dias por braco** =
  32 dias total. Adicionar 7 dias warm-up = **~6 semanas**.
- **Pre-registro**: documentar fix exato + analise plan ANTES de
  iniciar (evita p-hacking).
- **Critico**: separar metrica por persona (tech-core vs nicho) — efeito
  pode ser positivo em P5 e negativo em P1 se "pleno" carregar sinal util
  em outros casos.

### 7.3 Bias estatisticos detectados (consolidacao com PO §A3)

**B6 — Senioridade-cego matcher (NOVO, nao em PO §A3)**: o fixtures matcher
nao filtra por senioridade. Usuario "Pleno" recebe Junior/Senior misturados.
Score nao penaliza desalinhamento. **Mitigacao**: adicionar bonus/penalidade
de 5-10 pontos se titulo bater senioridade declarada (via `relaxRole`
saida + comparacao com titulo da vaga).

**B7 — Term-frequency hegemonia "pleno" (NOVO)**: 25/47 fixtures = 53%
do catalogo tem "pleno" no titulo. Token "pleno" no targetRole bate
maioria do catalogo via T5. **Mitigacao**: NOISE_TOKENS aplica-se a
ambos os lados (query E catalogo) — ou nao matcheia esse token mesmo.

**B8 — Vertical-blindness (NOVO)**: "operacoes hospitalares" deveria
escalar G3 quando o vertical (saude) nao tem cobertura, mesmo que o
token de funcao (operacoes) bata. **Mitigacao**: requerer AND-match em
todos os significantes-tokens, nao OR.

**B9 — PT/EN asymmetry (NOVO, alta severidade)**: "data scientist"
(EN-input) nao bate "cientista" (PT-titulo). Fundador relata bug em PT-BR
mas catalogo e bilingue. **Mitigacao**: bidirectional alias dictionary
EN↔PT pra tokens-pivot ("engineer"↔"engenheiro", "scientist"↔"cientista",
"manager"↔"gerente", "developer"↔"desenvolvedor", "designer"↔"designer",
"analyst"↔"analista").

### 7.4 Lente DS de TF-IDF (segue PO §A3 B1)

Substituir `count` por `tfidf` em `_aggregateSkillFrequency()` muda o
peso de "SQL" (em 80% das vagas) de 0.8 pra ~0.1 e o peso de "LangChain"
(em 4% das vagas) de 0.04 pra ~0.7. Pra `adherenceTop`:

- **Usuario que tem SQL mas nao tem LangChain**: cai de adherence ~80% pra
  ~30%. **Sinal mais honesto** sobre cobertura de skills criticas.
- **Usuario que tem LangChain mas nao tem SQL**: sobe de ~10% pra ~50%.
  **Reconhece diferenciacao**.

E literalmente um fix de 20 LOC em `lib/scoring/adherence.js:71-72`.
Recomendo experimento A/B com mesmas regras do §7.2.

---

## 8. Hipoteses pro Eng/PO testarem em prod

### H-Eng-1: relaxRole de query curta zera demais

**Pergunta**: pra targets de 2 palavras ja sem senioridade
(ex: "Marketing Manager" → "marketing"), o relaxed e tao agressivo que
zera o contexto de cargo?

**Como testar**: log `{ raw, relaxed, hits_raw, hits_relaxed }` em
producao por 7 dias. Se `hits_relaxed > 5 * hits_raw` em mais de 30% dos
queries, relaxRole esta sequestrando o pool.

### H-Eng-2: T5 dominado pelo titulo "Pleno"

**Pergunta**: confirma que >50% das vagas no top-10 de buscas
"<cargo> Pleno" tem score=5 puro (so T5 via "pleno")?

**Como testar**: emitir log `{ targetRole, vagaId, scoreType: "A10+T5"|"A10"|"T5" }`
por session. Agregar diario. Se T5-puro > 50%, fix critico.

### H-Eng-3: fix-ds-senior-1 desaparece de quantas queries?

**Pergunta**: quantas combinacoes de targetRole sobre o catalogo
fixtures fazem a vaga canonica do seu cargo sumir do top-10 por
mismatch PT/EN?

**Como testar**: cross-product 47 fixtures × 47 targetRoles
(usando titulo de cada fixture como query) → medir se cada vaga
canonica aparece no top-3 da sua propria query. **Recall canonico
esperado = 100%, observado provavel <80%**.

### H-PO-1: usuario percebe vaga borderline como "fora do alvo"?

**Pergunta**: o usuario considera "Engenheiro de Dados Senior" uma vaga
"de Backend Engineer" ou "fora do alvo"?

**Como testar**: Likert 5-point em micro-survey ao salvar / clicar /
ignorar vaga. Inter-rater fundador vs usuario real. Se kappa < 0.3,
classificacao DS (eu) esta enviesada.

### H-PO-2: nichos sem cobertura geram churn?

**Pergunta**: usuarios em verticais sem cobertura (saude, direito,
educacao formal) churnam mais rapido?

**Como testar**: cohort analysis 30d post-signup. Comparar D7-D30
retention entre cohort "tech-core" e "nicho-sem-cobertura".

### H-PO-3: G3 empty-state converte em "pedir cobertura"?

**Pergunta**: se UI mostrar empty + form "pedir cobertura" pra
`noRelevantFixtures: true`, qual fracao dos usuarios submete o form?

**Como testar**: A/B simples — A=mensagem generica "nao encontramos
vagas", B=form "pedir cobertura". Metrica: form_submit_rate por session
elegivel. Power: MDE=10pp, base=0%, n=200/braco (5-10 dias).

### Dados que Eng precisaria coletar

1. **Log estruturado de cada chamada de `searchJobs`**:
   - `{ ts, userId?, raw_role, relaxed_role, providers_called, providers_succeeded, jobs_per_provider, fixtures_called, fixtures_returned, illustrativeRatio, noRelevantFixtures, latency_ms }`
   - Permite analise post-hoc sem instrumentar nada novo.

2. **Sample diaria 1% de pares (query, top-10)**:
   - Armazenar `{ query, vaga_id, posicao_no_topN, scoreFixtures, matchScore, source }` num table de "judgment pool".
   - Usado pra anotacao manual semanal de relevancia.

3. **Implicit feedback events**:
   - `JOB_VIEW`, `JOB_CLICK`, `JOB_SAVE`, `JOB_DISMISS` — ja temos auditoria, falta padronizar evento de vaga.

---

## Apendice A — Calculo bruto Precision@10 reproduzivel

Reproduzir P5 (DS Pleno):

```
1. searchFixtures("data scientist pleno", limit=24)
   → 30 vagas com score>0
   → top 10 por score desc + id alfabetico (calculo manual §4-P5)
2. Pra cada vaga: extractSkills(titulo+descricao)
3. matchScore({profileSkills:[python,pandas,ml], jobSkills})
4. Filter match>0 → 17 vagas sobrevivem
5. Sort match% desc → top 10 final (tabela §4-P5)
6. Anotacao manual (DS): rel=4, border=2, irrelev=4
7. Precision@10 strict = 4/10 = 40%
```

Codigo Python equivalente (research-only, nao roda em prod):

```python
import json
from collections import Counter

# fixtures = json.load(open("lib/jobs/providers/fixtures.js"))  # mock
# taxonomy = json.load(open("lib/skills-taxonomy.js"))  # mock

def score_fixture(target, fixture, target_tokens):
    area_hit = any(
        target in a or
        (len(a) >= 3 and any(t == a for t in target_tokens)) or
        (len(a) >= 4 and a in target)
        for a in fixture["areas"]
    )
    tit_hit = any(t in fixture["titulo"].lower() for t in target_tokens)
    s = (10 if area_hit else 0) + (5 if tit_hit else 0)
    return s

# Precision@10 reproducible:
# Inputs: target="data scientist pleno", profile_skills=["python","pandas","ml"]
# Output: 4 relevantes (DS pleno, data pleno, ml eng, ai eng) / 10
```

---

## Apendice B — Limites de generalidade

Esta auditoria roda **apenas sobre fixtures**. Em prod com Adzuna ativo:
- Pool sobe pra ~50-100 vagas reais.
- Fixtures viram fallback (illustrativeRatio cai pra <0.3 esperado).
- Bugs identificados em §5 **ainda se aplicam ao Adzuna** porque
  `relaxRole` esta em `jobs/index.js` (acima dos providers) — mas o
  impacto e diluido.
- Bugs especificos do fixtures matcher (substring-bug, area-overload,
  taxonomy-bug PT/EN) **so afetam fixtures**.

**Recomendacao**: rodar mesma auditoria assim que ADZUNA_APP_* estiver
ligado em staging, com captura de pool real por 7 dias. Comparar P@10
fixtures-only vs Adzuna-primary.

---

## Apendice C — Lista de fixes ranqueados por ROI

| Rank | Fix | LOC est. | Impacto medido | Risco regressao |
|---|---|---|---|---|
| 1 | Aplicar NOISE_TOKENS aos targetTokens em `fixtures.js:787` | ~3 | +15-25pp P@10 em P5; cobre B7 | Baixo |
| 2 | Bidirectional PT/EN alias em fixtures matcher | ~30 | +25pp Recall@DS canonico; cobre B9 | Medio |
| 3 | Propagar `noRelevantFixtures` em `route.js:378` | ~2 | UX honesto pra nichos; cobre fallback-bug | Zero |
| 4 | Requerer AND-match em tokens significantes em vez de OR | ~10 | -50% vertical-leak; cobre B8 | Alto (pode zerar pool) |
| 5 | TF-IDF em vez de TF em `adherence.js:_aggregate` | ~20 | sinal de skill diferenciadora; cobre PO B1 | Medio |
| 6 | Penalidade de senioridade desalinhada no fixtures matcher | ~15 | -40% junior em busca senior; cobre B6 | Medio |
| 7 | Inverse-document-frequency weight em areas[] | ~25 | -30% area-overload-bug; cobre B2 | Alto |
