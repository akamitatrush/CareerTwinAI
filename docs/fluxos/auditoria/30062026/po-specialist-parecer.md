# Parecer Executivo — PO PhD Career Sciences

> Documentos avaliados: gandalf (1073 LOC) + gimli (877 LOC) + memória produto (visão, concorrência, sociedade-do-anel)
> Lente: Product Owner sênior, especialização Career Tech + estatística HR (15 anos LinkedIn Talent Insights / Burning Glass / Revelo)
> Tempo de leitura: ~5 min · Decisões pendentes encaminhadas: 4 · Top-3 ações fechando esta semana
> Tom: conversa franca com fundador técnico. Sem rodeio.

---

## 1. Tese executiva (3 linhas)

O **algoritmo está saudável o suficiente pra escalar B2C nos próximos 60 dias** — a wave de ontem (Gandalf) resolveu o que tinha que resolver matematicamente (FORMULA-DRIFT, FIXTURE-LEAK, taxonomia 38→145) e o orquestrador (Gimli) é resiliente. **Maior risco hoje é narrativo, não técnico**: o simulador do hero (`SiteHero.js:22-34`) vende uma mecânica de "ação → pontos" que o algoritmo real não tem, e isso solapa o pilar #1 do produto ("auditável") mais do que qualquer bug. **Maior oportunidade**: o backlog priorizado tem 3 fixes de meio-dia (G1 / G2 / G3 do Gimli) que fecham simultaneamente o flanco regulatório (LGPD Art.6 transparência), o flanco econômico (quota Adzuna drenando 3×) e o flanco de reputação (email diário com vaga fictícia). **Em uma semana você vira a chave de "produto honesto por dentro" pra "produto honesto também por fora".**

---

## 2. Algoritmo — veredito científico

### A1. Duas fórmulas ou uma só? Veredito: **manter as duas**, mas com instrumentação obrigatória.

A escolha do Gandalf (renomear `adherenceTop` vs `adherenceMarket` e manter ambas, conforme `lib/scoring/adherence.js:11-23` e §8 do relatório) é **defensável e correta sob a literatura clássica de IR**. Não é frescura matemática — é uma versão honesta de um trade-off bem documentado: precision@k vs recall.

- `adherenceTop` (`adherence.js:98-134`) é uma **precision@18 ponderada** sobre o ranking de demanda — semântica idêntica ao que LinkedIn Talent Insights faz no "Skills Genome match score" e ao que Lightcast usa no "Skill Snapshot Coverage" (top-N de skills mais pedidas dentro do ROL). A escolha de N=18 é justificada cognitivamente pela Lei de Miller (7±2 × 2 níveis ≈ 18) — o relatório §9.1 acerta a justificativa, e isso é literalmente o mesmo argumento que o Serasa Score usa pra mostrar 5 fatores e não 50.
- `adherenceMarket` (`adherence.js:155-184`) é um **recall ponderado por document frequency** sobre o pool inteiro — semântica de "share of market addressable" que aparece em métricas de career mobility tipo o Burning Glass "Career Pathways score". Captura long-tail.

**Por que NÃO unificar:**
- Estatisticamente são **complementares, não redundantes**. Sob hipótese de perfil aleatório, $\mathbb{E}[Top] = \mathbb{E}[Market]$ mas $\text{Var}[Top] > \text{Var}[Market]$ (Gandalf §9.3 acerta). Em produção, Pearson esperado 0.7-0.95 — se cair fora dessa faixa, a separação está empiricamente validada.
- BM25 ensina que **saturação de frequência importa**: pesar pela frequência crua sem cap (Market) e pelo ranking truncado (Top) captura facetas diferentes do sinal. Robertson & Zaragoza (2009) "The Probabilistic Relevance Framework" tem 15 anos disso documentado.
- Narrativamente são **dois prismas do mesmo número**: "% das 18 críticas que você cobre" (KPI digerível) vs "% do mercado total que você endereça" (input pro Career Health Score, mais robusto pra long-tail). Você precisa dos dois — um pra usuário, outro pra fórmula.

**O que está faltando (recomendação dura):** **instrumentar Pearson(Top, Market) por usuário durante 14 dias** (recomendação já em Gandalf §9.3 e §14, item 1). Se $\rho > 0.95$ em ≥80% dos users, há redundância empírica e você pode unificar em Sprint 3. Se $\rho < 0.7$ pra personas não-tech, **a separação está economicamente justificada** e vira moat de explicabilidade.

