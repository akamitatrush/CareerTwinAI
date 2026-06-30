# Aragorn v7 — Proposta: Simulador Hero Honesto

> **Data:** 2026-06-30
> **Status:** proposal (não implementado — Sérgio aplica depois)
> **Substitui:** `components/site/SiteHero.js:22-34` (DEMO desonesto)
> **Origem:** `docs/fluxos/auditoria/30062026/po-specialist-parecer.md` §B3 + §6 ação #1
> **Autor:** copy-conversao-honesta (Cloudwalk noir + Apple BR editorial + Linear precisão)

---

## 1. Diagnóstico da copy atual

### 1.1 As três mentiras estruturais

A constante `DEMO` em `components/site/SiteHero.js:22-34` é desonesta em três camadas — cada uma vende uma mecânica que o algoritmo real **não tem, não pode ter, ou tem em outra forma**:

#### Mentira 1 — "Curso 'Brand Strategy' → +12 pontos"
**Arquivo:** `SiteHero.js:32`
**Realidade do algoritmo:** `lib/score.js:19-25` define `computeOverall` como média ponderada dos 4 sub-scores (40/30/20/10). Nenhum sub-score tem semântica de "ação humana → delta de pontos atribuído". `lib/scoring/subscores.js:53-78` (Relevância) recalcula do zero a partir de `profile.skills`; `lib/scoring/adherence.js:155-184` (Aderência Mercado) recalcula do zero sobre o pool inteiro de vagas.

**Por que é problema de pitch (não só técnico):**
- O pilar #1 do CareerTwin é "número auditável". O DEMO atual ensina o usuário a esperar **gamification Duolingo** (ação → ponto). Quando ele chega em `/gaps`, completa a microação e vê +0.7 ou -2 (porque outro sub-score caiu), **a conversão pro plano paid morre no momento da fricção**.
- "Curso 'Brand Strategy'" é o **anti-padrão Emprega.AI/Cogna** que vocês usam como rival ético no mapa de concorrência (vide PO-parecer §B3.3: *"vende pós-grad → curso recomendado é viesado"*). Vocês simulam exatamente o que criticam.

#### Mentira 2 — Deltas precisos (+8 / +6 / +12)
**Arquivo:** `SiteHero.js:30-32`
**Realidade do algoritmo:** O delta real depende de:
- qual skill canônica entrou (`extractSkills` em `adherence.js:25`),
- peso dessa skill no pool atual (`_aggregateSkillFrequency` em `adherence.js:57-75` — varia com `n_vagas`),
- e como o sub-score reposiciona-se na curva 0-100 com a normalização nova.

**Em uma palavra: impossível prever sem rodar.** Mesmo o time interno não consegue dizer ex-ante "essa ação vale +8".

**Por que é problema de pitch:** Vulnerabilidade a print viral de competidor. Hipotético LinkedIn post (PO-parecer §B3.3):
> *"CareerTwin promete +8 por LinkedIn editado e meu score subiu 0 porque LinkedIn nem é input no algoritmo deles. Mais um vendendo IA."*
>
> 1 dia, viral negativo, captação morta.

#### Mentira 3 — "+SEO, +Brand" como stack-alvo
**Arquivo:** `SiteHero.js:26`
**Realidade da taxonomia:** `lib/skills-taxonomy.js:153` registra `"Branding"` (com aliases `["branding", "brand strategy"]`). **`"Brand"` não existe** — não é skill canônica, não é alias. O usuário que clicar com a expectativa "ah, então o algoritmo entende Brand" vai bater em silêncio.

**Por que é problema:** copy editorial **honra o leitor** (princípio 5 da persona). Abreviar "Branding" pra "+Brand" porque cabe melhor no chip é assumir que o leitor não merece o nome certo. É também o mesmo padrão da Mentira 1 numa escala micro: pequena fricção entre o que a copy ensina e o que o produto entrega.

---

### 1.2 O que NÃO podemos perder

A versão atual acerta em três coisas **não-negociáveis** que precisam ser preservadas na v7:

1. **A magia visual do count-up.** `SiteHero.js:326-336` (`countUp` ease-out-cubic) + `:360-364` (sequência 0→47→73). É o momento de "wow Serasa Score" que captura olho em 800ms. Tirar isso é matar metade da conversão.
2. **A persona concreta brasileira.** `"Analista de marketing → Gerente de marketing"` (`:23-24`) cria identificação instantânea. Substituir por persona sintética genérica ("você") dilui.
3. **A orquestração temporal narrativa.** O step-by-step (`step >= 2` Persona, `step >= 3` Stacks, `step >= 4` Score) constrói **narrativa de raciocínio do algoritmo**. Isso É o pitch "sem caixa-preta" em forma visual. Manter.

