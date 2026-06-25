# Network Mapping — Research + Spec Técnico

> Status: research-only. Nenhuma linha de código de produção foi escrita.
> Owner: Sérgio. Última revisão: 2026-06-23.
> Audience: time CareerTwin (produto + eng). Tom Tera consultancy — honesto, sem wishlist.

---

## 1. Problema e Hipótese

CareerTwin AI hoje resolve a parte fácil do funil de transição de carreira: descobrir vagas relevantes, gerar CV tailored, escrever cover letter, simular entrevista. Isso ajuda — mas é insuficiente pra perfil sênior.

Caso real que disparou o repensar: **Jamar Martins, Sr/Group PM Bradesco, 7 meses sem job** (jun/2026). Ele testou o produto, achou útil, e ainda assim continuou sem oferta. O bottleneck dele não é CV mal-escrito — é distribuição. Vagas de Sr/Head PM nas top techs (Nubank, Mercado Livre, iFood, Magalu, Loft, QuintoAndar) raramente chegam ao mercado aberto. Quando chegam, têm 800 candidatos qualificados em 48h.

**Hipótese forte**: pra perfis Sr/Group PM, ~70% das contratações acontecem via **indicação interna direta** (1st-degree connection que trabalha na empresa-alvo). Fontes que sustentam a estimativa:

- LinkedIn Talent Solutions 2024 report: "internal referrals account for 30-50% of all hires, and >60% for senior IC roles".
- Gem.com hiring benchmarks 2024: refer-to-hire conversion é 7x maior que cold inbound.
- Reid Hoffman, "The Start-up of You" (2012): "the strength of weak ties" — Mark Granovetter — 1973 paper já mostrou que ~56% dos jobs Sr vinham de contatos de 1º grau (década de 70, antes de LinkedIn). Em mercado tech atual a evidência é que a proporção subiu, não caiu.
- Anecdata Bradesco/Magalu (PMs falando publicamente no LinkedIn): "fiz N entrevistas via referral em vagas que nem viraram public".

A pergunta do produto vira então: **CareerTwin sabe quem o usuário conhece de 1º grau que trabalha nas empresas-alvo dele?** Hoje não sabe. Essa lacuna é o que **Network Mapping** quer endereçar.

Sub-hipótese: se ajudarmos o user a (a) descobrir esses contatos, (b) priorizar quais empresas fazem sentido contatar, (c) escrever a mensagem de intro/referral, a métrica de "time-to-offer" deve cair substancialmente — sobretudo no segmento Sr+, que é onde o CAC do CareerTwin é mais caro de pagar.

---

## 2. Research técnico

### 2.1 LinkedIn API oficial — o que permite?

**TL;DR: praticamente nada útil pra essa feature. Vamos sustentar com fontes.**

LinkedIn tem 4 tiers de API, e o que está acessível ao OAuth comum (developer.linkedin.com público) é trivial. Detalhe:

#### Sign In with LinkedIn (OAuth padrão, escopos `openid profile email`)

Doc: developer.linkedin.com/docs/sign-in-with-linkedin-v2 (atual em 2025-2026).

Escopos disponíveis sem aprovação especial:
- `openid` — token de identidade
- `profile` — nome, sobrenome, foto, locale
- `email` — endereço de email do usuário logado

**O que NÃO devolve**: lista de conexões, empresas onde os contatos trabalham, segundo grau, mensagens, posts, nada. É login social puro.

Endpoints públicos `/v2/me`, `/v2/userinfo`. O endpoint `/v2/connections`, que existiu em 2015, foi **deprecado em 2018** e jamais retornou. Quem tenta hoje recebe 403/410.

#### Marketing Developer Platform

Foco em rodar ads via API. Não tem nada de network do usuário. Irrelevante pro escopo.

#### LinkedIn Sales Navigator API (parte de Sales Solutions)

Doc: learn.microsoft.com/en-us/linkedin/sales/

Permite ler search results de leads, "TeamLink" (quem do meu time conhece esse lead), enriquecimento de empresas. Pré-requisitos:
- Conta Sales Navigator Advanced Plus (~USD 150/mês/user)
- Contrato B2B assinado com LinkedIn (mín. 10 seats, cycle anual)
- Aprovação como parceiro técnico (months)

**Veredito**: inviável pra CareerTwin enquanto produto B2C/PLG. Single-user não tem acesso à API, é dashboard-only.

#### LinkedIn Talent Solutions / Recruiter System Connect (RSC) / Talent Hub APIs

Doc: learn.microsoft.com/en-us/linkedin/talent/

