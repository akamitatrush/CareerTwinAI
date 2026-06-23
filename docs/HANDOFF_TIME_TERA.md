# Handoff pro time CareerTwin AI — Tera

> Documento de transparência pra Daniel Scharf, Bianca Silva Matos, Jonatan Jamar Martins, Nanda e Cicero Janiel Goncalves Santos. Construído por Sergio Henrique da Silva (6º membro, entrei tarde no grupo) entre 19 e 23/06/2026, em paralelo às discussões do time. Esse doc explica o que existe, o que foi construído sem alinhamento prévio, e como retomamos a decisão coletiva sobre os próximos passos.

---

## TL;DR

O time fez o Discovery profundo entre 16 e 19/06: Statement Problem, Matriz CSD, User Story Mapping, Canvas de Hipóteses, mais o benchmarking de 27 concorrentes. O **próximo passo do plano de vocês** era construir um protótipo interativo (Figma/Lovable) pra validar a solução com usuários antes de codar.

Eu (Sergio) fui além desse passo e construí, sozinho, um **MVP completo navegável** em código — incluindo as 3 features do MVP do Canvas, mais várias extensões que vieram das ideias citadas em ata (Daniel sobre psicometria, Cicero sobre RAG, Bianca sobre metodologia STAR/CAR de mentoria). Hoje o produto tem ~196 testes passando, build limpo, e está deployado em preview na Vercel.

**Esse trabalho foi feito na minha branch, isolado, sem alinhamento prévio com vocês.** O `main` do GitHub segue intocado. Trago aqui pra **decisão coletiva**: vocês olham, criticam, decidimos juntos os próximos passos. Posso continuar, ajustar, reverter, ou apagar.

