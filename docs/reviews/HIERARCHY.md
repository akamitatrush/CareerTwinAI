# Review: Visual Hierarchy + Density (Report.js)

## TL;DR

O report é um scroll vertical de seis blocos com peso visual praticamente idêntico: tudo usa o mesmo serif 15-22px, todos os cards têm o mesmo background `var(--surface)` com borda 1px, e cada seção começa com o mesmo cabeçalho `01/02/03/04 + título + subtítulo em itálico`. Não existe rio visual: o olho não sabe onde parar nem o que vem primeiro. O resultado é fadiga cognitiva no fim do Mirror e desistência antes do plano (a seção mais acionável fica enterrada na sexta dobra).

## Top 10 problemas (priorizados HIGH → LOW)

### 1. Hierarquia de seção achatada — todo bloco parece igualmente importante
- **Onde:** `app/globals.css:430-458` (`.sec`, `.sec-no`, `.sec-title`, `.sec-sub`) usado em `components/Report.js:103,156,187,206,272`
- **O que está errado:** as quatro seções compartilham exatamente a mesma estrutura visual (numerador mono vermelho + título serif 22-28px + subtítulo itálico). Não há distinção entre "seção de leitura" (Sec 01 — diagnóstico explicativo) e "seção de ação" (Sec 02 e 04 — onde o usuário decide). O `border-top:1px solid var(--border)` entre seções é um separador fraco que não comunica fim/início de capítulos.
- **Impacto:** o usuário lê tudo no mesmo ritmo e perde o sinal de "aqui você AGE, ali você LÊ". A taxa de conclusão de microações cai porque o CTA principal (Sec 02 e 04) tem o mesmo peso de um parágrafo explicativo.
- **Fix sugerido:** criar três níveis hierárquicos de seção: (a) Hero (Mirror), (b) Diagnóstico passivo (Sec 01 explicativa, fundo escuro já existente serve), (c) Ação principal (Sec 02 e 04, com chrome elevado, fundo distintivo, número de seção maior). Sec 03 (vagas) é exploratória e pode ser secundária. Considerar dividers diferentes por nível (linha forte vs respiro vs nada).

### 2. Cards de gap carregam parágrafo inteiro de texto sem encolhimento progressivo
- **Onde:** `components/Report.js:163-182` (`.gapc`, `.gapc-why`), CSS `app/globals.css:586-617`
- **O que está errado:** cada um dos 4 gap cards mostra de uma vez: título serif 18px + chip de frequência + parágrafo serif 15px (geralmente 2-3 linhas com pílula de fonte) + microação destacada em verde + botão. São 4 cards empilhados em coluna, todos abertos, todos no mesmo peso. O olho não tem onde aterrissar primeiro porque tudo é "primeiro".
- **Impacto:** densidade alta na seção mais crítica para conversão. O usuário precisa ler 4 parágrafos seguidos antes de decidir qual ação concluir, e o botão "Concluir +N" fica empatado visualmente com o título e com a pílula `microaction` (que tem fundo accent forte, roubando atenção do CTA real).
- **Fix sugerido:** colapsar o "porquê" por padrão (mostrar só skill + frequência + microação + botão); abrir o texto explicativo on-click ou em hover/disclosure. Alternativamente, encurtar `gapc-why` para 1 frase obrigatória e mover o detalhe para um drawer. A microação visualmente forte deveria ser o botão, não o texto.

### 3. Sec 01 mistura três layouts diferentes dentro de um mesmo bloco escuro
- **Onde:** `components/Report.js:109-153` (`.instrument`, `.inst-top`, `.subscores`)
- **O que está errado:** o bloco escuro `instrument` empilha: gauge circular + headline serif + parágrafo + fórmula em mono + lista de 4 sub-scores collapsibles. São cinco linguagens visuais no mesmo container (geométrica, editorial, técnica, lista interativa) sem respiro entre elas. O `margin-bottom:24px` do `.inst-top` é o único divisor.
- **Impacto:** quem chega na Sec 01 fica overwhelmed. A fórmula `Score = (Aderência × .40)...` é informação técnica importante mas compete com headline e gauge pelo mesmo plano visual. Os sub-scores ficam parecendo continuação da fórmula em vez de painel acionável.
- **Fix sugerido:** quebrar `instrument` em dois sub-blocos visualmente distintos: (a) gauge + headline + 1 linha de "o que é"; (b) "abrir a caixa" — fórmula + sub-scores como expansão opcional ou aba. Hoje cabe na ideia "nada de caixa-preta", mas tudo aparece de uma vez, derrotando o propósito de progressão.