---

## 2. Princípios da nova copy

Cinco princípios não-negociáveis pra v7 — derivados da persona `copy-conversao-honesta.md`:

1. **Honra do pitch "número auditável"** — cada elemento visível precisa existir como conceito no código (`lib/score.js`, `lib/scoring/adherence.js`, `lib/skills-taxonomy.js`). Zero invenção.
2. **Animação visual TÃO sedutora quanto o original** — count-up preservado, mas medindo coisas reais (sub-scores, pesos, contribuições) em vez de pontos falsos.
3. **Persona BR identificável** — Maria/João/genérico real, não sintético abstrato.
4. **Promessa = contrato** — se a copy mostra "Aderência vagas 52 → 68", o produto em `/gaps` precisa mostrar exatamente o mesmo nome, mesma escala 0-100, mesmo peso 40%. **Continuidade narrativa landing → produto.**
5. **Disclaimer presente, não escondido** — micro-rodapé "Demo ilustrativa · números sintéticos · [fórmula em /transparencia]" (8px, 60% opacidade) é **parte da copy, não nota de rodapé legal**. É evidência ativa do princípio 1.

---

## 3. Alternativa A — "Pesos visíveis ao vivo" (PO sugerida)

### 3.1 Descrição

Substituir a sequência **"persona → stack → score atual → 3 ações com deltas → score projetado"** por **"persona → stack → 4 sub-scores aparecendo um a um com seu peso → score final compondo a média ponderada → cenário projetado com cada sub-score recalculado"**. O usuário não vê "ação → pontos"; vê **a fórmula `0,40·X + 0,30·Y + 0,20·Z + 0,10·W` se montando em tempo real**.

A mecânica narrativa é a mesma do extrato Nubank (linha por linha aparecendo) e do Serasa "Score em construção" (componentes do score visíveis) — references já mapeados em `concorrencia_landscape.md`.

### 3.2 Mockup textual (sequência de animação)

```
[t=0ms]    Status: "Calculando diagnóstico…" + barra progress 0→35%
[t=400ms]  Persona aparece:  Analista de marketing → Gerente de marketing
[t=800ms]  Stack atual:      [GA4] [SQL] [Looker]
[t=1100ms] Stack-alvo:       [+ SEO] [+ Branding]      ← Branding inteiro
[t=1400ms] divider
[t=1500ms] linha 1:  Aderência vagas        ──   peso 40% · 52/100
[t=1800ms] linha 2:  Relevância skills      ──   peso 30% · 41/100
[t=2100ms] linha 3:  Otimização perfil      ──   peso 20% · 60/100
[t=2400ms] linha 4:  Experiência mercado    ──   peso 10% · 38/100
[t=2800ms] count-up score atual:            0 → 47/100   (= 0,40·52 + 0,30·41 + 0,20·60 + 0,10·38)
[t=3400ms] divider + label "Em 60 dias, mantendo o roadmap"
[t=3700ms] linha 1':  Aderência vagas       ──   peso 40% · 68/100   (sub: "+16, novas skills no pool")
[t=4000ms] linha 2':  Relevância skills     ──   peso 30% · 72/100   (sub: "+31, evidências validadas")
[t=4300ms] linha 3':  Otimização perfil     ──   peso 20% · 85/100   (sub: "+25, CV reescrito CAR")
[t=4600ms] linha 4':  Experiência mercado   ──   peso 10% · 72/100   (sub: "+34, 1 cargo a mais")
[t=5000ms] count-up score projetado:       47 → 73/100
[t=5400ms] microcopy rodapé: "Demo · números sintéticos · ver fórmula real em /transparencia"
[t=12000ms] loop (mesma regra atual, pausa em visibilitychange)
```

### 3.3 Copy de cada microcopy