A feature que o usuário do Recruiter vê como "Common Connections" / "Find Shared Connections" (botão que mostra quem do time do recrutador conhece um candidato) só é acessível dentro do produto Recruiter. A API expõe parcialmente isso pra ATS (Greenhouse, Lever), mas:

- Requer contrato Talent Hub ou Recruiter Corporate (~USD 12k+/seat/ano)
- Requer aprovação como ATS parceiro (LinkedIn é restritivo)
- Caso aprovado: dados são **da conta da empresa do recrutador**, não do user final

**Veredito**: pra um produto que assiste o candidato (não o recrutador), inacessível.

#### Conclusão honesta da seção 2.1

> Não dá pra construir Network Mapping em cima da LinkedIn API oficial sem virar parceiro Talent Solutions / Sales Navigator. Isso custa centenas de milhares de USD/ano de comprometimento, leva meses de approval, e mesmo aprovado o produto correto seria voltado a recrutador, não a candidato. Caminho fechado.

---

### 2.2 Alternativas legais

Cinco caminhos plausíveis, ordenados do mais defensável ao mais arriscado:

#### A) Export oficial de conexões pelo próprio usuário (LinkedIn Data Export)

LinkedIn permite — e isso é direito do user pelo GDPR Art. 15 e LGPD Art. 18 — exportar **todos os dados pessoais** dele. Inclui `Connections.csv`: nome, sobrenome, URL, email (quando disponível), empresa atual, cargo, data da conexão.

Fluxo manual: Settings & Privacy → Data Privacy → Get a copy of your data → Want something in particular? → Connections → Request archive. Chega por email em ~5-10 minutos.

CSV tem ~5 colunas, formato estável há anos:
```
First Name, Last Name, URL, Email Address, Company, Position, Connected On
```

**Vantagens**:
- 100% consentido pelo titular (LGPD-friendly por design)
- Sem custo
- Não fere ToS de ninguém
- Bate exatamente o caso de uso (1st-degree apenas, que é o que importa)

**Desvantagens**:
- Fricção: user precisa fazer 4 cliques + esperar email
- Dado fica congelado no momento da exportação (não atualiza)
- ~50-70% das linhas vêm sem email (LinkedIn esconde se o contato não optou em compartilhar)

**Veredito**: caminho recomendado pro MVP. Detalhamento em §3.

#### B) LinkedIn Sales Navigator (visibilidade de 2nd/3rd degree)

Já discutido em §2.1. Sales Navigator user final vê 2nd/3rd degree, mas a API é restrita a parceiros B2B. Se quiser oferecer essa visão pro user, ele teria que assinar Sales Nav (~USD 79/mês) e usar manualmente. Pra automatizar via CareerTwin precisaríamos virar parceiro.

**Veredito**: roadmap fase 2+, condicionado a parceria. Não MVP.

#### C) Apollo.io API

apollo.io — banco de contatos B2B com ~275M de contatos pessoais (estimativa Apollo 2024). Dado vem de várias fontes: LinkedIn público scrapeado em escala, filings SEC, leaks corporativos consentidos, indicações de SDRs que usam a plataforma. Preço API: free tier 50 calls/mês, paid começa em ~USD 49/mês/seat com volume sério em ~USD 119/mês.

Endpoints relevantes:
- `POST /v1/people/match` — cruza nome+empresa e retorna email + LinkedIn URL
- `GET /v1/mixed_people/search` — busca por empresa, role, geo

**Uso que faria sentido pra CareerTwin**: enriquecer perfis das vagas-alvo (achar PMs sêniores da Magalu, ex.), **não** mapear a rede do user. Apollo não sabe quem o user conhece — sabe quem existe nas empresas.

**Risco LGPD**: Apollo opera nos termos de "interesse legítimo" do GDPR. Brasil ANPD ainda não tem decisão pública sobre data brokers tipo Apollo. Se passar a oferecer enriquecimento agressivo, precisa DPO review.

**Veredito**: útil pra um produto adjacente ("descobrir PMs sêniores em Y empresa"), mas não substitui mapping de network do user. Possível fase 2.

#### D) Lusha, ZoomInfo, Hunter.io

Mesma categoria de Apollo (B2B contact enrichment). Lusha ~USD 49/mês, ZoomInfo enterprise-only (~USD 15k/ano). Hunter foca em encontrar email a partir de domínio. Nenhum sabe quem o user conhece.

**Veredito**: alternativas a Apollo, mesma utilidade limitada pro problema-foco. Pular por enquanto.

#### E) Phantombuster, Linked Helper, Dripify (scraping/automação browser)