### 4. Sec 04 (plano 3 semanas) verticalmente empilhada — leitura cansa antes da Semana 3
- **Onde:** `components/Report.js:272-295` (`.weeks`, `.week`), CSS `app/globals.css:737-794`
- **O que está errado:** três cards de semana empilhados em coluna (`.weeks{display:flex; flex-direction:column}`), cada um com 3-5 ações listadas. Não há paralelismo visual entre as semanas (não dá pra comparar Semana 1 vs 2 vs 3 sem rolar). Cada `.act` divide-se com `border-top:1px solid var(--border-strong)` que cria ruído de linhas.
- **Impacto:** o plano é o entregável de valor mais alto do produto ("o que faço amanhã"), mas é o último bloco e exige scroll prolongado. Quem chega cansado da Sec 02 desiste antes da Semana 3.
- **Fix sugerido:** opções viáveis: (a) tabs horizontais "Semana 1 | Semana 2 | Semana 3" com a Semana 1 aberta por padrão; (b) layout em 3 colunas no desktop (grid) com cards iguais e comparáveis; (c) timeline horizontal lateral com a semana ativa expandida. Em qualquer caso, encurtar `.act-impact` para 1 linha e tirar o border-top entre ações (usar gap puro).

### 5. Tools bar solto entre Mirror e Sec 01 sem âncora hierárquica
- **Onde:** `components/Report.js:92-101`, CSS `app/globals.css:836-852`
- **O que está errado:** "Treinar entrevista" e "Conversar com meu gêmeo" são CTAs poderosos mas aparecem como dois botões fantasmas (`border:1px solid var(--text)`, fundo transparente, sem ícone destacado) flutuando logo após o Mirror e antes da Sec 01. Não pertencem a nenhuma seção numerada. `margin-bottom:10px` é mínimo, então cola na Sec 01 sem respiro.
- **Impacto:** dois recursos diferenciadores do produto (treino IA + chat com gêmeo) ficam invisíveis. O usuário lê Mirror, dá scroll, e mal registra que clicáveis. Provavelmente baixa adoção dessas features.
- **Fix sugerido:** três caminhos: (a) integrar tools como toolbar fixa/sticky no topo do report (sempre acessível durante leitura); (b) movê-las para dentro do Mirror, como ação à direita do score; (c) torná-las CTAs grandes ao final do Mirror, com peso visual igual ao seam-score. Não deveriam ser dois ghosts pequenos.

### 6. Mirror seam (score central) compete com a marca tipográfica do resto
- **Onde:** `components/Report.js:78-83`, CSS `app/globals.css:387-425`
- **O que está errado:** o `mirror-seam` tem fundo `var(--text)` (escuro) + score 56px branco + tag mono + delta accent. É lindo isoladamente, mas o número central 56px puxa todo o olho do Mirror; o "Você" (esquerda) e "Alvo" (direita) ficam decorativos. Não fica claro que o Mirror é uma comparação entre dois estados — vira "score + dois cards de contexto".
- **Impacto:** o conceito-chave "distância entre você e o alvo" se perde. O seam virou herói, ofuscando a narrativa. Quem olha por 3s captura "tenho score 67" e não "tenho 4 chips e meu alvo tem outros 4 chips e isso é o gap".
- **Fix sugerido:** reduzir o score para 36-40px e dar simetria visual real entre os três blocos. Ou inverter: fazer o seam um divisor magro com seta/símbolo de comparação e devolver protagonismo aos dois lados. O score grande já reaparece na Sec 01 dentro do gauge.