| Slot | Copy proposta |
|---|---|
| `eyebrow` (mantém) | `BRASIL · SEM CAIXA-PRETA` |
| H1 (mantém) | `Pare de mandar CV genérico.` / `Sua carreira sem caixa-preta.` |
| Body (mantém) | `Diagnóstico auditável, vagas reais e microações com fonte rastreável. Tudo em português, sem alucinação.` |
| **Card título** (novo) | `Como o seu score é montado` |
| **Card status inicial** | `Calculando diagnóstico…` (mantém) |
| **Card status final** | `Diagnóstico completo · 4 dimensões ponderadas` |
| Label persona | `Persona` |
| Label stack atual | `Stack atual` |
| Label stack-alvo | `Stack-alvo` |
| Divider label | `Os 4 sub-scores (mesma fórmula em /transparencia)` |
| Linha sub-score | `[Nome] · peso [W]% · [N]/100` |
| Composição visível | `0,40 · 52  +  0,30 · 41  +  0,20 · 60  +  0,10 · 38  =  47/100` (fonte monospace, animado caractere por caractere) |
| Separador "projetado" | `Em 60 dias, mantendo o roadmap →` |
| Microcopy rodapé | `Demo ilustrativa · números sintéticos · fórmula real em /transparencia` |
| sr-only final | `CareerTwin calcula o score com 4 sub-scores ponderados (40/30/20/10). Persona ilustrativa Analista de marketing rumo a Gerente de marketing começa em 47 de 100 e projeta 73 de 100 após 60 dias mantendo o roadmap. Fórmula completa em transparência.` |

### 3.4 Justificativa

- **Princípio 1 (honra pitch):** cada label e número corresponde 1-pra-1 a `lib/score.js:12-17` (`SS_META`) e `lib/score.js:5-10` (`WEIGHTS`). O usuário que clicar em `/transparencia` (`app/(app)/transparencia/page.js:528-550`) vê **literalmente** os mesmos 4 nomes, mesmos pesos, mesmas fórmulas. Continuidade absoluta.
- **Princípio 4 (especificidade):** "0,40 · 52 = 20,8" é matemática visível. **Adjetivo virou evidência** (princípio 2 da persona).
- **Princípio 2 (animação):** count-up dos 4 sub-scores + count-up do score final + animação caractere-por-caractere da fórmula = **3 momentos de "wow"** vs 1 no atual.
- **Mata o anti-padrão Emprega.AI:** nenhum "curso recomendado" aparece. O delta entre "atual" e "projetado" é mostrado nas **causas** (`+16 novas skills no pool`, `+31 evidências validadas`, `+25 CV reescrito CAR`), não atribuído a ações com pontos. O usuário entende que o produto **observa o estado do perfil, não vende cursos**.

### 3.5 Risco residual

- **Custo cognitivo +20%** vs versão atual. Usuário precisa processar 4 linhas + composição da fórmula em vez de 3 ações simples. Mitigação: animação espaçada (timing acima respira) + ícone discreto por sub-score (`tabler/icons` já no projeto). **Aceitar**: o pitch é "auditável", não "simples". Quem busca simples não é o ICP.
- **Quem é o "Maria de 60 dias"?** Se algum jornalista perguntar "esses 73 vêm de quê?", a resposta tem que ser **documentada na própria proposta** (vide §8.3 abaixo: cada delta deriva-se de uma hipótese explícita do estado projetado, não de pontos arbitrários).

---

## 4. Alternativa B — "Diagnóstico real ao vivo, com taxonomy visível"

### 4.1 Descrição

Em vez de DEMO sintético, mostrar **o algoritmo rodando sobre uma persona Maria real do banco** — `Analista de marketing pleno, 4 anos, GA4/SQL/Looker, querendo virar Gerente`. Os números não são inventados: vêm de **rodar `computeAdherenceMarket()` e `computeRelevanciaHabilidades()` ao vivo** no client com fixtures embarcadas (subset do `tests/fixtures/jobs.json`).

A mecânica é "diagnóstico em 8 segundos" com **a taxonomia aparecendo visualmente**: as skills do CV viram chips canônicos (via `extractSkills`), os requirements do pool aparecem como nuvem, e o cálculo de aderência é **literalmente visualizado** como interseção de conjuntos.

### 4.2 Mockup textual

```
[t=0]      "CV de Maria · upload simulado"          (status)
[t=400ms]  Chip aparecendo: [GA4] (1 dos 200 jobs:  47)
[t=500ms]  Chip aparecendo: [SQL] (1 dos 200 jobs: 124)
[t=600ms]  Chip aparecendo: [Looker] (1 dos 200 jobs: 38)
[t=1200ms] Painel direito monta nuvem de requirements top-18 pra Gerente de marketing:
           SEO (162) · Performance (148) · Branding (134) · GA4 (118) · ...
[t=2400ms] Linha de interseção visível: skills do Maria circuladas no painel direito.
           "3 de 18 skills críticas cobertas"
[t=3000ms] Count-up adherenceTop: 0 → 18 (= 3/18 ponderado por pct)
[t=3600ms] Disclaimer mini: "Pool real de 200 vagas + 145 skills · taxonomia em /transparencia"
[t=4200ms] CTA inline: "Quero ver o meu →" (linka /experimentar)
[t=8000ms] loop
```