Categoria que faz o que os outros não fazem: automatiza navegação no LinkedIn logado do user e raspa dados que aparecem na UI. Pode listar 1st-degree, 2nd-degree, etc.

**Problema 1 — ToS LinkedIn**: User Agreement §8.2 proíbe explicitamente "use, copy, distribute scraped data". Ação típica: account ban permanente (LinkedIn faz isso ativamente em 2024-2026, vários casos públicos com ações coletivas em curso).

**Problema 2 — Jurisprudência**: hiQ Labs v. LinkedIn (US, 2022 final ruling no 9th Circuit): scraping de dados *públicos* não viola CFAA, **mas** viola contrato (ToS) se a conta usada estiver logada. Em prática: scraping logged-in é proibido contratualmente.

**Problema 3 — LGPD**: scraping de dados de terceiros (mesmo "públicos") sem base legal robusta é território perigoso. Apollo tem armada jurídica e DPO; CareerTwin não. ANPD pode multar até 2% do faturamento por incidente.

**Problema 4 — UX**: user precisa instalar extensão Chrome, deixar rodando, esperar 2-4h por mapping completo. Conversão despenca.

**Veredito**: NÃO recomendado. Risco jurídico desproporcional ao benefício, mesmo que a feature técnica seja tentadora. Excluído do roadmap.

#### F) Caminho manual (fallback)

User pesquisa 1-by-1 quem conhece em cada empresa-alvo. CareerTwin ajuda só com a lista de empresas e templates de mensagem. Não é "network mapping" de fato, é "intro template generator". Já está parcialmente implementado.

**Veredito**: já existe. Não conta como feature nova.

---

### 2.3 Casos análogos no mercado

#### Crystal Knows (crystalknows.com)

Posicionamento: "personality data on every professional". Usa perfil público LinkedIn + processamento psicometrico (DISC) pra gerar dossiê de personalidade. Não mapeia network — mapeia *gente individual*. Caso de uso: prep pra sales call ou entrevista.

Tech: scraping de perfis públicos LinkedIn (sem login) + Crystal Profile API pago. Modelo similar a Apollo no acesso, mas vertical diferente.

Lição pra CareerTwin: confirma que scraping de dados públicos LinkedIn tem precedente comercial sustentável, mas Crystal opera em zona cinza e periodicamente entra em disputa com LinkedIn.

#### Apollo.io

Já coberto §2.2. Sumário: B2B contact database, 275M+ pessoas. Endpoints `/people/match` resolvem "achar fulano sênior na empresa X", não "quem eu conheço".

Lição: não substitui mapping de network. Complemento eventual.

#### Lusha (lusha.com)

Contact enrichment B2B. Chrome extension lê perfil LinkedIn e devolve email + telefone. Banco de ~100M contatos. Pro caso CareerTwin, mesma limitação de Apollo: sabe que existe, não sabe que você conhece.

#### LinkedIn Recruiter — Feature "Common Connections" / "TeamLink"

Como o produto-mãe resolve isso:

1. Recrutador faz search por candidato/lead.
2. UI mostra badge "2 shared connections via TeamLink".
3. Click expande lista: João Silva (head of eng, Magalu) e Maria Santos (PM, iFood) ambos conectam você ao candidato.
4. Botão "Ask for intro" gera template de mensagem ao João/Maria.

Tech por trás: LinkedIn cruza o grafo de conexões do recrutador (e do time TeamLink dele) com o grafo de conexões do candidato em queries server-side. Não expõe esse cruzamento via API externa.

**Insight crítico**: o produto correto pra inspirar CareerTwin é Recruiter, não Sales Nav nem Apollo. Mesmo fluxo, mas o "team" do CareerTwin é o user solo + a rede dele. Vamos replicar a UX/UVP, sem ter o LinkedIn como API backend.

#### Reverse Recruiter / "Done-for-you job search" (Find My Profession, Career Karma, etc.)

Categoria humano-in-the-loop: você paga USD 1500-5000/mês, alguém manualmente mapeia sua rede, escreve as mensagens, agenda as conversas. Validação anecdotal de que o serviço **existe e tem demanda**, e o que CareerTwin quer fazer é a versão escalável/AI dessa proposta.

---

