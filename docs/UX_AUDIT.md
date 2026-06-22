# UX/UI Audit — Referências e recomendações

## TL;DR

A direção "Dossiê editorial" (Bricolage Grotesque, verde-limão `#B9D90C`, score auditável visível, mix serif/mono) é uma das poucas coisas que diferencia o CareerTwin do mar de SaaS purple-blue-gradient genérico mapeado nas referências. O problema atual não é a tipografia editorial — é que ela ainda não está sendo usada para resolver problemas concretos de produto que os concorrentes resolvem bem: onboarding orientado a objetivo (Cursor / Teal), visualização transparente de match score (Jobright falha aqui, é nossa abertura), preview de ação em tarefas de IA (padrão Claude Code) e kanban arrastável (Huntr). Recomendo preservar a identidade editorial e investir tempo em três frentes: onboarding "goal-first" em 60 segundos, score com explicação inline ("por que 72?") e kanban + loading states com personalidade. Anti-pattern a evitar a todo custo: virar mais um SaaS roxo-azul com gradiente de hero e três cards de feature.

## Bloco 1 — Internacional (AI career copilots)

### Teal (tealhq.com)
- Identidade visual: o domínio bloqueou WebFetch (403), mas reviews descrevem templates "simple, clean, intentionally conservative", azul-petróleo (teal) institucional, sem grandes flourishes. Identidade visual considerada "limitada" — o produto vence pela arquitetura, não pelo desenho.
- Hero / primeira impressão: marketing fala "Land Interviews 6x Faster" e empilha métricas. Onboarding é tracker-first: cria conta, cai num dashboard de pipeline, é empurrado a instalar a extensão Chrome e salvar vagas — NÃO começa pelo editor de currículo. Filosofia explícita: "your job search should be tracked, not improvised".
- O que faz bem: estrutura o produto como sistema de gestão de busca, não ferramenta isolada. Resume builder usa campos estruturados (experience, skills, summary) reutilizáveis entre múltiplos currículos — "store and reuse".
- O que NÃO copiar: onboarding é descrito como "disorienting" no primeiro contato — não há momento "construa seu currículo agora". Match score existe mas é opaco, sem explicação. Reviews reclamam de curva de aprendizado.
- Link relevante: https://enhancv.com/blog/teal-review/

### Jobright (jobright.ai)
- Identidade visual: azul-base com acentos verdes de sucesso, dashboard-preview-based hero (screenshots do produto, não ilustração). Densidade alta, múltiplos CTAs, carrossel de testimonials, FAQ longo.
- Hero / primeira impressão: headline "No More Solo Job Hunting / Do it with AI". Stat empilhada: "2M+ users", "8M+ listings", "400K daily". CTA "Try For Free". Marca o agente como "Orion" — nome próprio para o copiloto.
- O que faz bem: outcome-focused copy ("3x interviews landed", "80% time saved"), e o match score (70–100%) é o gancho central. Extensão Chrome mostra score sobre LinkedIn/Indeed sem trocar de aba.
- O que NÃO copiar: match score é opaco — review do Hirecarta diz que dá número (ex: 5.5/10, "Poor") sem explicação, e o número chega a divergir entre Chrome extension e site para a mesma vaga. Fonts disponíveis para currículo são Helvetica / Times New Roman / Arial (datadas). Free tier exaure em 3 customizações, irritando o usuário antes da avaliação.
- Link relevante: https://hirecarta.com/blog/jobright-review

### Careerflow (careerflow.ai)
- Identidade visual: azul/roxo vibrantes com gradientes coloridos, fundo branco com seções cinza-claro, sans-serif system stack moderna. Hero usa "colorful circular badge arrangement" com fotos diversas de usuários. Animação contida, B2B-mature.
- Hero / primeira impressão: headline "Land your dream job. Without the stress." CTA "Sign up FOR FREE" em botão azul repetido várias vezes. Densidade média-alta, mas com respiro entre seções.
- O que faz bem: claims numéricos específicos ("60% Faster", "2x More Job Offers"), seção before/after que humaniza a dor, logos Fortune 500 (Google, Meta, Netflix, Amazon). Posiciona-se como "Your Career Copilot" — IA como apoio.
- O que NÃO copiar: copywriting clichê "say goodbye to X", cards de feature com ícone padrão, layout de pricing previsível. A própria análise da fonte qualifica como "professional yet approachable, leaning toward established SaaS conventions" — ou seja, genérico até onde dá.
- Link relevante: https://www.careerflow.ai/