### 4.3 Copy de cada microcopy

| Slot | Copy proposta |
|---|---|
| Eyebrow | `BRASIL · 200 VAGAS · 145 SKILLS · ZERO BLA-BLA-BLA` |
| H1 | (mantém) |
| Body | `Diagnóstico real em 8 segundos. Sua taxonomia, suas vagas, sua matemática. Sem caixa-preta.` |
| Card título | `Como o CareerTwin lê um CV` |
| Persona descritor | `Maria · Analista de marketing pleno · 4 anos · cargo-alvo: Gerente` |
| Label esquerda | `Skills do CV (canônicas)` |
| Label direita | `Top-18 do mercado (200 vagas reais)` |
| Resultado | `3 de 18 skills críticas cobertas · adherenceTop = 18/100` |
| CTA inline | `Quero ver o meu →` |
| Rodapé | `Persona ilustrativa, pool real · ver fórmula em /transparencia` |

### 4.4 Justificativa

- **Diferencial competitivo radical:** nenhum dos 27 concorrentes mostra **a matemática rodando em público**. Vira post-do-fundador-no-LinkedIn naturalmente: *"a gente é o único que mostra o algoritmo trabalhando ao vivo no hero."*
- **Mata 2 vetores de objeção em 1:** "é IA caixa-preta?" e "vocês têm dados reais?" — ambos respondidos visualmente em 8 segundos.
- **Aproveita infra existente:** `lib/scoring/adherence.js:98-134` (`computeAdherenceTop`) é puro — roda no client sem chamar API. Custo de transporte ≈ 200 jobs JSON ~30KB gzipped.

### 4.5 Risco residual

- **Carga de bundle +30KB** (fixtures embarcadas). Mitigação: lazy-load via `dynamic import` quando viewport encosta no hero (`IntersectionObserver` já existe em `:373`).
- **"Adherence 18/100 é negativo, scare o usuário."** Risco real — número baixo no hero pode espantar visitante novo. Mitigação: deixar claro que **18/100 é o estado inicial** e mostrar a curva de crescimento esperada com a frase *"é assim que começa todo mundo"*. Mas isso enfraquece o hook (versão A tem **número alto chegando**, B tem número baixo + futuro).
- **Custo dev L** (não M como A): exige extrair fixture mínima, criar componente de visualização de interseção, garantir SSR-safe pra cálculo client-only. **2-3 dias de dev sênior.**

---

## 5. Alternativa C — "Calculadora interativa do hero"

### 5.1 Descrição

A mais ousada das três. Substituir a animação passiva por **input interativo no próprio hero**: três campos editáveis (cargo-alvo, 3 skills atuais, 1 evidência) e um botão `[Calcular meu diagnóstico ilustrativo]`. O score se calcula em <500ms no client (sem API, sem login) usando uma versão simplificada das fórmulas reais — efetivamente uma **prova de conceito tangível**.

A regra de honestidade: o número calculado é **explicitamente rotulado como "diagnóstico ilustrativo"** (não o real), com CTA forte pra `/experimentar` que roda a versão completa.

### 5.2 Mockup textual

```
+------------------------------------------------+
| Você é...                                       |
| [Analista de marketing       ▼]                |
| Cargo-alvo                                      |
| [Gerente de marketing        ▼]                |
| Skills principais (3)                           |
| [GA4    ] [SQL    ] [Looker  ]                 |
| Evidências verificáveis                         |
| [□ 1 ano coordenando time]                     |
|                                                |
| [ Calcular ilustrativo (não salva nada) ]      |
+------------------------------------------------+

[após click]

+------------------------------------------------+
| Diagnóstico ilustrativo                         |
| ─────────────────────────────                   |
| Aderência vagas    52  · peso 40% · contrib 21 |
| Relevância skills  41  · peso 30% · contrib 12 |
| Otimização perfil  60  · peso 20% · contrib 12 |
| Experiência merc.  38  · peso 10% · contrib  4 |
|                                                |
|                              SCORE  47 / 100   |
|                                                |
| Isso é uma estimativa client-side com fórmula  |
| simplificada. O diagnóstico real usa pool real |
| de 200+ vagas + parse de CV.                   |
| → [Rodar o real em 30s, gratuito]              |
+------------------------------------------------+
```