### 7. Spacing inconsistente entre seções (`44px → 28px → 14px` sem lógica)
- **Onde:** CSS `app/globals.css:343` (`.mirror{margin-bottom:28px}`), `:430` (`.sec{margin-top:44px}`), `:469` (`.inst-top{margin-bottom:24px}`), `:520` (`.subscores{gap:8px}`), `:585` (`.gap-list{gap:14px}`), `:737` (`.weeks{gap:14px}`)
- **O que está errado:** o ritmo vertical não segue uma escala. Mirror tem `margin-bottom:28`, sec tem `margin-top:44`, dentro da sec `margin-bottom:20`, dentro do instrument `margin-bottom:24`, lista de gaps `gap:14`, semanas `gap:14`, sub-scores `gap:8`. São números próximos sem hierarquia clara (não dobra, não segue fibonacci, não é grid 8pt consistente).
- **Impacto:** falta de cadência tipográfica. O leitor sente "alguma coisa está irregular" sem saber dizer o quê. Reduz percepção de qualidade premium.
- **Fix sugerido:** definir uma escala de espaçamento (ex.: 8/16/24/40/64) e aplicar três níveis: macro (entre seções, 64px), médio (entre subgrupos dentro de seção, 24px), micro (entre itens iguais, 8-16px). Padronizar `gap` nas listas (todas em 12 ou todas em 16).

### 8. Vaga card tem 7 elementos competindo no mesmo nível visual
- **Onde:** `components/Report.js:220-265` (`.vagac`), CSS `app/globals.css:654-732`
- **O que está errado:** cada `vagac` mostra: título 17px serif + linha empresa/local/salário mono + pílula de fonte inline + bloco "match" com número 28px sobre fundo accent + parágrafo `vagac-why` + lista de "falta" + linha de 3 ações (Ver vaga / Adaptar / Salvar). O `match-num` 28px com fundo accent rouba o olho imediatamente, mas o usuário precisa ler 5 outros campos para decidir.
- **Impacto:** carga cognitiva altíssima em uma seção que é exploratória (não decisória). Numa grid 2x2, são 4 cards desses lado a lado — o usuário não consegue escanear por relevância porque tudo grita igual.
- **Fix sugerido:** reduzir a versão default do card para 3 elementos visíveis: título + match + 1 frase de fit. Empresa/salário/falta/ações entram em expansão (hover/click) ou abaixo da dobra do card. O match-num pode virar uma barra horizontal slim no topo do card em vez de um número grande quadrado.

### 9. Pílula `microaction` no gap card tem mais peso visual que o botão de ação
- **Onde:** `components/Report.js:172-178`, CSS `app/globals.css:619-628`
- **O que está errado:** `.microaction` tem `background:var(--accent)`, padding 7x12, ícone de seta — visualmente parece um botão. Mas é só texto descritivo da ação. O botão real (`.gap-done`) tem fundo transparente com border. O usuário vê o accent pill e pensa "é o botão" — clica e nada acontece.
- **Impacto:** confusão de affordance. Bug de UX latente: a coisa que parece botão não é, e o que é botão parece secundário. Reduz taxa de conclusão de microação.
- **Fix sugerido:** inverter os papéis visuais. A microação (texto) deve ser tipografia simples ou ter chrome neutro (border + transparent). O botão "Concluir +N" deve ser o elemento accent (fundo verde/accent, mais peso). Affordance: o que clica deve parecer clicável.

### 10. Footer (`.rep-foot`) tem o mesmo peso de uma seção real
- **Onde:** `components/Report.js:297-311`, CSS `app/globals.css:799-815`
- **O que está errado:** o `border-top:3px solid var(--text)` no rep-foot é o divisor mais forte do report inteiro (3px). Mas o conteúdo dentro é um parágrafo de transparência em itálico 13px + um botão fantasma. O peso da borda anuncia "nova seção importante" e o usuário entrega atenção que é desperdiçada com nota legal/disclaimer.
- **Impacto:** anti-clímax. Depois do plano (Sec 04, valor alto), o usuário bate num "muro" visual que entrega só um texto de transparência. O botão "← Construir outro gêmeo" também fica frio nessa posição final, sem celebração ou próximo passo.
- **Fix sugerido:** reduzir border-top para 1px ou substituir por respiro. Transformar o final do report num CTA forte (próximo passo, calendar, salvar relatório, compartilhar) e mover a nota de transparência para um colapso/footer global menor. O fim do scroll é prime real estate.

## Reorganização proposta da estrutura

Layout atual:
```
Mirror (Você + Score + Alvo)        ← hero
Tools (2 botões pequenos)            ← solto
Sec 01 (Gauge + 4 sub-scores)        ← diagnóstico passivo
Sec 02 (4 Gaps com texto longo)      ← ação
Sec 03 (Vagas grid 2x2)              ← exploração
Sec 04 (Plano 3 semanas vertical)    ← ação principal (enterrada)
Footer (transparência + restart)     ← anti-clímax
```