### 2.4 Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Scraping/automação LinkedIn quebra ToS, leva a account ban do user | Alta | Não fazer. Caminho A (export user-initiated) elimina o risco. |
| PII de terceiros (nomes/emails dos contatos do user) na nossa DB | Alta | TTL 60 dias, audit log, right-to-delete por email, banner explícito de consentimento implícito limitado a uso pessoal. |
| LGPD Art. 7 (base legal): processamos PII sem consentimento do titular contato | Alta | Base legal = "interesse legítimo do user titular do export" + "minimização" (não enriquecemos, não vendemos, não compartilhamos). Documentar DPO/relatório de impacto. |
| ANPD fiscaliza e nos enquadra como "data broker" | Média | Recusar todo modelo de monetização baseado em vender insights agregados. CareerTwin = ferramenta pessoal do user, não broker. |
| Apollo/Lusha futuros perderem acesso a LinkedIn (decisão judicial) | Média | Caminho A não depende de terceiros. Se Apollo virar fase 2, ter fallback gracioso. |
| Custo de storage explode com user importando 30k contatos | Baixa | Limite 10k/import, índices certos, deletar exports antigos via TTL. |
| Feature ser usada pra spam / cold outreach em massa | Média | Rate-limit de "gerar template" por user/dia, copy do template anti-spammy, monitoring de uso anômalo. |
| Concorrente clonar a feature | Baixa | É exatamente onde defensibilidade está em ser parte de um produto integrado, não numa lib isolada. |

---

## 3. Spec da feature proposta

### 3.1 MVP mínimo (4-6 semanas dev)

**Premissa**: caminho A (export oficial CSV) é o único defensável legalmente, barato, e que entrega valor real. Tudo no MVP é em cima dele.

**Escopo do MVP**:
1. Página `/network` com instrução clara de como exportar do LinkedIn (com screenshots).
2. Upload de `Connections.csv` (validação de schema, parsing, persistência).
3. Dashboard "X contatos importados, distribuídos em Y empresas" com top empresas.
4. Filtro/busca por empresa-alvo (cruza com a lista de empresas que o user já marcou como target no perfil dele).
5. Botão "ver detalhes" abre lista de contatos naquela empresa com link pro perfil LinkedIn.
6. Botão "gerar template de intro" — LLM call que produz mensagem personalizada baseada no contexto (cargo do contato, empresa, vaga-alvo do user).
7. Botão "marcar como contatado" — track em UI, sem callback automático (user reporta).
8. Botão "deletar este import" / "deletar este contato" — LGPD compliance.

**Fora do escopo do MVP** (vão pra fase 2):
- Sales Navigator integration
- Apollo enrichment
- AI-rerank por "intro velocity" (quanto tempo o user e o contato não falam)
- Visualização gráfica do network
- Cross-reference automático com JD da vaga
- Enviar a mensagem de intro pelo CareerTwin (mailto: do user direto)
- Web extension Chrome
- Re-import incremental (delta)

**Critério de sucesso pra promover de MVP**:
- ≥30% dos usuários ativos importam pelo menos 1 CSV em 30 dias
- ≥10% reportam "fui contatado" / "consegui intro" em 60 dias
- 0 incidentes LGPD em 90 dias

---

### 3.2 Fluxo do user (10 passos)

```
┌─ Passo 1 ────────────────────────────────────────────────────────┐
│ User clica em "Network" no menu lateral. Cai em /network.        │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 2 ────────────────────────────────────────────────────────┐
│ Tela com 2 colunas:                                              │
│  - Esquerda: tutorial "Como exportar contatos do LinkedIn"        │
│    com 4 prints + texto curto. ~30 segundos pra ler.              │
│  - Direita: drop zone "Solte aqui o Connections.csv"              │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 3 ────────────────────────────────────────────────────────┐
│ User vai no LinkedIn, faz o export, baixa o ZIP, abre, pega      │
│ Connections.csv, arrasta pra dropzone.                            │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 4 ────────────────────────────────────────────────────────┐
│ Cliente envia POST /api/network/import (multipart).               │
│ Server: streaming parse, valida header, normaliza, persiste em    │
│ batch. Retorna { batchId, contactsImported, companiesDetected }.  │
│ DADO É ARMAZENADO SOMENTE NA ROW DO USER. ZERO COMPARTILHAMENTO.  │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 5 ────────────────────────────────────────────────────────┐
│ Dashboard: "1247 contatos importados, distribuídos em 312         │
│ empresas". Top empresas: Magalu (8), iFood (6), Nubank (5)...     │
│ Banner: "Mantemos seus dados por 60 dias. Depois, re-importe."    │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 6 ────────────────────────────────────────────────────────┐
│ Filtro/search: user digita "magalu". Highlight nas 8 linhas        │
│ matched. Alternativamente: chip clicável "Suas empresas-alvo"      │
│ que cruza com lista do perfil dele (Profile.targetCompanies).       │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 7 ────────────────────────────────────────────────────────┐
│ Click numa empresa → drill-down. Lista de contatos com:           │
│   - Nome completo                                                  │
│   - Cargo atual                                                    │
│   - Botão "Ver no LinkedIn" (linka pro URL do export)              │
│   - Botão "Gerar mensagem de intro"                                │
│   - Toggle "Já contatei"                                           │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 8 ────────────────────────────────────────────────────────┐
│ User clica "Gerar mensagem". Sistema chama LLM com prompt:        │
│   - Cargo do contato                                               │
│   - Cargo do user (do Profile)                                     │
│   - Vaga-alvo (escolhe da lista do user)                           │
│   - Tom escolhido (formal / casual / brief)                        │
│ Retorna 3 variantes da mensagem. User copia.                       │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 9 ────────────────────────────────────────────────────────┐
│ User cola no LinkedIn DM (manualmente). Volta no CareerTwin e     │
│ marca "Contatado em DD/MM". Track persiste pra futuras analytics.  │
│ Não enviamos mensagem em nome do user — evita risco LGPD/ToS.      │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌─ Passo 10 ───────────────────────────────────────────────────────┐
│ User pode, a qualquer momento, ir em "Meus imports", ver lista   │
│ de batches passados, e clicar "Apagar import inteiro" ou apagar   │
│ contato individual. Cascade delete. Confirmação modal.            │
└──────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Schema de dados (Prisma)

Modelos novos. Adicionam-se ao `schema.prisma` existente. Convenção cascade-delete da nossa stack mantida.

```prisma
// ============ Network Mapping (Fase 1.5) ============