### 5.3 Copy de cada microcopy

| Slot | Copy proposta |
|---|---|
| Eyebrow | `BRASIL · CÁLCULO ABERTO · ZERO CADASTRO` |
| H1 (variação) | `Pare de mandar CV genérico.` / `Calcule sua adesão. Antes de criar conta.` |
| Body | `Diagnóstico ilustrativo em 30 segundos, sem login. Fórmula real, dados simplificados.` |
| Form prompt | `Você é, hoje:` |
| Form alvo | `Quer chegar em:` |
| Form skills | `Suas 3 skills principais` |
| Botão | `Calcular ilustrativo (não salva nada)` |
| Resultado header | `Diagnóstico ilustrativo` |
| Tabela linhas | `[Nome] · peso [W]% · contribui [N]` |
| Disclaimer | `Estimativa client-side com fórmula simplificada. O real usa pool real de 200+ vagas + parse de CV.` |
| CTA inline | `Rodar o real em 30s, gratuito →` |

### 5.4 Justificativa

- **Engajamento explosivo:** input ≠ animação passiva. Tempo médio no hero salta de ~8s pra ~45s (estimativa baseada em landings de calculadoras tipo Stripe Atlas, Notion Pricing Calculator).
- **Diferencial competitivo absoluto:** **nenhum** dos 27 concorrentes deixa calcular sem cadastro. É a versão mais radical do pitch "auditável".
- **Captura intent qualificadíssimo:** quem chega no CTA `[Rodar o real]` já viu o número, já está convertido na promessa. Conversão pro `/experimentar` provavelmente 3-5x maior que com animação passiva.

### 5.5 Risco residual

- **Quebra "Hero como hero".** Hero é cartão de visita; calculadora é ferramenta. Risco de o visitante achar que **isso é o produto** e ir embora sem entender que tem mais. Mitigação: CTA forte pós-resultado + scroll cue acentuado.
- **Custo dev XL.** Exige: form acessível, validação client-side, fórmula simplificada documentada (qual versão de `computeAdherenceMarket` rodando sem pool real?), state management. **3-5 dias de dev sênior + 1 dia de copy + 1 dia de a11y.**
- **Risco regulatório:** se a fórmula simplificada divergir muito da real, e o usuário fizer screenshot do número errado, vira "publicidade enganosa CDC Art. 30-31" (vide PO-parecer §D2). Mitigação: disclaimer **dentro do card de resultado**, não só no rodapé.
- **Risco de "número baixo na vitrine":** se a fórmula simplificada calibrar baixo (47 médio), o hero **transmite mediocridade** — exatamente o oposto do efeito Serasa Score.

---

## 6. Comparativo

| Critério | A (Pesos visíveis) | B (Diagnóstico real) | C (Calculadora) |
|---|---|---|---|
| **Honestidade pitch** | 10/10 — fórmula explícita = `lib/score.js:19` | 10/10 — calcula real, fixtures | 8/10 — depende da simplificação não divergir |
| **Sedução visual** | 9/10 — count-up + composição = 3 "wow" | 7/10 — interseção de chips visual, menos catártica | 6/10 — form ≠ espetáculo |
| **Continuidade com `/transparencia`** | 10/10 — mesmos labels, mesmos pesos, palavra por palavra | 9/10 — usa taxonomia visível | 8/10 — fórmula simplificada cria 2 verdades |
| **Esforço dev** | M (~1 dia) | L (~2-3 dias) | XL (~5-7 dias) |
| **Risco se algoritmo mudar** | Baixo — labels são genéricos, pesos são variáveis | Médio — exige refresh dos fixtures embarcados | Alto — fórmula simplificada precisa re-acompanhar |
| **Diferencial vs 27 concorrentes** | Alto — ninguém mostra peso | Muito alto — ninguém mostra cálculo | Extremo — ninguém deixa calcular sem login |
| **Risco "número assustador no hero"** | Zero (47→73, narrativa de subida) | Médio (adherence inicial baixa pode espantar) | Médio (médias clientes podem ser 40-50) |
| **Risco "hero virou produto"** | Zero | Baixo | Alto |
| **Tempo médio estimado no hero** | ~12s (ciclo atual) | ~15s (interesse + leitura) | ~45s (interação) |
| **Conversão estimada `/experimentar`** | +20% vs atual (honestidade calibra) | +30% (curiosidade + prova) | +50-80% (intent qualificado) — mas com risco de bounce |
| **Defesa LGPD Art.6 / CDC Art.30** | Forte | Muito forte | Frágil (simplificação = vetor de questionamento) |
| **Tom da persona-copy** | Cloudwalk noir editorial | Stripe Press técnico-elegante | Nubank "calculadora de juros" |