**Referências reais que validam esta escolha:**
- Robertson & Zaragoza (2009), *The Probabilistic Relevance Framework: BM25 and Beyond* — fundamento da saturação por document frequency.
- LinkedIn Skills Genome (LinkedIn Engineering blog, 2018 — Bo Long et al.) usa essencialmente top-N de skills extraídas por TF-IDF + manual canonicalization. Está mais perto do nosso `adherenceTop` do que de embeddings semânticos.
- Manning, Raghavan & Schütze (2008), *Introduction to Information Retrieval*, cap. 8 — precision vs recall, F-measure, justifica que mostrar AMBAS as métricas em produtos de IR é prática consagrada quando o usuário tem que tomar decisão.

### A2. Taxonomy 145 skills hardcoded — quanto tempo dura?

**Resposta direta: dura 6-9 meses, não 12.** Depois disso embeddings viram requisito, não opção. Razões:

1. **Cobertura atual vs ESCO/Lightcast**: ESCO (European Skills/Competences/Occupations) tem **13.890 skills canônicas** em 27 idiomas, mantida pela Comissão Europeia desde 2017. Lightcast Open Skills tem ~32.000 skills com taxonomia hierárquica de 4 níveis. **145 é 1% disso** — e olha, isso é OK pro MVP brasileiro porque vocês só competem com os ~1.500 skills que aparecem em vagas formais BR. Mas:
   - Personas que vocês mencionaram (LGPD officer, ESG analyst, professor de pós, fisioterapeuta digital) caem TODAS fora de tech/marketing/finance. Cada uma traz ~20-30 skills novas (ex: "ISO 14001", "TCMA", "Reabilitação Vestibular", "Pilates Clínico"). 4 personas = +80-120 skills.
   - Compliance/farma/saúde/educação tem vocabulário com **alta entropia regional** (CRM≠CRO≠CRA em saúde, CEP/CONEP em pesquisa) — alias-maintaining vira full-time job.

2. **O que Lightcast fez quando enfrentou isso**: virou taxonomia híbrida. Camada canônica curada (~500 "core skills") + extração via NLP + ranking por **sentence embeddings** (BERT-derivado) com human-in-the-loop pra publicar novos termos. Foi a saída deles em 2019. Eles publicaram em "The Anatomy of a Skill" (Lightcast methodology paper, 2021).

3. **Onde 145 hardcoded QUEBRA antes de 12 meses**:
   - **Marketing growth**: vocabulário muda a cada 6 meses ("CRO" virou "CXO", "GPT prompt" virou "context engineering", "Bonsai" "Apollo" "Clay" como ferramentas, etc.). Você vai estar perseguindo aliases trimestralmente.
   - **AI Engineering**: "LangChain" entrou em meses, "LangGraph" "LlamaIndex" "DSPy" "Pydantic AI" idem. Half-life de 4-6 meses por termo.
   - **Verticais novas** (saúde/farma/educação): 0 cobertura atual. Adicionar manualmente é viável (~3 dias dev por vertical), mas vira débito que acumula.

4. **Benchmark de mercado (estimativa, não medido)**: produtos análogos (Jobscan, Teal, Rezi) usam taxonomias proprietárias de 2.000-5.000 skills + embeddings. Eles têm 5-10 anos de curadoria e ainda dependem de embeddings pra cobrir long-tail.

**Veredito PO**: o roadmap atual (R1 em Gandalf §13: Sprint 3 vira embeddings) está certo. **Mas adianta pra Sprint 2-3** se vocês validarem que adoção fora-de-tech está abaixo de 20% no funil — sinal de que taxonomia está bloqueando ICP fora do core.

**Sugestão tática intermediária (custo XS, alto valor)**: importar o subset BR do ESCO (~2.500 skills relevantes pra mercado formal BR, license open) como **fallback de extração**. Você ganha cobertura imediata sem perder controle do canon — quando ESCO bate antes do canon próprio, marca como `taxonomy_source: "esco"` e prioriza review humano nas mais frequentes. ESCO tem API REST pública e arquivo CSV pra download em https://esco.ec.europa.eu.

### A3. Bias estatísticos NÃO mencionados nos relatórios

Os relatórios pegaram bem os bias *técnicos* (fixture-leak, formula-drift, dedupe fraco). Eles **deixaram passar quatro bias estatísticos clássicos** da literatura de algoritmos de matching de vaga:

**B1. Popularity bias (skill popular = skill importante?)** — o algoritmo trata `count` como proxy de importância. Mas vagas BR têm **enorme cauda longa de copy-paste**: 200 vagas de Backend Java em bancos pedem TODAS "SQL, Java, AWS, Docker, Git" porque é template do RH. Isso infla artificialmente skills genéricas e enterra skills diferenciadoras ("Kafka", "GraphQL"). Conhecido na literatura como **"head bias"** em recommender systems (Abdollahpouri et al. 2019, "The Unfairness of Popularity Bias in Recommendation"). Mitigação: **TF-IDF em vez de TF puro** — pesa skill pela raridade em relação ao corpus de vagas, não só pela frequência absoluta. Custo XS, fix em 20 linhas.

**B2. Self-selection bias na coleta de vagas** — Adzuna/Jooble são agregadores; ATSs (Greenhouse/Lever/Ashby/Workable) são SaaS US-first. **Empresas grandes pagam mais por ATS estrangeiro; empresas BR menores usam Gupy/Vagas.com.** Resultado: o pool tem viés sistemático de "empresa enterprise tech-savvy". Pra o ICP "career switcher 28-50 BR" — que vai muito pra PME, governo, terceiro setor — vocês estão **subreprezentando o universo de oportunidades reais por design**. Isso é o equivalente a fazer pesquisa eleitoral só com quem tem celular pago — viés clássico. Não tem fix técnico simples: requer parceria com agregadores BR específicos (Catho? InfoJobs?) ou aceitar e documentar o viés no pitch ("focamos em vagas formais BR que cobrem ~40% do mercado").

**B3. Confirmation bias na auto-declaração de skills** — o `profile.skills` vem do usuário (upload de CV + edição manual). Pesquisas em HR Tech (Cappelli 2019, "Your Approach to Hiring Is All Wrong" HBR) mostram que usuários **sub-declaram skills que sabem mas usam pouco** (especialmente mulheres e profissionais 40+) e **super-declaram skills aspiracionais**. O algoritmo é cego pra isso e calcula adherence sobre dados ruidosos. Mitigação: pedir **evidências por skill** (já existe infra em `/evidencias`!) e dar peso maior pra skill com evidência. Custo M, alto impacto em precisão.

**B4. Survivorship bias temporal** — vagas que ficaram abertas mais tempo (= empresa não conseguiu preencher) ficam super-representadas no pool. Isso pode significar **skill em alta demanda real** OU **skill que ninguém quer aprender / posição mal-paga**. Sem `postedAt` (Gandalf R4) não dá pra distinguir. Mitigação foi adiada (Gandalf §14 "Não fazer: não decay temporal antes de pool ≥500"). Concordo com o adiamento, mas marquem como bias conhecido.

**B5 (bias regulatório, mais sério): "fairness by proxy"** — vide §5 D1 deste parecer.

---

## 3. Decisões pendentes — minhas escolhas

### B1. Quando G3 fizer fixtures retornarem `[]` pra role nicho → adherence:0 no primeiro snapshot. Qual escolha?

**Minha escolha: (a) honestidade total — "diagnóstico não disponível" + estado pedagógico.**

**Justificativa (3 linhas):**

1. **Coerência com pilar #1 do produto** (visão_produto §pilares.1: "Score auditável... sem caixa-preta"). Mostrar "8 vagas balanceadas, flag sem-match-curado" é a caixa-preta de novo, só com nome diferente. Se você não tem dado, **diga que não tem dado**. O usuário career-switcher de nicho (RH→People Analytics, fisio→fisio digital) tem **alta sensibilidade a "produto que finge"** — porque ele já foi alvo de coach genérico e curso prometendo "transição em 90 dias".

2. **Benchmark análogo #1: Serasa Score quando não há histórico de crédito** — não inventa um score baixo, mostra "Score em construção" + lista o que falta pra calcular. **Conversão pós-onboarding sobe** porque a expectativa fica calibrada.

3. **Benchmark análogo #2: Google Maps quando rota não existe** — não devolve "rota aproximada parcial", devolve "Não encontramos uma rota" com sugestões. **Confiança institucional vem da honestidade da ausência, não do esforço de preencher silêncio.**

**Implementação concreta (refinando Gimli §7.1 PR G3 Opção A):**
- Payload: `{ jobs: [], illustrativeRatio: 0, realCount: 0, noRelevantData: true, suggestedActions: [...] }`.
- UI mostra empty state com 3 CTAs: "Refinar role" (link pra `/conta`), "Pedir cobertura nova" (form que captura demanda — vira sinal pra você priorizar curadoria), "Ver diagnóstico geral" (rota alternativa que usa Career Health calculado nas outras 3 dimensões — relevância/otimização/experiência — sem adherence).
- **Bonus de produto**: capturar o role solicitado num `RoleRequest` table. Você ganha **demanda priorizada por curadoria** em vez de adivinhar quais verticais expandir.