// Cada vez que o user faz upload, cria um batch. Permite re-import + delete-by-batch.
model NetworkImportBatch {
  id              String   @id @default(cuid())
  userId          String
  importedAt      DateTime @default(now())
  expiresAt       DateTime // = importedAt + 60 dias (TTL LGPD)
  source          String   @default("linkedin_csv") // futuro: "sales_nav", "apollo"
  filename        String?  // nome do arquivo original (não-PII)
  contactCount    Int      @default(0)
  companyCount    Int      @default(0)

  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  contacts        NetworkContact[]

  @@index([userId, importedAt])
  @@index([expiresAt]) // cron de TTL roda em cima desse índice
}

// Cada linha do CSV vira um NetworkContact. Não tem unique global — é
// totalmente "owned" pelo user que importou.
model NetworkContact {
  id              String   @id @default(cuid())
  userId          String
  batchId         String

  // Dados do export
  fullName        String   // "João Silva"
  firstName       String?
  lastName        String?
  linkedinUrl     String?  // não unique (mesma pessoa pode aparecer em outros users)
  email           String?  // muitas vezes null (LinkedIn esconde)
  currentCompany  String?  // normalizado lowercase + trim
  currentRole     String?
  connectedOn     DateTime?

  // Tracking de uso pelo user
  contactedAt     DateTime?
  notes           String?  @db.Text

  // Soft-flag de "esse contato pediu remoção" — LGPD anonymous-delete
  anonymizedAt    DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  batch           NetworkImportBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)

  // Index pra busca rápida "quem eu conheço na Magalu"
  @@index([userId, currentCompany])
  @@index([userId, batchId])
  @@index([userId, contactedAt]) // pra dashboard "já contatei N pessoas"
}

// Audit log dedicado pra Network — cada visualização/export/listagem grava.
// Roda fora do AuditLog principal pra não inundar a tabela genérica.
model NetworkAccessLog {
  id              String   @id @default(cuid())
  userId          String
  action          String   // "import" | "view_company" | "view_contact" | "generate_intro" | "delete_contact" | "delete_batch"
  targetId        String?  // contactId ou batchId, se aplicável
  metadata        Json?    // ex: { company: "Magalu", contactCount: 8 }
  ipHash          String?  // SHA-256 do IP, não o IP cru
  userAgent       String?
  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
}
```

Migração no `User` pra adicionar back-relations:

```prisma
// dentro de User { ... }
  networkBatches    NetworkImportBatch[]
  networkContacts   NetworkContact[]
  networkAccessLogs NetworkAccessLog[]