### Wobo (wobo.ai)
- Identidade visual: dark/light mode com navy + branco, sans-serif minimalista, full-width hero 1920px com headline conversacional. Card-based interface mimetizando dating app (accept/decline).
- Hero / primeira impressão: "Companies Have Recruiters. Now You Do Too. / AI that finds your best matches and applies in your voice." Comunica o "digital twin" via comparação lado-a-lado "Typical AI" (resposta genérica) vs "Wobo Persona" (resposta na voz do usuário).
- O que faz bem: a metáfora "swipe-to-apply" é demonstrada visualmente no hero (card com match %, salary, skills, company); testimonials com métricas específicas ("275 jobs applied, 14 interviews, 8 weeks to offer"); jornada visualizada como "Four stops. One path to interviews".
- O que NÃO copiar: o conceito "apply in your voice" tem fricção ética e LGPD séria para o mercado brasileiro (auto-aplicação em massa = SPAM para recrutador, e modelo é difícil de auditar). NÃO seguir a auto-aplicação automática.
- Link relevante: https://www.wobo.ai/

### Huntr (huntr.co)
- Identidade visual: dark theme, logo dark navy/black, modular feature-focused. Whitespace generoso, sem texto denso — bullets curtos, hero imagery por feature.
- Hero / primeira impressão: "Less Hassle, More Interviews". CTA "Sign Up for Free" repetido. Trust: "500,000+ job seekers", logos Goldman/Spotify/Chase/Google/Microsoft, 4.9★ com 1.1k reviews para a extensão Chrome.
- O que faz bem: o kanban arrastável é a feature de assinatura — colunas Wishlist / Applied / Interview / Offer, drag-and-drop literal. Card de aplicação consolida: company, role, URL, salary, notes, contatos. Extensão Chrome com clipping de listing em um clique.
- O que NÃO copiar: feedback recorrente é "too many extra fields that are confusing — flexibility means greater complexity". Não copiar a complexidade de campos opcionais; nosso kanban pode começar com 3 colunas fixas + 4 campos.
- Link relevante: https://huntr.co/product/job-tracker

### Final Round AI (finalroundai.com)
- Identidade visual: navy/dark com acentos cyan/electric blue, gradient overlay sutil no hero, screenshot do app desktop em destaque. Sans-serif clean. Densidade média.
- Hero / primeira impressão: "Crack Every Interview with Real-Time AI Assistant" — copy provocativa, fala em "instant, undetectable answers". CTA "Download Now". Trust: "10M+ users", "10k+ jobs secured", 4.9★ Product Hunt, badges SOC 2/CCPA/GDPR, "80+ countries".
- O que faz bem: positioning provocativo e diferenciado ("undetectable", "stealth", "invisible") — não tenta soar como SaaS gentil. Compliance badges destacados (relevante para B2C com PII).
- O que NÃO copiar: o pitch "undetectable real-time interview assistance" é eticamente cinzento (assistência durante entrevista ao vivo). Não imitar essa narrativa para BR — em PT-BR vai soar como "cola na entrevista".
- Link relevante: https://www.finalroundai.com/

### CareerTwin.ai (homônimo — Interview Twin)
- Identidade visual: dark/minimalist, sans-serif, contraste alto. Não é nosso concorrente direto — é interview-prep, áudio-first.
- Hero / primeira impressão: "Hear your next interview before you walk in". CTA "Start Free — No Credit Card". Trust: "50,000+ engineers practiced last month", testemunhos com "Landed L5 @ Google" / "Offer from Microsoft".
- O que faz bem: positioning hiper-específico ("personalised to your exact CV and target role", "podcast-style audio sessions", "loop simulation" de onsite). Não tenta fazer tudo — faz uma coisa bem.
- O que NÃO copiar: nada estrutural — produto diferente. Mas: existe risco real de confusão de marca pelo nome quase idêntico (eles atendem engenheiros US para FAANG, nós atendemos BR / LGPD / mercado generalista). Vale documentar a distinção em landing.
- Link relevante: https://www.careertwin.ai/

