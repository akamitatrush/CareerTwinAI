# Pesquisa de providers BR (jun/2026)

Este doc registra a investigacao feita ao avaliar 2 plataformas BR de vagas
(Programathor e Remotar) como candidatas a integrarem o radar
(`lib/jobs/providers/*`). Spoiler: **nenhuma das duas tem feed publico estavel
e gratuito**, entao nao foi feito wire-up. Em vez disso, expandimos o catalogo
de fixtures BR (ver `lib/jobs/providers/fixtures.js`).

## Programathor (programathor.com.br)

Plataforma BR especializada em vagas tech. Hipotese inicial: feed JSON publico
em `/api/v1/opportunities.json`.

### URLs testadas

Todas via `curl -s -w "%{http_code}"` em 22-jun-2026.

| URL                                                    | Resultado                                  |
| ------------------------------------------------------ | ------------------------------------------ |
| `https://programathor.com.br/api/v1/opportunities.json` | HTML 404                                  |
| `https://programathor.com.br/opportunities.json`        | HTML 404                                  |
| `https://programathor.com.br/api/opportunities.json`    | HTML 404                                  |
| `https://programathor.com.br/api/v1`                    | HTML 404                                  |
| `https://programathor.com.br/api/v1/`                   | HTML 404                                  |
| `https://programathor.com.br/api/v1/jobs`               | `{"errors":["Invalid credentials!"]}` 403 |
| `https://programathor.com.br/api/v1/jobs.json`          | `{"errors":["Invalid credentials!"]}` 403 |
| `https://programathor.com.br/jobs.json`                 | `{"status":406,"error":"Not Acceptable"}` |
| `https://programathor.com.br/vagas.json`                | HTML 404                                  |
| `https://programathor.com.br/vagas`                     | HTML 404                                  |

### Conclusao

Existe uma API em `/api/v1/jobs` mas exige credenciais (HTTP 403 `Invalid
credentials!`). Nao ha documentacao publica de como obter chave — provavelmente
requer cadastro como parceiro / empresa contratante. Nao serve pro nosso caso
de uso (busca anonima de vagas).

`robots.txt` permite indexacao do site publico mas a API nao expoe rota free
para listagem programatica. **Provider NAO implementado.**

## Remotar (remotar.com.br)

Plataforma BR de vagas 100% remotas. Hipotese inicial: feed RSS em `/feed/jobs`.

### URLs testadas

| URL                                | Resultado |
| ---------------------------------- | --------- |
| `https://remotar.com.br/feed/jobs` | HTML 200 (SPA Next.js, sem RSS real) |
| `https://remotar.com.br/feed`      | HTML 200 (idem) |
| `https://remotar.com.br/`          | HTML 200 (idem) |

### Conclusao

Site e SPA renderizado em Next.js. Nao expoe feed RSS/JSON publico. Parser de
HTML seria fragil (DOM muda a cada deploy) e cair em area cinzenta de ToS.
**Provider NAO implementado.**

## Outras plataformas BR investigadas (rejeitadas)

- **Catho** — ToS bloqueia uso programatico, requer login.
- **Vagas.com** — idem, anti-bot agressivo (Cloudflare).
- **Gupy** — ATS B2B, nao tem feed publico agregado.
- **InfoJobs BR** — API requer parceria paga.
- **LinkedIn Jobs** — ToS bloqueia scraping; Talent Solutions e pago.

## Acao tomada

Em vez de wire-up de provider real, **expandimos fixtures** (`lib/jobs/providers/fixtures.js`)
com mais ~15 vagas BR-flavored (empresas ficticias plausiveis em PT-BR,
descricoes ricas em skills da taxonomy, faixas salariais em R$). UI continua
sinalizando "Ilustrativo" via chip — usuario sabe que nao e vaga real.

## Pra investigar no futuro

Plataformas BR com potencial pra feed publico ou API free-tier:

- **Coodesh** (coodesh.com) — comunidade dev BR, possivel API de oportunidades.
- **GeekHunter** (geekhunter.com.br) — recrutamento tech BR, verificar se tem feed.
- **Trampos.co** — design/criativos, alguma exposicao publica.
- **REMOTE OK** (remoteok.com) — global mas tem BR; tem `/remote-jobs.json`
  publico, ja testado em outros projetos e funciona.
- **Web3 Career** (web3.career) — feed JSON publico (`/jobs.json`).
- **WeWorkRemotely** — RSS publico em `/categories/.../jobs.rss`.

Recomendacao: priorizar **RemoteOK** + **WeWorkRemotely** como proximos providers
(globais mas com forte oferta de remoto BR-friendly), ambos com feed publico
estavel documentado.