```

**Observações**:
- `NetworkContact.email` é nullable e a maioria dos rows vão ser null. Tudo bem — pra MVP a feature funciona com nome+empresa+URL.
- Não temos unique constraint em `linkedinUrl` global. É escolha consciente: a mesma pessoa pode aparecer no export de 100 users diferentes; cada um "possui" a sua linha.
- `anonymizedAt` é soft delete pra LGPD: se um contato pedir remoção via `/api/network/contact/anonymous-delete?email=X`, marcamos a row, escondemos da UI, mas mantemos o id pra audit. Hard delete só após cron mensal limpar > 30 dias com `anonymizedAt`.

---

### 3.4 Rotas API

| Método | Path | Descrição | Auth |
|---|---|---|---|
| POST | `/api/network/import` | Recebe `Connections.csv` em multipart. Streaming parse, persiste batch. Retorna `{ batchId, contactCount, companyCount, topCompanies: [...] }`. Limites: 5 MB / 10k linhas. | session required |
| GET | `/api/network/overview` | Dashboard: totais, top empresas, batches ativos (não expirados). | session required |
| GET | `/api/network/by-company?slug=magalu` | Lista contatos do user em uma empresa. Suporta paginação. | session required |
| GET | `/api/network/contact/:id` | Detalhes de 1 contato. Grava `NetworkAccessLog`. | session required, ownership check |
| POST | `/api/network/contact/:id/contacted` | Marca `contactedAt = now()`. Idempotente. | session required, ownership check |
| DELETE | `/api/network/contact/:id` | Hard delete de 1 contato. Grava audit. | session required, ownership check |
| DELETE | `/api/network/batch/:id` | Hard delete cascade do batch + todos contatos. | session required, ownership check |
| POST | `/api/network/intro-template` | Body: `{ contactId, jobTargetId?, tone? }`. Chama LLM, retorna 3 variantes de DM. Rate-limit: 30/dia/user. | session required, ownership check |
| POST | `/api/network/contact/anonymous-delete` | Body: `{ email }`. Marca `anonymizedAt` em todas as rows com aquele email, em **todos** os users. Sem auth (LGPD Art. 18). CAPTCHA + rate-limit por IP. | público, captcha |
| GET | `/api/network/export` | LGPD Art. 15: user baixa CSV com tudo que importou. Inclui audit log. | session required |

**Cron** (não é API, é background):
- `cron-network-ttl` — diário, deleta `NetworkImportBatch` com `expiresAt < now()` (cascade pega os contatos). Notifica user 7 dias antes via in-app + email.
- `cron-network-anonymize-cleanup` — mensal, hard-delete em `NetworkContact` com `anonymizedAt > 30 dias`.

**Notas de segurança importantes** (consultar skill seguranca-careertwin antes de implementar):
- Todas as rotas com `:id` precisam de ownership check explícito (`WHERE userId = session.userId`).
- `POST /api/network/import` precisa rate-limit por user (1 import / 5min), validação de content-type/size, sanitização do CSV (CSV injection: prefixar `'` em células que começam com `=`, `+`, `-`, `@`).
- `POST /api/network/intro-template` é endpoint LLM-backed: aplicar prompt-injection guard, log input, não vazar PII pra logs do provider quando possível.
- `POST /api/network/contact/anonymous-delete` é o vetor mais sensível: rate-limit IP + captcha + email-verification opcional (envio de magic link pra confirmar).

---

### 3.5 LGPD + Privacy

**Esta seção é não-negociável.** O dado processado aqui é PII de **terceiros** (não do user logado). Tratamento padrão da nossa stack pra dados do próprio user não é suficiente.

#### Base legal

LGPD Art. 7 lista 10 bases legais possíveis. As candidatas:
- **VII — proteção do crédito** (não se aplica)
- **IX — interesse legítimo do controlador ou de terceiro** ← essa é a sustentação

O argumento é: o user titular dos contatos exporta seu próprio grafo de relacionamentos profissionais (direito dele) e usa essa informação pra propósitos legítimos de busca de emprego pessoal (relação 1-pra-1 com pessoas que ele já conhece). Não há tratamento massivo, não há comércio, não há perfilamento dos terceiros pelo controlador (CareerTwin).

**Importante**: esse argumento se fragiliza muito se virarmos data broker (vender insights agregados). Compromisso institucional: nunca fazer isso.

#### Mitigações obrigatórias