## Bloco 2 — Nacional (BR career)

### Catho (catho.com.br)
- Identidade visual: o domínio retornou 404 via WebFetch e o `www.` retornou 403. Por reviews terceirizadas (jobboardfinder): grande retângulo azul ao centro com o motor de busca (location + keywords), restante da página em cinza-claro. Homepage mostra 4 vagas em destaque com salário visível, empresas em destaque, depoimentos.
- Tom pt-BR: institucional, formal, mainstream — "empregos para todo o Brasil". 25 anos de operação (criado em 2000, adquirida pelo Seek em 2016), 12,4M visitas/mês.
- Trust signals: escala (12M+ visitas), histórico, empresas em destaque, testemunhos.
- O que NÃO copiar: estética datada de portal de classificados anos 2000, com formulário em destaque visual e gradiente azul forte. Densidade alta sem hierarquia editorial.
- Link relevante: https://www.jobboardfinder.com/jobboard-cathocombr-brazil

### Infojobs (infojobs.com.br)
- Identidade visual: duotone branco e índigo, acentos roxo/azul, sans-serif moderna. Whitespace moderado, layout em seções (categorias, listings, testemunhos), carrossel para browse.
- Tom pt-BR: friendly-professional. CTAs em caixa-alta ("ACHAR VAGAS", "Anunciar Vagas"). Inclusivo: "Mais de 1 milhão de oportunidades para você escolher!".
- Trust signals: 267.000+ empregadores, 14M+ opiniões em review system de empresa, testemunhos com tenure/location, salary transparency tools, app disponível.
- O que NÃO copiar: ALL CAPS no CTA principal envelhece a marca; carrossel de categorias profissionais com ícones ilustrados é mainstream-genérico.
- Link relevante: https://www.infojobs.com.br/

### Vagas.com.br (vagas.com.br)
- Identidade visual: paleta predominantemente em escala-de-cinza (logos de cliente em cinza), sans-serif moderna (stack Next.js detectada), metáforas esportivas (futebol — "convocação", "entrar em campo"). Densidade moderada-alta.
- Tom pt-BR: conversacional + técnico. "Vem aí o VcCV" (colloquial) mistura com autoridade técnica.
- Trust signals: "32 milhões profissionais cadastrados", "480 milhões pageviews/ano", timeline 1996–2025 com marcos ("Primeira IA híbrida"), Unilever / Mercado Livre / Vivo. Tagline: "A plataforma de recrutamento mais rápida do mercado".
- O que NÃO copiar: a metáfora esportiva mistura mal com o público corporate; timeline cronológica de 28 anos é típica de empresa madura cansada, não de produto novo.
- Link relevante: https://www.vagas.com.br/

### LinkedIn Brasil (br.linkedin.com)
- Identidade visual: azul LinkedIn + branco, sans-serif legível, densidade moderada-alta, navegação ampla (Trending, People, Learning, Jobs, Games).
- Tom pt-BR: friendly-professional, ação-orientado: "Cadastre-se agora e descubra a sua próxima vaga e oportunidades profissionais".
- Trust signals: legal links proeminentes, footer expansivo com diretórios. Sem big-number social proof na home — assume reconhecimento de marca.
- O que NÃO copiar: a saturação de "Cadastre-se agora" — usar uma vez, com força.
- Link relevante: https://br.linkedin.com/

### Trampos.co (trampos.co)
- Identidade visual: azul + amarelo (setas como acento), tipografia sans-serif moderna, minimalismo, headshots profissionais reais.
- Tom pt-BR: conversacional sem perder credibilidade. "Chega de burocracias" é casual e direto.
- Trust signals: "1,35 milhão de talentos e empresas", "Mais de 20.500 recrutadores confiam na trampos", "Entregamos sua shortlist em até 20 dias", LGPD compliance no footer (relevante para BR).
- O que NÃO copiar: o duplo posicionamento candidato/recrutador na mesma home polui o foco — CareerTwin é candidate-only, deve manter foco único.
- Link relevante: https://www.trampos.co/

## Bloco 3 — Editorial dashboards (Linear, Vercel, Cal.com, Stripe)