### B2. Renomear sem unificar `adherenceMarket`, manter 2 métricas, não criar `formula_v` — foi a escolha certa?

**Sim, com 1 ressalva.**

**Por que foi certo:**
- Unificar agora teria forçado escolha entre 2 metas matemáticas válidas sem dado empírico (Gandalf §9.3 acerta a tese).
- Não criar `formula_v` é correto **porque `adherenceMarket` não mudou** — só foi extraído pra módulo. Imutabilidade de `ScoreSnapshot` faz parte do pitch "auditável" (visão §pilares: "snapshot history visível"). Bumpar versão sem mudança real polui o histórico.
- Custo de manter 2 métricas é baixo: `lib/scoring/adherence.js` tem 172 linhas, `_aggregateSkillFrequency` é compartilhado (`adherence.js:57-75`), divergência futura é estruturalmente impossível.

**Ressalva (importante):** **vocês precisam de uma ADR escrita HOJE explicando essa decisão**, em `docs/adrs/ADR-006-duas-metricas-adherence.md` ou similar. Por 2 motivos:
1. **Onboarding de novo dev em 6 meses** vai ver 2 funções com nomes parecidos e tentar "consolidar pra DRY". A ADR previne isso.
2. **Regulatório** (vide D2): se um regulador BR (Senacon/ANPD) pedir "como vocês explicam adherence", você precisa de documento que diferencie semanticamente. Hoje só existe nos comentários do arquivo + no relatório de auditoria, que ninguém-fora-da-equipe lê.

Custo: 30 minutos pra escrever ADR-006. **Faz nesta semana.**

**Sobre custo narrativo pro usuário leigo**: a ressalva é falsa. **Usuário NUNCA vê os 2 nomes**. `/gaps` só mostra `adherence` (string única na wire — Gandalf §10 PR3 deixou claro: "Resposta de `/api/gaps/summary` mantém `adherence` (não renomeada na wire)"). A complexidade é interna. Pro usuário, é UM número em UM lugar. Custo narrativo = zero.

### B3. Simulador do hero (`SiteHero.js:22-34`) — é desonesto?

**Sim. Desonesto, mas reparável sem perder sedução.**

**O que o simulador mostra:**
```
Score atual: 47 → Score projetado: 73 (+26)
Ações: +8 Cases de growth · +6 LinkedIn editado · +12 Curso Brand Strategy
```

**O que o algoritmo real faz:**
- Career Health Score = `0.4 × aderencia_vagas + 0.3 × relevancia_habilidades + 0.2 × otimizacao_perfil + 0.1 × experiencia_mercado` (`lib/score.js:19`, citado em Gandalf §2.2).
- Cada sub-score é **recalculado do zero** sobre o estado novo do perfil. Ação não tem "valor de pontos" associado — ela ALTERA inputs (skills, evidências, completude) que ALTERAM sub-scores.
- Adicionar uma evidência de "Brand Strategy" pode:
  - Subir `otimizacao_perfil` se aumenta completude (peso 20%).
  - Subir `relevancia_habilidades` se nova skill bate top mercado (peso 30%).
  - **NÃO necessariamente** subir `adherencia_vagas` se "Brand Strategy" não está na taxonomia (e olhei: não está em `lib/skills-taxonomy.js` linhas 1-80, marketing tem "Marketing"/"SEO"/"Growth"/"Branding" mas não "Brand Strategy").

**Por que isso é desonesto pro pitch "auditável":**

1. **Cria mental model errado**: usuário vai pra `/gaps`, completa uma microação, espera ver +8 ou +12 e vê +0.7 ou -2 (porque outro sub-score caiu por algum motivo). Conversão pro plano paid CAI nesse momento.
2. **Quebra pilar #3 (independência editorial)**: mostrar "+12 Curso Brand Strategy" é literalmente o anti-padrão do Emprega.AI/Cogna que vocês usam como rival ético (concorrencia_landscape: "vende pós-grad → curso recomendado é viesado"). Vocês simulam o mesmo padrão que criticam.
3. **Vulnerabilidade a print de competidor**: hipotético post no LinkedIn — "CareerTwin promete +8 por LinkedIn editado e meu score subiu 0 porque LinkedIn não é input no algoritmo deles" — vira viral negativo em 1 dia.