Layout proposto:
```
[Sticky top — durante todo o report]
┌────────────────────────────────────────────────┐
│ Score 72 ▲+3   |  Tools: [Entrevista] [Chat]  │  ← contexto sempre visível
└────────────────────────────────────────────────┘

[1. Hero / Mirror — reduzido]
   Você → [seam fino com símbolo de gap] → Alvo
   (score grande sai daqui, fica só no sticky e no gauge da Sec 01)

[2. AÇÃO IMEDIATA — o que fazer agora]
   Antiga Sec 02 (Gaps) sobe para segundo lugar, com cards colapsáveis
   (skill + frequência + microação + botão visíveis;
   texto explicativo em disclosure)
   → trazer a Sec 04 (Plano 3 semanas) aqui como tabs horizontais:
     [Semana 1 ▸ ativa] [Semana 2] [Semana 3]
   Razão: as duas seções de "AÇÃO" ficam juntas, alta no scroll, no momento de maior energia do leitor.

[3. O número, por dentro (opcional / expansão)]
   Antiga Sec 01 vira "Quer entender o cálculo?" colapsável.
   Quem confia já agiu na Sec 2; quem quer auditar abre aqui.
   Gauge + fórmula + 4 sub-scores ficam atrás de um disclosure.

[4. Vagas onde você tem chance]
   Antiga Sec 03, cards simplificados (título + match + 1 frase),
   detalhes expandem on-click.

[5. Encerramento / próximo passo]
   CTA forte: "Salvar relatório por e-mail" / "Marcar revisão em 1 semana"
   Transparência: nota pequena, fundo neutro, sem border-top dramático.
```

Justificativa central: hoje o report obedece à ordem do raciocínio do produto (perfil → score → diagnóstico → gaps → vagas → plano). O usuário, porém, entra ansioso ("o que faço agora?") e o conteúdo de mais alto valor (gaps + plano) está enterrado abaixo de explicações técnicas. Inverter a prioridade — ação primeiro, auditoria depois — alinha o report com a urgência do leitor sem perder a transparência (que continua acessível).

## Padrões de design system que faltam

- **Type scale de 5 níveis claros** — hoje há ~8 tamanhos próximos (9.5/10.5/11.5/13/14/14.5/15/15.5/17/18/20/22/28/56). Consolidar em: H1 hero 40, H2 sec 28, H3 card 18, body 15, meta/mono 11.
- **Sistema de cards unificado** — `gapc`, `vagac`, `week`, `ss` são todos cards mas têm chrome diferente (border-left vermelho no gap, sem border-left na vaga, header com borda na week). Definir uma `Card` primitiva com variantes (default / accent / interactive) e usar consistentemente.
- **Hierarquia de seção em 3 níveis** — distinguir "seção primária" (ação), "seção secundária" (exploração) e "seção opcional" (auditoria) com chrome distinto (largura, fundo, indentação, número de seção).
- **Escala de espaçamento (8pt grid)** — substituir os 14/20/24/28/44 atuais por uma escala canônica (8/16/24/40/64) aplicada em três níveis (macro/médio/micro).
- **Padrão de disclosure / progressive disclosure** — não existe um componente disclosure consistente. Os sub-scores são abrir/fechar; gap, vaga e semana não. Definir quando usar collapse, quando usar drawer, quando usar tabs e seguir.
- **Affordance hierárquica para CTAs** — definir 3 níveis de botão: primário (ação principal da seção, fundo accent), secundário (ghost border), terciário (link/underline). Aplicar consistentemente — hoje `microaction` parece botão sem ser, e `gap-done` parece ghost sendo o real CTA.
- **Anchor / sticky de contexto** — falta um elemento sticky com score + tools que mantenha contexto durante todo o scroll vertical longo.
- **Padrão de "fonte" (citation pill)** — o componente `Src` aparece com 2 variantes inline; padronizar como token visual reutilizável (uma só forma, claro que é meta-info, não conteúdo).
- **Tokens de divisor** — usar 3 tipos de divisor com semântica (linha forte = fim de capítulo; linha fina = fim de bloco; respiro puro = fim de item) em vez do `border-top:1px solid var(--border)` genérico atual.