Padrões compartilhados que importam: (1) **tipografia neutra-densa como Geist (Vercel) e Inter Tight (Linear)** com pesos variáveis e escala matemática rígida — Vercel opera com "#fafafa body, #171717 ink-near-black e gray scale em 200 steps deliberados"; cada border / disabled / divider vive em um step específico. (2) **Cor primária extremamente restrita** — Linear é roxo + cinzas, Vercel é preto + cinzas + um único accent. CareerTwin já está nesse caminho com verde-limão `#B9D90C` como único accent, o que está CERTO. (3) **Hierarquia por size + weight, não por cor** — títulos grandes, body leve, accent só em CTA/destaque. (4) **Ausência total de gradientes purple-to-blue** — esses dashboards não usam gradiente decorativo, e quando usam é monocromático e funcional (visualizar série temporal, hover). (5) **Componentes com cantos sutis (4-6px), não pílulas rounded-full**. Bricolage Grotesque encaixa nessa família por ser variable font com eixos Weight/Width/Optical-Size — pode fazer display expressivo e text compacto. Onde CareerTwin pode jarrar: misturar serif + mono + grotesque pode virar barulho se as três famílias aparecerem juntas em um mesmo bloco; a regra desses dashboards é "uma família, vários pesos/eixos".

Sources: https://vercel.com/changelog/dashboard-navigation-redesign-rollout — https://design-cal.vercel.app/ — https://www.figma.com/fonts/bricolage-grotesque/

## Bloco 4 — Padrões UX por feature

### Onboarding — quem faz melhor: padrão "Goal-First" (Mantlr 2026)
A referência atual é **Cursor**: a primeira pergunta é "What are you trying to accomplish?" — competência demonstrada em segundos. Teal faz o oposto (cai em dashboard vazio, te empurra para extensão Chrome) e é criticado como "disorienting". Para o CareerTwin, a abertura natural é: "Cole seu CV + cargo-alvo" como ÚNICA decisão da tela 1, com exemplo pré-preenchido visível ("Tente com este CV de exemplo"). Tour de features depois, no dashboard. Microsoft Copilot UX guidance reforça: explicar o que o copilot pode fazer + sugerir como começar > tour de features.

### Loading states — padrão "Activity Feed + Action Preview"
Claude Code mostra **diff preview antes de executar** mudanças significativas; Notion AI / ChatGPT usam streaming token-by-token + skeleton específico por tipo de output. O anti-pattern é o spinner indefinido. Para AI-heavy products em 2026 o padrão emergente é: (a) skeleton com formato do output (não circle-spinner), (b) streaming visível do raciocínio quando faz sentido ("Buscando vagas Adzuna…", "Calculando gap em React…"), (c) activity feed timestamped de tudo que o agente fez. CareerTwin deve mostrar literalmente "Consultando Adzuna…", "Cross-referencing Greenhouse…", "Calculando score…" como linhas de log durante a geração — é diferencial de transparência e encaixa na identidade "auditável".

### Match-score viz — a abertura competitiva do CareerTwin
Jobright e Teal **falham aqui**. Jobright dá "5.5/10 Poor" sem explicação e o número diverge entre Chrome extension e site. JobMatchAI (paper acadêmico citado) usa "87% match primarily due to verified expertise in Python and React" — explicação inline. CareerTwin já tem score auditável visível como decisão de produto — é a oportunidade #1 para ganhar. Padrão recomendado: número grande + barra segmentada por componente (Skills 35/40, Experiência 20/30, etc) + linha "Por que?" expansível mostrando os 3 sinais de maior peso, com link para a evidência no CV. Isso é literalmente o que os concorrentes não entregam.

### Kanban tracking — padrão Huntr, com restrição
Huntr é referência: drag-and-drop entre Wishlist / Applied / Interview / Offer, card consolidando company/role/URL/salary/notes/contatos, extensão Chrome para clip de vaga. Mas o feedback recorrente é "too many extra fields that are confusing". Para CareerTwin: 4 colunas fixas (Interesse, Aplicado, Entrevista, Resposta), card com 5 campos no máximo (empresa, vaga, fonte/link, data, status), tudo a mais vai para o detail panel. Drag-and-drop nativo do browser, sem biblioteca pesada.