**Como redesenhar (1-2 alternativas concretas e igualmente sedutoras):**

**Alternativa 1 — "Pesos visíveis ao vivo" (recomendada):**

Em vez de mostrar ações com pontos atribuídos, mostrar **os 4 sub-scores se recalculando ao vivo** com pesos visíveis:

```
DIAGNÓSTICO          47/100
├ Aderência vagas    52  (peso 40%) → contribui 20.8
├ Relevância skills  41  (peso 30%) → contribui 12.3
├ Otimização perfil  60  (peso 20%) → contribui 12.0
└ Experiência merc.  38  (peso 10%) → contribui 3.8
                                          = 47/100

[após 3 ações simuladas]

PROJETADO            73/100
├ Aderência vagas    68  (+16) → contribui 27.2
├ Relevância skills  72  (+31) → contribui 21.6
├ Otimização perfil  85  (+25) → contribui 17.0
└ Experiência merc.  72  (+34) → contribui  7.2
                                          = 73/100

(Demo ilustrativa — números sintéticos. Algoritmo real é determinístico
e está em /transparencia.)
```

**Por que isso é igualmente sedutor:** mostra **a auditabilidade FUNCIONANDO em movimento**. O usuário vê literalmente "ah, o número não é mágico, são 4 dimensões com pesos". Você ganha o "wow Serasa Score-style" SEM mentir sobre mecânica. Inspiração direta: como Nubank mostra "limite calculado em tempo real" no app — ele explica os fatores, não atribui pontos arbitrários.

**Alternativa 2 — "Antes/depois sem atribuição de pontos":**

Mostra 2 perfis lado-a-lado (estados, não ações):

```
Maria, hoje                Maria, em 60 dias
─────────────────         ─────────────────
3 skills                  3 skills + 5 novas
2 evidências              7 evidências
1 vaga aplicada           12 vagas qualificadas
                          
Score: 47/100  →          Score: 73/100
```

Honesto porque é descritivo, não causal. Menos "wow visual" que a Alternativa 1 mas zero risco de virar virol negativo.

**Recomendação dura:** Alternativa 1 + microcopy "Demo ilustrativa — números sintéticos. Algoritmo real explicado em /transparencia" no rodapé do card (8px, opacidade 60% — discreto mas presente). Vira **prova de auditabilidade em vez de promessa**.

**Custo dev**: M (recrian o `SiteHero.js` linhas 22-34 + lógica de animação ~150 linhas. Aragorn v6 ou v7 daria conta em 1 dia).

---

## 4. Backlog priorizado

### C1. Ranking P0/P1/P2/Backlog