| # | Mitigação | Implementação |
|---|---|---|
| 1 | **Banner explícito no upload** | Modal pré-upload com texto: "Você está enviando dados de pessoas físicas (seus contatos). Ao prosseguir, confirma que (a) os usará apenas pra finalidade pessoal de busca de emprego, (b) não compartilhará nem revenderá, (c) que está ciente de que poderá excluir tudo a qualquer momento, (d) que respeitará pedidos de remoção pelos titulares." Checkbox obrigatório. |
| 2 | **TTL automático 60 dias** | Definido em `NetworkImportBatch.expiresAt`. Cron diário deleta. Aviso 7 dias antes. |
| 3 | **Right to delete (LGPD Art. 18)** | Página pública `/privacidade/network` com explicação + form. Endpoint `/api/network/contact/anonymous-delete` recebe email, marca todas as rows com aquele email em todos os users como `anonymizedAt`. Cron mensal hard-deleta após 30 dias. |
| 4 | **Audit log de acesso** | Todo `view_company`, `view_contact`, `generate_intro` grava `NetworkAccessLog`. User pode baixar log via `/api/network/export`. Não exposto a outros users. |
| 5 | **Sem enriquecimento automático** | Não cruzamos com Apollo/Lusha por padrão. Não inferimos email se não veio no export. Dado fica congelado. |
| 6 | **Sem cross-user lookup** | NUNCA exibir pro user A que o user B tem o contato Y. Mesmo internamente. Cada user vê só seu grafo. |
| 7 | **Sem export agregado** | Não geramos relatórios "top 10 empresas com mais contatos na base CareerTwin". Internamente ok pra analytics agregadas anônimas (k-anonymity ≥ 50). Externamente nunca. |
| 8 | **Minimização** | Não importamos campos do export que não usamos (foto, etc — CSV não traz, ok). Não adicionamos campos calculados que não justifiquem. |
| 9 | **Data Protection Impact Assessment (DPIA)** | Antes do launch: rodar DPIA formal com DPO. Documentar finalidade, risco, mitigação, base legal. Arquivar. |
| 10 | **Política de incidentes** | Plano formal: vazamento detectado → notificar ANPD em 24h (LGPD Art. 48), users afetados em 72h. |
| 11 | **Sub-processadores transparentes** | Listar em `/privacidade`: Vercel (host), Postgres provider, OpenAI/Anthropic (LLM). DPA assinado com cada um. |

---

## 4. Roadmap fase 2 (pós-MVP)

Apenas se o MVP atingir critério de sucesso (§3.1):

| Feature | Esforço | Pré-requisito |
|---|---|---|
| **AI-rerank por "intro velocity"** — priorizar contatos com quem o user falou recentemente (precisaria, p.ex., parse do `Messages.csv` do export, que tem últimas trocas) | 1 sprint | export tipo Messages.csv ser opt-in pelo user |
| **Sales Nav integration** — pra user premium que tem assinatura própria do Sales Nav, OAuth integration | 3-4 sprints | parceria LinkedIn ou alavancar OAuth de user |
| **Cross-reference com vagas abertas** — quando o user marca uma vaga como "alvo", banner "você conhece 4 pessoas na Magalu, ver?" | 1 sprint | tracking de "vagas-alvo" já existir no produto |
| **Network strength score** — métrica de "quão forte é seu network nas suas empresas-alvo" pra orientar onde investir esforço | 1-2 sprints | nada novo |
| **Visualização de network como grafo** — D3.js força-dirigida, user-empresa-contato | 2 sprints | nada novo, mas perigo de "feature legal mas pouco usada" |
| **Apollo enrichment opt-in** — premium feature pra achar email de contatos sem email | 2 sprints | contrato Apollo + revisão LGPD |
| **Re-import incremental (delta)** — em vez de novo CSV completo, importa só novos contatos desde último import | 2 sprints | mecanismo robusto de matching |
| **Browser extension de coleta (legal-friendly)** — extensão Chrome que ajuda user a coletar quando navegando, com consentimento explícito por ação. Zona cinza. | 4 sprints | review jurídico pesado, sem garantia |

Priorização sugerida pós-MVP: cross-reference vagas (1) → Apollo enrichment (2) → intro velocity (3) → resto conforme métricas.

---

## 5. Estimativa

Assumindo 1 dev full-stack mid-sênior + design support part-time + revisão LGPD (DPO consultancy 8h).

| Sprint | Duração | Entrega |
|---|---|---|
| Sprint 1 | 2 semanas | Schema Prisma + migrations + audit log infra. Página `/network` skeleton. Tutorial de export (texto + screenshots). Upload básico + parse CSV. |
| Sprint 2 | 2 semanas | Dashboard de overview. Filtro por empresa. Lista de contatos por empresa. Delete batch / contact. Rate-limits básicos. |
| Sprint 3 | 1-2 semanas | Endpoint intro-template (LLM call). 3 variantes de tom. Tracking de "contatado". Endpoint anonymous-delete + página pública. |
| Hardening + DPIA | 1 semana | DPIA formal. Pen-test mini. Auditoria de logs PII em provider LLM. Cron TTL + anonymize-cleanup. Rollout gradual feature-flag. |

**Total**: 6-7 semanas (a meta de "4-6 semanas" é factível só se o sprint 3 e hardening andarem em paralelo, com risco). Recomendação honesta: **6 semanas** como compromisso, **8 semanas** como buffer pra LGPD review pegar pendências.