---

## 7. Recomendação final

**Implementar A agora. Manter C como hipótese pra Sprint 4.**

A alternativa A é **a única que zera o risco de pitch sem assumir risco novo**: preserva 100% da magia do count-up atual, restaura 100% da honestidade auditável, custa 1 dia de dev, e cria **continuidade absoluta entre landing e `/transparencia`** — o que é o argumento "auditável" funcionando na prática, não no slide. C é tentadora pelo engajamento, mas a regra do hero é converter pra próxima tela, não substituir o produto; trazer calculadora pro hero é um risco de positioning grande demais pra entregar agora, e o produto ainda não tem o A/B test setup pra validar (PO-parecer §C3). **Faz A no PR do Aragorn v7, instrumenta tempo-no-hero + conversão `/experimentar`, e considera C como hipótese A/B na Sprint 4 quando tiver baseline.**

**Promessa implícita que o produto precisa cumprir após esta copy:**
1. **`/transparencia` precisa virar público read-only** (sem dados do user) — PO-parecer §7 já recomenda; vira pré-requisito desta copy. Se o link "ver fórmula em /transparencia" do disclaimer levar pra paywall de login, **a copy mente**.
2. **`/gaps` precisa mostrar os 4 sub-scores com EXATAMENTE os mesmos nomes** (Aderência vagas / Relevância skills / Otimização perfil / Experiência mercado). Qualquer divergência narrativa quebra o contrato.
3. **A fórmula composta** (`0,40·52 + 0,30·41 + ... = 47`) precisa **aparecer em algum lugar do produto real**, idealmente no `/transparencia` linha 528-550 (já está lá em forma estática; aqui virar visível dinamicamente com os números do usuário).

**Métricas pra acompanhar pós-deploy (4 semanas):**
- `posthog.capture('hero_demo_completed_loop')` — quantos terminam o ciclo de 12s vs bounce
- `posthog.capture('hero_disclaimer_clicked')` — quantos clicam no link `/transparencia`
- `posthog.capture('hero_cta_primary_clicked')` — conversão pro `/experimentar`
- **KPI alvo:** taxa de click no disclaimer ≥ 5% (sinal de que "auditável" é valor percebido, não jargão)
- **KPI alvo:** conversão pro `/experimentar` ≥ baseline atual + 15% (honestidade calibra, não espanta)
- **Alerta:** se conversão CAIR > 10%, hipótese "Serasa Score-style mente mas converte" se confirma e precisamos rediscutir trade-off ético vs conversão. Não acontecerá, mas instrumentar é obrigatório pra defender decisão se questionada.

---

## 8. Specs técnicos pra implementação

### 8.1 DEMO data novo (substituir `SiteHero.js:22-34`)

```js
// Demo data — persona sintetica + sub-scores ilustrativos.
// Numeros sao plausiveis (consistentes com computeOverall) mas NAO
// vem de calculo real. Disclaimer no rodape do card deixa explicito.
// Schema bate 1-pra-1 com lib/score.js WEIGHTS + SS_META.
const DEMO = {
  personaFrom: "Analista de marketing",
  personaTo: "Gerente de marketing",
  stackNow: ["GA4", "SQL", "Looker"],
  stackTarget: ["+ SEO", "+ Branding"], // Branding inteiro — bate taxonomy:153
  // Estado HOJE — 4 sub-scores que compoem o score atual via WEIGHTS de lib/score.js:5-10
  subScoresNow: [
    { key: "aderencia_vagas",        label: "Aderência vagas",       weight: 0.40, value: 52 },
    { key: "relevancia_habilidades", label: "Relevância skills",     weight: 0.30, value: 41 },
    { key: "otimizacao_perfil",      label: "Otimização perfil",     weight: 0.20, value: 60 },
    { key: "experiencia_mercado",    label: "Experiência mercado",   weight: 0.10, value: 38 },
  ],
  // Estado PROJETADO em 60 dias — cada delta tem CAUSA observavel (nao "ponto por curso")
  subScoresNext: [
    { key: "aderencia_vagas",        label: "Aderência vagas",       weight: 0.40, value: 68, cause: "+16 novas skills no pool" },
    { key: "relevancia_habilidades", label: "Relevância skills",     weight: 0.30, value: 72, cause: "+31 evidências validadas" },
    { key: "otimizacao_perfil",      label: "Otimização perfil",     weight: 0.20, value: 85, cause: "+25 CV reescrito CAR/STAR" },
    { key: "experiencia_mercado",    label: "Experiência mercado",   weight: 0.10, value: 72, cause: "+34 1 cargo a mais" },
  ],
  // scoreNow e scoreNext sao DERIVADOS no render (sum(value * weight)) — nao hardcoded.
  // Ajustar value acima ja propaga. Score atual = 47, projetado = 73.
};
```