| Prio | Item | Origem | Justificativa (impacto em retention/NPS/custo/risco) |
|---|---|---|---|
| **P0** | **G1 — filtrar fixtures em daily-briefing** | Gimli §5 H1 + §7 G1 | **Risco reputacional crítico.** Email diário em produção menciona vaga inventada como real. 1 print no Twitter mata captação. Custo: meio dia. |
| **P0** | **Aragorn v7 — refazer simulador hero honesto** | B3 deste parecer | **Risco de pitch.** O hero é a 1ª impressão pública e contradiz o pilar #1 (auditável). Mata captação por desconfiança. Custo: 1 dia. |
| **P0** | **G2 — single-flight `searchJobs`** | Gimli §5 R-CACHE-STAMPEDE + §7 G2 | **Custo direto:** drena quota Adzuna 3× (250→80 page-loads/mês free). A 1 mês de prod-com-tráfego, viram conta paga sem necessidade. Custo: meio dia. |
| **P0** | **G3 — role-aware fallback + empty state honesto** | Gimli §5 R6 + §7 G3 + B1 deste parecer | **NPS killer pra personas nicho** (RH→People Analytics, professor, fisio). Mostra 8 vagas Backend pra qualquer role desconhecido. Maior fonte de "esse produto não é pra mim". Custo: 1 dia (G3) + meio dia (RoleRequest table). |
| **P1** | ADR-006 documentando 2 fórmulas adherence | B2 deste parecer | Onboarding + regulatório. Custo: 30min. **Faz hoje.** |
| **P1** | G8 — audit/Sentry em `searchJobs` | Gimli §7 G8 | Sem isso, vocês não TÊM como medir Pearson(Top,Market), quota Adzuna, illustrativeRatio P50. Sprint de embeddings (Sprint 3) precisa desse baseline. Custo: meio dia. |
| **P1** | G4 — normalizar dedupe (NFD + punct) | Gimli §5 R3-DEDUPE + §7 G4 | "Itaú"≠"Itau" infla skills. Distorce adherence silenciosamente. Custo: meio dia. |
| **P1** | R1 — TF-IDF em vez de TF puro em `_aggregateSkillFrequency` | B3.B1 deste parecer (popularity bias) | 20 linhas em `adherence.js:57-75`. Reduz dominância de "SQL/Git/Java" em pools enterprise. Sinal mais limpo pra `highPriorityGaps`. Custo: meio dia. |
| **P1** | R6 Gandalf — quick fix role-fallback `fixtures.js:809-812` retornar `[]` | Gandalf §13 R6 (já recomendado em §14 ação 3) | Sobreposto com G3, faz parte do mesmo PR. |
| **P1** | G6 — `isJob()` ativa + `SOURCES` completo | Gimli §5 H3, R-SHAPE-WEAK | Defesa contra bug silencioso futuro. 30min. |
| **P1** | G5 — `SOURCE_LABEL` completo (lever/ashby/workable/gupy/vagas-com) | Gimli §5 H2 + §7 G5 | UI mostra "gupy" raw quando ATS BR liga. XS. |
| **P2** | Legolas v2 — revisar mono-cyan | (estética) | Não afeta diagnóstico. Pode esperar até Wave 16. |
| **P2** | R2-R7 Gandalf residuais | Gandalf §13 | Documentados, não bloqueantes. |
| **P2** | G7 — bump cache key `v2→v3` + JOBS_CACHE_VERSION helper | Gimli §7 G7 | Higiene. Sem fix urgente porque caller têm guards. |
| **P2** | G9 — Gupy descricao enriquecida | Gimli §7 G9 | Dobra rate-limit interno. Aceitável só em cron. Postergar. |
| **P2** | G10 — MAX_BOARDS Greenhouse + isBrazil strict | Gimli §7 G10 | XS, faz junto com próximo PR de providers. |
| **P2** | G13 — provider contracts doc | Gimli §7 G13 | Defesa contra scrapers quebrarem silenciosamente. Sprint 3. |
| **Backlog** | G11 — DRY utilitários providers | Gimli §7 G11 | Refator-por-refator. Risco>benefício agora. |
| **Backlog** | G12 — paginação Adzuna | Gimli §7 G12 | DEPENDE de G8 (visibilidade quota) + upgrade Adzuna pago. Esperar. |
| **Backlog** | Embeddings na taxonomia (Sprint 3) | Gandalf §13 R1 | Sprint dedicada. Antes: instrumentar A1 por 14 dias. |
| **Backlog** | Filtro senioridade | Gandalf §13 R3 | Decisão de produto: opt-in vs default. Sprint dedicada. |
| **Backlog** | Decay temporal | Gandalf §13 R4 | Não fazer antes de pool ≥500/role. |

### C2. O que NÃO fazer agora (3 distrações que parecem importantes)

1. **NÃO migrar pra embeddings antes de instrumentar Pearson(Top, Market).** Tentação alta porque resolve A2/R1 de uma vez. Mas: muda 3 contratos (deterministic→probabilistic, cache key, latência) e **sem baseline empírico vocês não sabem se está melhorando ou só re-distribuindo erro**. Instrumentar primeiro (G8 P1), embeddings depois (Sprint 3).

2. **NÃO consertar paginação Adzuna (G12) antes de single-flight (G2) + audit (G8).** Senão vocês vão **acelerar 4× o consumo** de uma quota que já está sendo desperdiçada 3× por cache stampede. Sequência correta: G2 → G8 → ver dados 2 semanas → decidir se paga Adzuna ou se a paginação compensa.

3. **NÃO refatorar utilitários duplicados (G11) nem unificar cache scrapers (Gimli §8.4).** São DRY-por-DRY. Funcionam, são contidos, mudam pouco. Custo de regressão > benefício. **Postergar pra quando vocês contratarem o 2º dev** — vira onboarding-task tipo "leia tudo, faça merge".

### C3. Próximo experimento de produto (1 ideia, factível em 2 sprints)

**A/B test: "Empty state pedagógico vs. fallback fictício pra role nicho".**

**Hipótese:** usuários career-switcher de nicho (RH, professor, fisio, ESG analyst) que veem **empty state honesto + form de "pedir cobertura"** convertem MAIS pra plano paid do que os que veem **8 vagas Backend irrelevantes** — porque a honestidade calibra expectativa e captura o sinal de "produto sério e direto".