Custos diretos:
- Infra: ~+USD 20/mês no Postgres (storage + índices, ~10k contatos/user × 1000 users)
- LLM: ~USD 0.02 por geração de template × ~3 gens/user/mês × N users → orçamento previsível
- DPO consultancy: ~USD 1500 one-shot pro DPIA + review periódico anual ~USD 800
- Pen-test: opcional, ~USD 3-5k se externo

---

## 6. Aberto pra discussão

Decisões que precisam input humano antes do start:

1. **Pricing** — feature premium ou included? Hipótese forte: **included no plano standard** pra que vire diferencial competitivo e gancho de PR. Premium poderia ser "Apollo enrichment" em fase 2.
2. **Limite de contatos** — 10k por import suficiente? Power-users no LinkedIn batem 15-30k. Decidir: 10k hard cap ou 30k pra premium?
3. **Sales Nav integration** — vale priorizar pós-MVP ou skipar pra Apollo direto? Sales Nav exige parceria LinkedIn (caro). Apollo é contrato comercial direto. Tradeoff de canal: Sales Nav é onde o user power já está; Apollo é onde o dado mais limpo está.
4. **Cobrar fee pelo intro template AI?** — gerar mensagem é custo LLM. Limite 30/dia/user free é razoável? Ou contar quotas no plano?
5. **Disponibilizar a feature pra mercado fora do BR?** — LGPD é nosso, mas GDPR cobre o mundo. Mitigações são as mesmas. Não há fricção técnica em internacionalizar; mas o copy e UX testáveis começam em PT-BR.
6. **Endpoint de anonymous-delete: exigir verificação de email do solicitante?** — sem verificação, alguém pode fazer flood de delete malicioso (e.g. "deletar todos os contatos do João"). Com verificação, fricção LGPD aumenta. Tradeoff. Recomendação: verificação por magic link.
7. **Comunicação proativa aos titulares?** — Some products avisam: "fulano subiu seus contatos, ele pode contatar você". Não há obrigação LGPD de avisar (estamos cobertos por interesse legítimo do user titular). Tradeoff: avisar é hyper-respectful mas alfineta a feature.

---

## 7. Recomendação final

**Vale construir? Sim, mas com priorização criteriosa.**

Pontos fortes do investimento:
- Endereça a hipótese mais forte que temos hoje sobre por que CareerTwin sozinho não converte em offer pra perfil Sr+.
- Defensibilidade real do produto: é a primeira feature que escala a parte humana (network) com a parte AI (mensagem + insights).
- Custo de construção razoável (~6 semanas) versus impacto potencial em LTV.
- Path técnico é sólido: caminho A (export CSV) elimina todo risco regulatório/contratual que tornaria a feature inviável.

Pontos de cautela:
- LGPD compliance é a parte mais cara do projeto. Não é programação — é processo. DPIA, DPO, banner, audit, anonymous-delete — tudo precisa estar maduro antes de release. Tentar pular vira passivo.
- Risco de feature ser "legal mas pouco usada": uploads de CSV têm fricção real. Precisa de UX excelente no tutorial e dashboard.
- Não substitui a parte conversacional (intro template AI), que é onde mora a magia. Se a mensagem gerada for ruim, a feature vira "lista de contatos" e perde valor.

**Quando construir?**

Recomendação: **agora**, depois de Fase 1 (auth + onboarding básico) estar estável em produção e com ~50 users ativos pra validar premissas iniciais com bateria de entrevistas qualitativas. **Não construir antes** porque (a) sem usage base não consegue medir critério de sucesso, (b) sem feedback de user já onboardado o UX do upload sai genérico demais.

**Prioridade vs. outras features no roadmap**:
- Acima de: visualização de network como grafo (eye-candy), funcionalidades de gamificação que estão no roadmap, integrações com ATS de empresa.
- Abaixo de: estabilidade do core (CV tailor, onboarding, billing), nada do que CareerTwin já faz pode regressar.

**Bottom line**: feature de alto impacto, baixo-médio custo técnico, médio-alto custo regulatório. Vale a pena se entrarmos com a postura de fazer LGPD direito desde o dia 1. Não vale a pena se for tratada como "envia o CSV pra DB e pronto" — a primeira reclamação ANPD destrói confiança do user.

---

> Próximo passo proposto: validar com 5-10 entrevistas qualitativas (incluindo Jamar) se eles fariam o upload do CSV e se entendem a UX do tutorial. Se sim, agendar DPIA com DPO em paralelo ao Sprint 1. Se a maioria desistir no upload, repensar caminho A versus aceitar custo de Sales Nav/Apollo na fase 2.