### Mobile — padrão "Card stack + thumb zone"
Wobo faz o mais ousado (interface tipo dating app, swipe accept/decline para vagas) — apostamos que isso é PRECOCE para o público BR (recrutador desconfia de aplicação automática, e candidato sênior odeia "tinder de vaga"). Padrões mais seguros: hamburger menu, cards empilhados verticalmente, CTAs thumb-friendly (44px+), score visível sem scroll horizontal. O LinkedIn BR e o Catho ainda têm mobile-web datado — espaço para uma identidade mobile-first editorial é real.

## Anti-patterns observados

- **Gradiente purple-to-blue no hero** (Careerflow tem isso na ilustração circular, vários outros derivam). O "AI slop" research é taxativo: 90% dos dashboards AI-generated têm "Hero Metric Layout" com gradient accent line. NÃO usar.
- **Inter / Roboto / Arial como font padrão.** Inter foi chamado "the Comic Sans of AI" no artigo BSWEN. CareerTwin com Bricolage Grotesque já está fora dessa armadilha — preservar.
- **Match score opaco** (Jobright). Número sem explicação destrói confiança.
- **Onboarding tracker-first sem demonstrar valor primeiro** (Teal). Para um produto novo sem marca, é suicídio.
- **CTA "Sign Up for Free" repetido 6 vezes** (Huntr, Careerflow). Polui, parece desespero.
- **Carrossel infinito de testimonials + FAQ longo + 3 feature cards com ícone** (Jobright, Careerflow). É o "AI slop landing" canônico.
- **Glassmorphism / blur decorativo** (citado pelo anti-pattern guide como sinal de AI-authorship). Blur só se for funcional (overlay de modal).
- **All-caps no CTA principal** (Infojobs "ACHAR VAGAS"). Envelhece.
- **Auto-aplicação em massa "in your voice"** (Wobo). Risco LGPD + ético para BR.
- **Metáforas culturais forçadas** (Vagas.com.br futebol; Trampos.co duplo posicionamento). Misturam mensagem.
- **Stock photos diversas em hero** (Careerflow circular badge arrangement). Genérico ao extremo.

## Recomendações concretas para CareerTwin

### HIGH-impact / LOW-effort (fazer agora)

1. **Onboarding "goal-first" em uma tela.** Substituir qualquer tour/intro por: campo único "Cole seu CV (ou tente com este exemplo)" + campo "Cargo-alvo" + botão "Gerar dossiê". Teal cai em dashboard vazio e é criticado; Cursor pergunta o objetivo e ganha. Tela 1 do `/dossie` deve ser literalmente o input — não onboarding de feature.
2. **Match score com "Por que?" inline.** No card de Career Health Score, abaixo do número principal, render uma barra segmentada por componente (Skills, Experiência, Educação, Match com vaga) e um disclosure "Como calculamos?" que abre os 3 sinais de maior peso com link para a linha do CV que originou. Jobright não faz isso; é nossa abertura.
3. **Loading state como activity feed.** Onde houver chamada LLM ou busca de vagas, render uma lista de linhas que aparecem em sequência: "Lendo CV…", "Consultando Adzuna…", "Consultando Greenhouse…", "Calculando gap…", "Gerando plano de 3 semanas…". Tempo perceptível diminui, e ressoa com "Dossiê editorial" auditável. Padrão Claude Code / Notion AI.
4. **Reduzir CTAs duplicados.** Auditoria do `/entrar` e landing: um CTA primário (verde-limão) por viewport. Padrão Linear/Vercel — eles têm UM botão de destaque, não seis.
5. **Documentar a distinção com careertwin.ai (interview-prep US).** Página `/sobre` ou rodapé deve esclarecer: "Não confundir com careertwin.ai (interview prep)". Evita confusão de marca e ranking, é trabalho de 1 hora.

### HIGH-impact / HIGH-effort (planejar)