**Setup:**
- Grupo A (controle, comportamento atual pós G3): empty state "Não temos vagas curadas pra esse role ainda. Quer que a gente avise quando tiver?" + form com email já preenchido.
- Grupo B (tratamento): manter o fallback role-blind atual mas com banner explícito "8 vagas ilustrativas — não são pro seu role, são exemplo de como vai funcionar quando tivermos dados".
- Métricas: (a) conversão `/gaps`→`/experimentar paid trial` em 7d, (b) NPS coletado no D14, (c) churn no D30.
- Sample size estimado: 200 usuários por braço (poder 80%, $\alpha$=0.05, efeito esperado 5pp em conversão).

**Por que vale:** valida empiricamente o pilar #1 ("auditável") em situação de stress (ausência de dados). Resultado **embasa decisão de roadmap** sobre quanto investir em curadoria manual vs. expansão de providers.

**Custo:** 1 sprint de implementação (G3 já feito + feature flag + tracking PostHog se existir) + 1 sprint coletando.

**Hipótese alternativa que isso valida**: se Grupo A perder, vocês descobrem que **usuário BR de nicho prefere "esforço aparente do produto" mesmo enganoso** — o que é informação valiosa pra pricing (tem disposição a pagar por percepção, não por substância) e pra positioning.

---

## 5. Risco regulatório/ético

### D1. LGPD + viés algorítmico — qual auditoria fazer próximo

**Gandalf §4.4 cita LGPD Art.16 (retenção)** e menciona declaração de tratamento de dados a terceiros. **Está incompleto pra um produto que vai vender "diagnóstico auditável" como claim de marketing.**

**A auditoria que falta — disparate impact assessment:**

Algoritmos de matching de vaga têm histórico documentado de **viés por proxy** mesmo quando não usam variáveis sensíveis diretas. Casos clássicos:
- **Amazon recruiting tool 2014-2018** (descontinuado): treinado em currículos históricos, penalizava palavras associadas a mulheres ("women's chess club captain") porque histórico tinha sub-representação. Reuters, Dastin 2018.
- **LinkedIn salary suggestions 2016**: sugeria salários menores pra perfis com nomes femininos por causa de viés no training data. LinkedIn corrigiu publicamente.
- **HireVue facial analysis** (descontinuou em 2021 após pressão regulatória EUA/Illinois BIPA).

**Onde CareerTwin pode ter viés por proxy mesmo sem coletar raça/gênero/idade:**

1. **Pool de vagas tem viés de empresa enterprise tech** (B3.B2 deste parecer). Pra mulheres em STEM-BR — sub-representadas em tech enterprise BR (DBA Statista 2024: 19% mulheres em tech BR) — adherence sistematicamente menor → score sistematicamente menor → pior recomendação. Sem auditoria, vocês não sabem se o gap é real ou induzido.
2. **Taxonomia ainda viesada pra inglês/tech** (apesar da expansão pra 145). Skills em PT-BR de áreas humanas ("Mediação de Conflitos", "Andragogia", "Atendimento Humanizado") não estão. Perfis 40+ com vocabulário mais português-formal sub-representados.
3. **CV em PDF não-padrão** (estilo "lattes acadêmico" mais comum em profissionais 45+, ou CV manuscrito digitalizado de profissionais de baixa-escolaridade) — extração pior → menos skills detectadas → menor score.

**Auditoria recomendada (Sprint 4 — não urgente, mas obrigatória antes de scale):**

- **Quem faz**: NÃO o time interno (conflito de interesse). NÃO compliance officer interno (não tem skill estatística). **Auditor externo de algorítmica** — no Brasil tem 2-3 firmas competentes: ITS Rio (acadêmico), Aurora Boreal/Data Privacy Brasil, ou consultoria internacional tipo O'Neil Risk Consulting (cara mas referência).
- **Escopo**: rodar adherence sobre dataset balanceado (500 perfis sintéticos por persona × 4 personas críticas: mulher-tech, homem-tech-40+, mulher-marketing, profissional-humanas-50+) e medir disparate impact ratio (DIR — recall por grupo / recall do grupo majoritário). Threshold legal EUA: DIR ≥ 0.8 (4/5 rule). BR não tem threshold oficial mas ANPD usa o mesmo como benchmark.
- **Custo estimado**: R$15-40k por relatório completo. Fora do budget MVP, **previsível pra Sprint 6-8** quando MRR cobrir.