- **Branch:** [`redesign/claude-design`](https://github.com/akamitatrush/CareerTwinAI/tree/redesign/claude-design)
- **Preview live:** `career-twin-ai-git-redesign-claude-design-log-null-sec.vercel.app`
- **Documentação:** pasta `docs/` (referências ao longo desse texto)

---

## Sumário

1. [Disclaimer e tom](#disclaimer-e-tom)
2. [O que vocês definiram no Discovery](#o-que-vocês-definiram-no-discovery)
3. [O que construí (sem alinhamento)](#o-que-construí-sem-alinhamento)
4. [Mapeamento ata → feature](#mapeamento-ata--feature)
5. [Dúvidas do CSD que o MVP resolve vs as que continuam abertas](#dúvidas-do-csd-que-o-mvp-resolve-vs-as-que-continuam-abertas)
6. [Arquitetura técnica resumida](#arquitetura-técnica-resumida)
7. [Posicionamento atualizado vs pitch original](#posicionamento-atualizado-vs-pitch-original)
8. [Direção visual](#direção-visual)
9. [Risco de marca — colisão de nome](#risco-de-marca--colisão-de-nome)
10. [O que NÃO construí (e por quê)](#o-que-não-construí-e-por-quê)
11. [Próximos passos sugeridos (mantendo o plano DO TIME)](#próximos-passos-sugeridos-mantendo-o-plano-do-time)
12. [Decisões que precisam do time](#decisões-que-precisam-do-time)
13. [Como acessar e testar](#como-acessar-e-testar)
14. [Compromisso](#compromisso)

---

## Disclaimer e tom

Antes de qualquer coisa: cheguei depois de vocês. Vocês já estavam discutindo há semanas quando entrei. Conversamos uma vez na call do dia 16/06 e nas threads do grupo — pouco pra construir alinhamento real sobre um produto inteiro.

Avancei mais do que devia ter avançado sem fechar nada com vocês. **Não foi má-fé** — foi entusiasmo, e a vantagem (e o risco) de eu já ter ambiente Next.js/Prisma/Claude API pronto. Mas o processo correto teria sido: trazer pra grupo, discutir, validar, codar depois.

Esse doc é meu jeito de corrigir isso. **O MVP que existe é proposta, não decisão.** Se o time decidir começar do zero pelo passo 1 (protótipo Figma), eu suporto. Se decidir reaproveitar parte ou tudo, melhor. Se decidir mudar direção, eu adapto. A escolha é coletiva.

---

## O que vocês definiram no Discovery

Fontes consolidadas em `/home/akametatron/Downloads/CarreerTwin/CareerTwin-Discovery.html` e na ata do encontro de 16/06.

### Pitch original (do Notion do time)

> Profissionais impactados por mudanças no mercado têm dificuldade para adaptar currículo, LinkedIn e portfólio às exigências das vagas e plataformas de recrutamento. O CareerTwin AI cria um gêmeo digital da carreira do usuário, identifica lacunas de competências, sugere melhorias para currículo e portfólio, monitora oportunidades e recomenda ações que aumentem as chances de contratação.
>
> Modelo B2C com potencial B2B para universidades, RHs e consultorias de carreira. MVP com análise de LinkedIn, currículo e portfólio. Funcionalidades: Skill Gap Analysis, Opportunity Radar e Career Health Score.

### Statement Problem (resumo)

- **Problema:** profissionais enfrentam múltiplas fricções simultâneas em recolocação (não sabem se o CV está adequado, quais vagas têm aderência, como adaptar materiais).
- **Causa raiz:** ausência de sistema integrado de diagnóstico e reposicionamento — ferramentas atuais são isoladas.
- **Contexto:** mercado global em transformação (WEF 2025-2030), Brasil com ~5,8% desocupação mas recolocação difícil, comportamento candidato reativo.
- **Impactos:** ansiedade + síndrome do impostor + invisibilidade emocional. Tempo prolongado + low-quality candidaturas + custo material. Desigualdade de acesso + desperdício de talento.

### Matriz CSD

**Certezas (validadas pela pesquisa):**

1. Mercado em transformação acelerada.
2. Recolocação difícil mesmo em macro favorável.
3. Candidatos sofrem desgaste emocional significativo.
4. Não há solução integrada de reposicionamento no BR.
5. Candidatos precisam DEMONSTRAR competências (skills-first).

**Suposições (testar no MVP):**

1. Candidatos pagariam por um copiloto.
2. IA consegue análise crítica de aderência com qualidade.
3. Universidades e RHs adotariam B2B.
4. Explicabilidade é diferencial competitivo.
5. Autenticidade aumenta confiança.

**Dúvidas (resolver antes de escalar):**

1. ICP exato? (B2C candidato vs B2B?)
2. Como conseguir base de dados de vagas?
3. Qual modelo de monetização?
4. Como medir sucesso?
5. Como diferenciar de tools "ATS-friendly"?
6. Tempo de onboarding aceitável?

### MVP do Canvas (3 features definidas)

1. **Job Fit Analysis** — cole a vaga, recebe análise de aderência.
2. **Currículo Advisor** — IA revisa o CV, sugere edições.
3. **Skill Gap Mapper** — identifica lacunas, prioriza, sugere cursos.

### Próximos passos imediatos (definidos por vocês)

1. Construir protótipo interativo (Figma/Lovable).
2. User testing com 5-10 candidatos.
3. Entrevistas B2B (5 universidades + 3 RHs).
4. Decisão de ICP.
5. MVP no roadmap.

---

## O que construí (sem alinhamento)

### Cobertura do MVP do Canvas

| Feature do Canvas | Status | Onde testar |
|---|---|---|
| **Job Fit Analysis** | Implementada com 6 ATS providers em paralelo (Adzuna BR, Jooble, Greenhouse, Lever, Ashby, Workable). Filtros por senioridade/modelo/aderência mínima. Match calculado em código + breakdown "Por que?" explicado. | `/oportunidades` |
| **Currículo Advisor** | API + UI com histórico, toggle antes/depois, copy/delete. Marca bullets como `nova` vs `reorganização` pra forçar confirmação. | `/api/tailor` + `/cvs-adaptados` |
| **Skill Gap Mapper** | KPI strip, requirements list com frequência nas vagas, microações com completion endpoint, **cursos sugeridos** (curados manualmente em `lib/knowledge/courses.json`, ~80% grátis). | `/gaps` |

### Além do MVP do Canvas (extensões)

Várias dessas vieram de coisas que vocês falaram em ata, mas que não estavam no escopo do MVP do Canvas. Mapeio cada uma na próxima seção. Aqui só listo:

| Feature | Onde |
|---|---|
| Career Health Score auditável (com fórmula visível) | `/dashboard` + `/transparencia` |
| Sub-scores determinísticos em código | `lib/scoring/subscores.js` |
| Histórico de score ao longo do tempo | `/plano` |
| Funil de candidaturas (kanban + métricas de conversão) | `/candidaturas` |
| Mock interview STAR/CAR com alerta de autenticidade | `/api/interview` + `InterviewModal` |
| Autoconhecimento — 3 mini-assessments (DISC, Valores, Ikigai) | `/autoconhecimento` |
| Evidências de competência (cases + métricas documentados) | `/evidencias` |
| LGPD by design (Consent + Cascade Delete + Export JSON) | `/meus-dados` |
| Notificações in-app | sininho na sidebar |
| RAG-lite (knowledge base JSON + retrieval por keywords) | `lib/knowledge/*.json` + `retrieval.js` |
| Onboarding split-panel X/3 | `/` (landing) |
| 6 telas Claude Design (sidebar 252px + creme) | route group `(app)/*` |

### Estado técnico

- ~196 testes unit + 5 e2e Playwright passando.
- Build limpo (Next 14, Prisma 6, Auth.js v5, Claude Sonnet 4.6).
- Deploy contínuo em preview Vercel a cada commit.
- Branch isolada do `main`, que segue como estava no commit `3db406b`.

---

## Mapeamento ata → feature

Muito do que construí veio direto das ideias que vocês jogaram no encontro de 16/06. Esse mapeamento existe pra mostrar que o produto não saiu da minha cabeça — ele tenta materializar o que o grupo discutiu.

| Quem disse o quê (ata 16/06) | Feature construída |
|---|---|
| **Bianca** descreveu o método de mentoria dela em 3 etapas: LinkedIn → currículo → simulação de entrevista, e mencionou CAR/STAR como metodologia central. | `/api/interview` com avaliação STAR/CAR + alerta de autenticidade. `/api/tailor` pra adaptação de currículo. Estrutura inspirada nas 3 etapas. |
| **Cicero** insistiu (3x na ata) na necessidade de "construir uma base de dados sólida — modelo RAG — que permita à IA acessar informações estruturadas e evitar respostas genéricas ou alucinações." | RAG-lite em `lib/knowledge/` (`courses.json`, `skills-taxonomy.js`, `retrieval.js`). Todas as recomendações citam fonte entre colchetes. |
| **Daniel** (e Bianca) compartilhou experiência com testes psicológicos e assessments como ferramentas pra medir competências e auxiliar planejamento de carreira. Mencionou Ikigai. | `/autoconhecimento` com 3 mini-assessments: estilo comportamental (DISC-like), valores, Ikigai. Marcados como **informacionais** (não clínicos). |
| **Jonatan** descreveu como usa Claude/ChatGPT pra adaptar currículo a vagas específicas e enfatizou "evitar respostas genéricas". | `/api/tailor` reescreve o CV pra vaga específica, marcando bullets como `nova` ou `reorganização` pra forçar autenticidade. |
| **Nanda** trouxe o ponto: "ferramentas analisam o agora, mas não consideram pra onde a pessoa quer ir." | Cargo-alvo (`targetRole`) é obrigatório no onboarding. Todas as análises orbitam em torno do delta entre "onde está" e "onde quer chegar". |
| **Bianca** mencionou que candidatos precisam "transmitir personalidade e experiência de forma coerente, sem cair em respostas prolixas." | Princípio editorial **autenticidade**: a IA é instruída a NUNCA inventar conquistas. Quando falta dado mensurável, usa marcador `[adicione aqui um resultado mensurável real]`. |
| **Grupo** mencionou 80% dos recrutadores usando IA + 81% dos candidatos com lacunas. | Justificativa pro pitch geral. Documentado em `docs/PRODUTO.md`. |

A ata original está em `/tmp/careertwin-team/notion-extracted/CareerTwin AI/Atas/1_Encontro_CareerTwin_AI_-_06-16-2026-20260618182945.md` se quiserem cruzar.

---

## Dúvidas do CSD que o MVP resolve vs as que continuam abertas

| Dúvida do CSD | Status | Detalhe |
|---|---|---|
| Como conseguir base de dados de vagas? | **Resolvida** | 6 ATS providers em paralelo via `Promise.allSettled`: Adzuna BR, Jooble, Greenhouse, Lever, Ashby, Workable. Sem chave de vagas, fallback de vagas ilustrativas etiquetadas como tal. |
| Como medir sucesso? | **Resolvida** | Tracking de funil em `/candidaturas` (SAVED → APPLIED → SCREENING → INTERVIEW → OFFER/REJECTED). Histórico de score em `/plano`. Eventos PostHog (`diagnosis_completed`, `application_saved`, `digest_clicked`). |
| Como diferenciar de tools ATS-friendly? | **Parcial** | Explicabilidade auditável (fórmula visível na UI) + autoconhecimento (assessments) + evidências documentadas. Diferencia em conceito, falta validar com usuário se importa. |
| Qual ICP exato (B2C/B2B)? | **Aberta** | Construí pra B2C principalmente, mas extensível pra B2B. **Precisa user testing (passo 2 do plano) + entrevistas B2B (passo 3).** |
| Modelo de monetização? | **Aberta** | Freemium proposto em `docs/PRODUTO.md` (Free / R$29/mês / R$49/mês + planos B2B). Não validado com nenhum usuário. |
| Tempo de onboarding aceitável? | **Aberta** | Onboarding atual leva 2-5min (CV ou texto + cargo-alvo). Diagnóstico leva 15-30s. Precisa user testing pra saber se isso é confortável. |

**As 3 que continuam abertas dependem exatamente dos passos 2, 3 e 4 do plano original do time.** Não dá pra fechar sem usuário real na ponta.

---

## Arquitetura técnica resumida

Documentação completa em `docs/redesign/01-FRONTEND.md`, `docs/redesign/02-BACKEND.md`, `docs/redesign/03-PRODUCTION.md` e `docs/ALGORITHMS.md`. Resumo aqui pra contexto.

- **Stack:** Next.js 14 App Router + React 18 + Prisma 6 + PostgreSQL (Neon) + Auth.js v5.
- **LLM:** Anthropic Claude Sonnet 4.6 (com fallback OpenAI por env), Zod schema validation em todas as saídas, anti-prompt-injection.
- **Vagas:** 6 ATS providers em paralelo, timeout 6s, deduplicação por URL.
- **Score determinístico:** `lib/scoring/subscores.js` calcula o número em código. A IA só explica o porquê em texto. Princípio "número = cálculo auditável".
- **RAG-lite:** knowledge base em JSON (`courses.json`, `skills-taxonomy.js`) + keyword retrieval. Sem embeddings/pgvector por enquanto (resolve o caso de uso atual com menor complexidade).
- **LGPD:** Consent por fonte + `payloadHash` + cascade delete real + Export JSON portável.
- **Observabilidade:** Sentry (erros) + PostHog (eventos) + `/api/health` pra UptimeRobot.
- **Acessibilidade:** score AA ~85% (audit em `docs/redesign/A11Y_AUDIT.md`).
- **Testes:** ~196 unit + 5 e2e Playwright (skipados em CI por default, rodam local).

---

## Posicionamento atualizado vs pitch original

### Pitch original (Notion do time)

> Plataforma de **recolocação**, gêmeo digital pra adaptar currículo, LinkedIn e portfólio.

### Reframing implementado (baseado em ideia do Daniel na ata)

> Plataforma de **gestão de carreira** com IA, em pt-BR. Identidade → diagnóstico → ação → oportunidade. Recolocação rápida é consequência. Carreira saudável é objetivo.

**Por que mudei:** o Daniel mencionou em ata a importância de combinar aspectos técnicos com entendimento pessoal — "uma visão ampla que une autoconhecimento e requisitos do mercado". O time todo discutiu autoconhecimento, identidade, momentos de carreira. Isso me pareceu maior que só "recolocação" e construí em cima dessa direção.

**Reversível?** Sim. Se vocês preferirem voltar ao pitch original ("recolocação" como foco principal), basta cortar `/autoconhecimento`, `/evidencias` e ajustar copy de landing. ~6h de trabalho.

---

## Direção visual

Segui o mock **V2.zip** que estava na pasta de Design Project Setup do time (Plus Jakarta Sans + Spectral + paleta índigo sereno + sidebar 252px). Esse arquivo está em `/home/akametatron/Downloads/CarreerTwin/V2.zip`.

**Conflito identificado:** o Master Blueprint anterior pede tipografia Bricolage Grotesque (diferente do V2.zip). Como o V2.zip parecia mais recente, priorizei ele. Se vocês quiserem voltar pro Bricolage, reverto em ~3h.

Telas implementadas seguindo o V2:

- `/dashboard` — Score Ring, sub-scores, mediana de mercado, próximas ações.
- `/gaps` — KPI strip + requirements + cursos.
- `/oportunidades` — radar de vagas com filtros e fit-ring.
- `/plano` — chart de evolução do score + timeline de ações.
- `/transparencia` — fórmula do score + data sources + LGPD card.
- `/conta` — perfil + preferências + zona de risco (apagar).

Sidebar 252px desktop + header colapsável mobile (breakpoint 880px). Default light com creme `#F6F5F2`. Dark mode adiado.

---

## Risco de marca — colisão de nome

Levantamento completo em `docs/REBRAND_CANDIDATES.md`. Resumo do problema:

Existem **dois produtos no mundo** com o nome CareerTwin em domínios premium:

| Domínio | Empresa | Recorte | Onde |
|---|---|---|---|
| **careertwin.io** | headwayOS Labs (Índia) | Marketplace de talentos + verificação cripto via GitHub/GitLab + blockchain | Índia, foco dev |
| **careertwin.ai** | Não-identificada (EUA) | Simulador de entrevista em áudio (mock interview vertical) | EUA, FAANG-bound |

Não conseguimos `.com`, `.io`, `.ai` nem `careertwin.app`. Risco: se um dos dois depositar marca nominativa em classes 9/41/42 (software/educação/SaaS) no INPI ou USPTO, pode forçar rebrand pós-tração.

Verifiquei 22 alternativas. **3 candidatos GREEN** (sem colisão, domínios livres):

1. **CarreiraTwin AI** — semanticamente perfeito, `.com.br` livre.
2. **JornadaTwin AI** — "jornada" virou a palavra-mãe da UX no Brasil; minha recomendação intuitiva.
3. **PivotTwin AI** — "pivot" como ato de virada de carreira; mais ousado mas mais anglicista.

**Ação sugerida:** consulta INPI + USPTO antes de qualquer marketing pago. Decisão coletiva sobre manter ou trocar o nome.

---

## O que NÃO construí (e por quê)

| Item | Por quê não |
|---|---|
| **Dashboard B2B universidade/RH** | Escopo grande, depende de decisão de ICP. Não faz sentido construir sem entrevistar 5 universidades + 3 RHs (passo 3 do plano do time). |
| **Mediana de contratados real** | Sem dataset. Hoje é stub com label "estimativa em construção". Futuro: parceria com Solides/InHire/Glassdoor (~6 meses). |
| **Análise psicométrica clínica validada** | Sem licença dos instrumentos (DISC oficial, MBTI). Os 3 assessments do `/autoconhecimento` são **informacionais**, não clínicos. Avisados na UI. |
| **Affiliate de cursos com tracking** | Links curados grátis curtos por enquanto, sem revenue share. Faz sentido só depois de validar engagement nas microações. |
| **Mobile app nativo** | Só responsive web por agora. Custo de manter app nativo é alto sem usuário validado. |
| **Internacionalização (en/es)** | Só pt-BR. Pitch é "primeiro pt-BR a fazer isso direito" — i18n depois. |
| **Embedding pipeline / pgvector** | RAG-lite com keywords cobre o caso atual com ~80% da qualidade e 10% da complexidade. Embeddings depois, se necessário. |
| **Web extension pra capturar vagas (estilo Huntr)** | Não está no MVP do Canvas. Avaliar pós-tração. |

---

## Próximos passos sugeridos (mantendo o plano DO TIME)

A ideia é **não substituir o plano de vocês**. O MVP é só material adicional pra acelerar os próximos passos.

| Passo do plano original | Status hoje | O que falta |
|---|---|---|
| 1. Construir protótipo interativo | Construí como MVP completo (em vez de Figma/Lovable estático). | Time olhar, validar, criticar. |
| 2. User testing com 5-10 candidatos | Não iniciado. | Recrutar 5-10 candidatos. Eu posso ajudar a operacionalizar — preparei `/entrar` com modo dev pra acelerar testes. |
| 3. Entrevistas B2B (5 universidades + 3 RHs) | Não iniciado. | Daniel/Bianca lead (vocês têm rede em RH e educação)? |
| 4. Decisão de ICP | Pendente. | Depende dos passos 2 + 3. |
| 5. MVP no roadmap | MVP existe e funciona, precisa iteração baseada em feedback. | Iterar após user testing. |

### Curto prazo (próximas 1-2 semanas)

1. **Time olha o preview** e me dá feedback bruto. Pode ser por escrito, call, sticky-notes no Figma — o que for mais confortável.
2. **Discussão coletiva** sobre direção (recolocação vs gestão de carreira), nome (CareerTwin vs rebrand), e quais features cortar/manter.
3. **Recrutar candidatos pro user testing** (passo 2). Posso ajudar com formulário, dashboard de respostas, agenda.
4. **Marcar entrevistas B2B** (passo 3). Daniel/Bianca conduzem, eu apoio com material.

---

## Decisões que precisam do time

São 4 decisões grandes que afetam o que sobrevive desse MVP. Sugiro que sejam respondidas em call, não async.

1. **Direção do produto.** Continuamos com "gestão de carreira" (4 pilares: autoconhecimento + diagnóstico + ação + oportunidade) ou voltamos pro pitch original ("recolocação", mais focado e estreito)?
2. **Nome.** Mantemos CareerTwin (com risco de colisão com careertwin.io e careertwin.ai) ou trocamos pra um dos 3 GREEN (JornadaTwin AI, CarreiraTwin AI, PivotTwin AI)?
3. **Identidade visual.** Aceitamos o V2.zip (Plus Jakarta + Spectral + creme + sidebar 252px) ou voltamos pro Bricolage Grotesque do Master Blueprint?
4. **Buracos críticos.** Alguma feature que vocês consideravam essencial e que eu não vejo no produto? Algo que ficou de fora e deveria estar?

---

## Como acessar e testar

- **Repo:** github.com/akamitatrush/CareerTwinAI · branch `redesign/claude-design`.
- **Preview live:** `career-twin-ai-git-redesign-claude-design-log-null-sec.vercel.app`.
- **Login no preview:** dev mode habilitado — qualquer email com domínio `dev@local` funciona em `/entrar`. Não precisa de SMTP nem magic link no preview.
- **Documentação principal:**
  - `docs/PRODUTO.md` — produto completo (visão, jornada, concorrência).
  - `docs/ALGORITHMS.md` — algoritmos (score, match, gaps).
  - `docs/API.md` — referência de rotas.
  - `docs/redesign/00-MASTER_PLAN.md` — plano de migração visual.
  - `docs/REBRAND_CANDIDATES.md` — 22 nomes verificados.
  - `docs/UX_AUDIT.md` + `docs/redesign/A11Y_AUDIT.md` — auditorias UX e a11y.

### Roteiro sugerido pra primeira sessão (15min)

1. Entrar em `/entrar`, logar com `dev@local`.
2. Onboarding em `/` — colar CV + cargo-alvo.
3. Ver `/dashboard` — Score Ring, sub-scores, próximas ações.
4. Entrar em `/gaps` — ver lacunas e cursos sugeridos.
5. Ir em `/oportunidades` — ver vagas reais e match.
6. Testar `/transparencia` — auditar a fórmula do score.
7. Conferir `/meus-dados` — testar export JSON e apagar tudo.

---

## Compromisso

Esse MVP é **proposta**, não decisão.

A branch `redesign/claude-design` está isolada de `main` (que segue intocada no commit `3db406b`). Tenho histórico Git limpo pra qualquer um auditar. Posso:

- **Continuar** evoluindo se vocês aprovarem a direção.
- **Reverter** features específicas se o time pedir (cada extensão fora do MVP do Canvas tem PR isolável).
- **Refazer** visual e positioning baseado em feedback do user testing.
- **Apagar tudo** e voltar ao passo 1 (protótipo Figma) se o time decidir outro caminho.

Conto com vocês pra decidirmos os próximos passos juntos.

— Sergio Henrique da Silva (sergio@lognullsec.com)
2026-06-23