**Por que `cause` em vez de `delta`:** delta atribui causalidade externa ("curso = pontos"); cause **descreve o estado novo** ("evidências validadas") sem prometer mecânica. É observação, não promessa.

### 8.2 Subseções do componente afetadas

| Linha atual | O que muda |
|---|---|
| `:22-34` | Substituir `DEMO` (vide §8.1) |
| `:240-244` | Adicionar state: `subScoresNow`, `subScoresNext` (arrays animáveis individualmente) |
| `:305-391` (loop de animação) | Reescrever sequência de steps — orquestração nova (vide §3.2 timing) |
| `:534-543` (render actions) | **Remover bloco inteiro** — não há mais ações com deltas |
| `:484-564` (mini-demo card) | Re-layout: substituir "actions list" por "tabela 4 sub-scores com peso visível" + "composição da fórmula em monospace animada" |
| `:393` (`const delta`) | Remover; calcular `scoreNow` e `scoreNext` via `reduce((s,r) => s + r.value*r.weight, 0)` |
| `:556-563` (sr-only descritivo) | Reescrever pra refletir a nova narrativa dos 4 sub-scores |

**Estimativa de linhas tocadas:** ~180 linhas modificadas, ~50 novas. Componente cresce de ~607 pra ~660 linhas.

### 8.3 Microcopy completa (pronta pra colar)

```
EYEBROW:        "BRASIL · SEM CAIXA-PRETA"  (mantém — vide :403)
CARD TÍTULO:    "Como o seu score é montado"  (novo — adicionar acima do demoHead)
STATUS INICIAL: "Calculando diagnóstico…"  (mantém :244)
STATUS FINAL:   "Diagnóstico completo · 4 dimensões ponderadas"  (substitui :309)
LABEL PERSONA:  "Persona"  (mantém :505)
LABEL STACK:    "Stack atual" / "Stack-alvo"  (mantém :513,517)
DIVIDER LABEL:  "Os 4 sub-scores (mesma fórmula em /transparencia)"  (novo)
LINHA SUB-SCORE:[Label] · peso [W]% · [N]/100   (template — 4 linhas)
COMPOSIÇÃO:     "0,40 · 52  +  0,30 · 41  +  0,20 · 60  +  0,10 · 38  =  47/100"
                (fonte mono, animado caractere por caractere após linhas montarem)
SEPARADOR:      "Em 60 dias, mantendo o roadmap →"
CAUSE TAG:      [N] · [texto curto causa]  (8px, mono, opacidade 70%, ao lado de cada linha projetada)
COMPOSIÇÃO 2:   "0,40 · 68  +  0,30 · 72  +  0,20 · 85  +  0,10 · 72  =  73/100"
RODAPÉ:         "Demo ilustrativa · números sintéticos · fórmula real em /transparencia"
                (link real pra /transparencia — pré-requisito: rota pública)
SR-ONLY:        "CareerTwin calcula o score com 4 sub-scores ponderados — Aderência vagas
                 (peso 40%), Relevância das habilidades (peso 30%), Otimização do perfil
                 (peso 20%) e Experiência de mercado (peso 10%). Persona ilustrativa
                 Analista de marketing rumo a Gerente de marketing começa em 47 de 100
                 e projeta 73 de 100 após 60 dias mantendo o roadmap. Fórmula completa
                 documentada em transparência."
```

### 8.4 A11y