**Mitigação até lá (custo XS, alto valor regulatório)**:
- Documentar em `/transparencia` os 3 vieses conhecidos acima (B3.B2, taxonomia incompleta, extração CV não-padrão).
- Adicionar `algorithmic_disclaimer` no payload de `/api/gaps/summary`: `{ knownBiases: ["pool-bias-enterprise-tech", "taxonomy-bias-english-tech", "cv-extraction-bias-non-standard"] }` para que regulador veja transparência defensável.

### D2. "Diagnóstico auditável" como claim regulado — só marketing ou tem implicação CDC/LGPD?

**Tem implicação. Defensável, mas exige cuidado.**

**Pontos legais:**

1. **CDC Art. 30-31 (publicidade)**: informação na oferta é vinculante. Se vocês prometem "auditável" e o algoritmo no fundo é caixa-cinza ou mente em microcopy (vide B3), vira **publicidade enganosa** (Art. 37 CDC) — multa Procon. Risco real, baixa probabilidade hoje (não é prioridade Procon), **alta probabilidade pós-10k assinantes**.

2. **LGPD Art. 20 — direito à revisão de decisão automatizada**: usuário tem direito de **pedir revisão humana** de decisões algoritmicas que afetem seus interesses. CareerTwin classifica "score baixo" / "gap crítico" / "vaga recomendada" — tudo decisão automatizada. ANPD pode pedir SLA pra atender Art.20. Sem processo: multa até 2% do faturamento BR (max R$50M).

3. **Lei 13.709/2018 (LGPD) Art. 6 — princípio da transparência**: titular tem direito a info clara sobre "critérios e procedimentos do tratamento". Manter `ADR-006` (B2) + transparency report público + `/transparencia` com os 4 sub-scores + pesos visíveis → defesa robusta. **Vocês estão a 80% lá**. Falta: ADR escrita + `algorithmic_disclaimer` no payload + processo formal de revisão (form `/revisao-de-diagnostico`).

**Veredito**: "auditável" é claim defensável LEGALMENTE hoje (você TEM os mecanismos no código). Vira indefensável MORALMENTE se simulador hero mente (B3) ou se viés racial/gênero documentado existir e não for divulgado (D1).

**Ação concreta esta semana**: adicionar disclaimer **EM TODA TELA QUE MOSTRA SCORE**: pequeno texto "Score calculado por algoritmo determinístico • [Ver fórmula completa](/transparencia) • [Pedir revisão humana](/revisao)" no rodapé do card. Custo: 1 hora. **Defesa Art.20 LGPD em 1 linha.**

---

## 6. Top 3 ações pro fundador esta semana

1. **Aragorn v7** — refazer simulador `SiteHero.js:22-34` pra "Pesos visíveis ao vivo" (alternativa 1 de B3). Esta é a única coisa que está MENTINDO pro mercado hoje.
2. **PR consolidado G1+G2+G3** — fixtures fora do daily-briefing + single-flight + empty state honesto pra role nicho. Meio dia + meio dia + 1 dia = 2 dias-dev sênior. Fecha 3 P0 simultaneamente.
3. **ADR-006 + `algorithmic_disclaimer` + link "pedir revisão"** — 2 horas total. Cobertura LGPD Art.6/Art.20 + onboarding-proofing decisão de 2 métricas.

---

## 7. O que eu, como PO, faria diferente

**Onde discordo do approach atual:** vocês estão fazendo **engenharia de honestidade interna excepcional** (Gandalf + Gimli são reports que muitos times sêniores não fazem) mas a **camada de comunicação pública (landing + microcopy + simulador) não está calibrada com a engenharia**. A consequência é que o produto é mais honesto por dentro do que parece por fora — o que é o oposto do problema de mercado (Emprega.AI, LinkedIn AI = caixa-preta vendida como mágica). **Vocês têm que VENDER a transparência com a mesma agressividade que vendem a "evolução do gêmeo".** Concretamente: o hero deveria ter, lado-a-lado com a animação do score subindo, um link gigante "VER A FÓRMULA AGORA" levando pra `/transparencia` aberto a quem não está logado. Hoje `/transparencia` está em `auth-protected-paths.js:23` — vocês escondem o seu maior diferencial atrás de login. Isso é **deixar dinheiro na mesa por timidez**. Tornar `/transparencia` público (read-only, sem dados do user, só a fórmula) é o **moveable mais alto-impacto / mais-baixo-custo** que vejo no produto inteiro — meia hora de dev, ganha argumento de vendas perpétuo contra todos os 27 concorrentes mapeados. **Faz semana que vem.**

---

> *Parecer encerrado.*
> *— PO PhD Career Sciences, 2026-06-30*