1. **Kanban estilo Huntr enxuto.** 4 colunas fixas + card de 5 campos máximo + drag-and-drop nativo. Não é prioridade Fase 1 mas é a feature que retém usuário no Huntr. Implementar quando a tela `/aplicacoes` for prioridade.
2. **Extensão Chrome para clipping de vaga.** Padrão Huntr / Jobright. Aumenta engagement de forma absurda (clip em 1 clique enquanto navega LinkedIn/Catho). Roadmap pós-MVP.
3. **Mobile-first editorial real, não responsive afterthought.** Os concorrentes BR (Catho, Vagas, Infojobs) têm mobile-web datado. Espaço para um produto BR com identidade editorial em mobile é genuíno. Investir em design dedicado de breakpoints mobile (não scaled-down).
4. **"Antes / depois" do CV como peça de marketing.** Careerflow tem before/after — humaniza o valor. Em PT-BR, mostrar uma seção do CV "antes" (genérico) e "depois" (otimizado para a vaga-alvo) com o gap-fill visível e o delta no score. Forte para conversão.
5. **Digest semanal com identidade editorial forte.** Email digest é uma feature já planejada — tratá-lo como newsletter editorial (Bricolage no header, listagem tipográfica de vagas como índice de revista, score evolution chart) e não como notificação SaaS. Diferencia, e email é onde a memória de marca vive.

### Escolhas atuais que já estão CERTAS e devem ser PRESERVADAS

- **Bricolage Grotesque como display.** Está fora da armadilha Inter/Roboto/Arial, está alinhado a Linear/Vercel/Cal.com como editorial-dashboard. Manter.
- **Verde-limão `#B9D90C` como accent único.** Dashboards editoriais top usam UM accent. Trocar para purple/blue seria render-se ao AI-slop. Manter.
- **Score auditável visível com fórmula.** É a abertura competitiva direta contra Jobright/Teal (que são opacos). Manter e expandir com explicação inline.
- **LGPD-by-construction como diferencial de marca BR.** Trampos.co tem LGPD no footer; Final Round AI tem badges de compliance. Para CareerTwin BR, tornar visível na landing (badge sutil ou linha "Construído para LGPD") é trust signal pesado, diferentemente de "Submitted". Manter como pilar.
- **Mistura serif/mono em labels.** É distintiva de identidade editorial, mas usar com disciplina — uma família por bloco, mono apenas em metadados (números, IDs, scores em estado bruto), serif apenas em micro-detalhes citacionais (não em headline). NÃO virar barulho de três famílias no mesmo viewport.
- **Login obrigatório com modo "experimentar" efêmero** (decisão Fase 1). Resolve o anti-pattern do Teal (dashboard vazio antes de mostrar valor) e o anti-pattern do paywall agressivo do Jobright (3 customizações grátis). Manter.

## Apêndice — fontes

- https://www.tealhq.com/ (homepage — 403 via WebFetch, conteúdo via reviews secundárias)
- https://enhancv.com/blog/teal-review/
- https://jobright.ai/
- https://jobright.ai/ai-job-match
- https://hirecarta.com/blog/jobright-review
- https://www.careerflow.ai/
- https://www.wobo.ai/
- https://huntr.co/
- https://huntr.co/product/job-tracker
- https://scoutify.com/blog/huntr-review
- https://www.finalroundai.com/
- https://www.careertwin.ai/
- https://www.catho.com.br/ (404 via WebFetch, conteúdo via jobboardfinder)
- https://www.jobboardfinder.com/jobboard-cathocombr-brazil
- https://www.infojobs.com.br/
- https://www.vagas.com.br/
- https://br.linkedin.com/
- https://www.trampos.co/
- https://mantlr.com/blog/designing-for-ai-agents-ux-patterns-2026 (10 UX patterns AI 2026)
- https://docs.bswen.com/blog/2026-03-20-ai-generated-ui-anti-patterns/ (AI slop anti-patterns)
- https://www.mindstudio.ai/blog/claude-design-avoid-generic-ai-aesthetics
- https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance (Microsoft generative AI UX guidance)
- https://aiuxplayground.com/ (padrões para streaming, autonomia, trust)
- https://vercel.com/changelog/dashboard-navigation-redesign-rollout (Vercel dashboard redesign 2026)
- https://design-cal.vercel.app/ (Cal.com Design Documentation)
- https://getdesign.md/vercel/design-md (análise Vercel design system)
- https://www.figma.com/fonts/bricolage-grotesque/
- https://ateliertriay.github.io/bricolage/ (Bricolage Grotesque official)
- https://arxiv.org/html/2603.14558v2 (JobMatchAI — match score com explicação)