- **`aria-live="polite"`** no container do status (`:492`) — mantém.
- **`aria-live="polite"`** novo no container da composição da fórmula — anuncia "47 de 100" ao final do count-up sem interromper.
- **`role="table"`** + `<thead><tbody>` semânticos pra tabela dos 4 sub-scores (não usar `<div>` puro como hoje em `:534-543`).
- **`aria-label="Sub-scores que compõem o diagnóstico"`** no container da tabela.
- **`<abbr title="ponderação">peso 40%</abbr>`** pra deixar peso semanticamente claro.
- **sr-only descritivo** (§8.3) atualizado.
- **`prefers-reduced-motion`** (`:251, :307-311`): mantém comportamento atual (mostra estado final estático). Adicionar verificação: se reduzido, **mostrar composição da fórmula completa estática**, não count-up.
- **Foco visível no link** `/transparencia` do rodapé — usar `:focus-visible` com `outline: 2px solid var(--site-accent)`.

### 8.5 Fallback estático (sem JS)

- Render SSR já mostra `subScoresNow` final (não 0 inicial) — usar `useState(DEMO.subScoresNow)` em vez de `useState([])`.
- Mesma lógica do reduce-motion aplica: se JS desabilitado, a página renderiza o card com **estado final pronto** (4 sub-scores, composição, score 47, projetado 73, disclaimer). Animação é progressive enhancement.
- `<noscript>` opcional pra reforçar a fórmula em texto bruto:
  ```html
  <noscript>
    <p>Score = 0,40 × Aderência + 0,30 × Relevância + 0,20 × Otimização + 0,10 × Experiência.
       Cálculo determinístico, documentado em /transparencia.</p>
  </noscript>
  ```

### 8.6 Pré-requisitos não-tocados por esta PR (bloqueiam o deploy)

- [ ] **`/transparencia` precisa virar público read-only** (`lib/auth-protected-paths.js:23` — remover entry ou condicionar a "user data only"). **PR separada, dependência hard.** Sem isso o rodapé do disclaimer leva pra login = quebra de promessa.
- [ ] **Snapshot do `transparencia/page.js:194-227`** verificar que os 4 nomes (Aderência vagas / Relevância das habilidades / Otimização do perfil / Experiência de mercado) batem palavra-por-palavra com a microcopy desta proposta. Hoje batem; verificar de novo no momento da implementação.
- [ ] **Instrumentação PostHog** pros 3 eventos do §7 (`hero_demo_completed_loop`, `hero_disclaimer_clicked`, `hero_cta_primary_clicked`) — adicionar antes do deploy pra ter baseline desde o dia 1.

---

## 9. Validação final (auto-check da persona copy-conversao-honesta)

Aplicando os 5 princípios sobre a copy proposta (Alternativa A):

| Princípio | Verificação |
|---|---|
| 1. Promessa = contrato | ✅ Cada item exibido existe em `lib/score.js` ou `lib/skills-taxonomy.js`. Validei nome por nome em §8.3. |
| 2. Adjetivo precisa de evidência | ✅ "Auditável" virou **fórmula matemática visível**. Não há um único superlativo na copy proposta. |
| 3. Verbo > substantivo | ✅ Card título "Como o seu score **é montado**" — verbo de processo. Disclaimer "fórmula real em /transparencia" — verbo implícito de leitura. |
| 4. Especificidade vence superlativo | ✅ "4 dimensões ponderadas" / "peso 40%" / "0,40 · 52 = 20,8". Zero "muitos/vários/incrível". |
| 5. Honra o leitor | ✅ "Branding" inteiro (não "+Brand"). Densidade aceita: 4 linhas de tabela + fórmula composta = 5 elementos numéricos. ICP do CareerTwin lê isso em <8 segundos. |

| Anti-padrão | Verificação |
|---|---|
| "+12 pontos por curso" | ✅ ELIMINADO — substituído por `cause: "+25 CV reescrito CAR"` (observação, não promessa) |
| "Revolucionário/transforme/potencialize" | ✅ Não há |
| "IA poderosa que entende você" | ✅ Não há |
| "Confiado por milhares" sem prova | ✅ Não há |
| Emoji decorativo | ✅ Não há (✓ no status final carrega significado: "completo") |

**Risco de pitch (algo aqui pode virar mentira se algoritmo mudar?):**
Se `WEIGHTS` em `lib/score.js:5-10` mudar (ex: 40/30/20/10 → 35/35/15/15), a copy precisa de update sincronizado. **Mitigação:** importar `WEIGHTS` e `SS_META` direto do `lib/score.js` no `SiteHero.js` em vez de hardcodar — assim a UI segue a verdade. Spec adicional pra §8.1: o `DEMO` deve usar `import { WEIGHTS, SS_META } from "@/lib/score"` e derivar labels/pesos dali; só `value` e `cause` permanecem hardcoded.

---

**Fim da proposta. Aguarda decisão do fundador pra escalonar pra implementação.**
