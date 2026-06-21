# CareerTwin AI — MVP funcional

Copiloto de empregabilidade com **gêmeo digital de carreira**. O usuário cola o currículo + cargo-alvo; a IA estrutura o perfil, calcula um **Career Health Score auditável**, mapeia lacunas de competências, monta um radar de vagas explicado e um plano de evolução — tudo com o princípio **"número = cálculo, texto = explicação com fonte"**.

Stack: **Next.js 14** (App Router). A IA roda **no servidor** (a chave nunca vai para o navegador). Provedor padrão: **Anthropic** (`claude-sonnet-4-6`), trocável para OpenAI por variável de ambiente.

---

## Como rodar localmente

Pré-requisitos: **Node.js 18.18+**.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar a chave de IA
cp .env.example .env
#   abra o .env e preencha ANTHROPIC_API_KEY com sua chave

# 3. Rodar
npm run dev
```

Acesse **http://localhost:3000**. Clique em **"Carregar exemplo"** (persona Mariana → PM de IA) e depois **"Construir meu gêmeo"** para ver o fluxo completo sem precisar de um currículo real.

---

## Variáveis de ambiente (`.env`)

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | `anthropic` | `anthropic` ou `openai` |
| `LLM_MODEL` | `claude-sonnet-4-6` | Modelo. Para OpenAI, ex.: `gpt-4o` |
| `ANTHROPIC_API_KEY` | — | Chave da Anthropic (se usar Anthropic) |
| `OPENAI_API_KEY` | — | Chave da OpenAI (se usar OpenAI) |

**Trocar de provedor:** mude `LLM_PROVIDER=openai`, ajuste `LLM_MODEL` e preencha `OPENAI_API_KEY`. Toda a lógica de provedor está isolada em `lib/llm.js`.

---

## Deploy (Vercel — recomendado)

1. Suba este repositório para o GitHub.
2. Em [vercel.com](https://vercel.com), importe o repositório (framework detectado automaticamente: Next.js).
3. Em **Settings → Environment Variables**, adicione `ANTHROPIC_API_KEY` (e, se quiser, `LLM_PROVIDER` / `LLM_MODEL`).
4. Deploy. Pronto — a app sobe com um link público.

> Funciona igual em Render, Railway ou qualquer host que rode Next.js. O essencial é definir as variáveis de ambiente no painel do host.

---

## Como funciona (arquitetura)

```
app/
  page.js                 UI (cliente): input → processamento → relatório
  globals.css             design system (grafite/cítrico sobre bone, conceito "espelho Você↔Alvo")
  api/
    analyze/route.js      POST: currículo+cargo → perfil, sub-scores, gaps  (+ score calculado)
    opportunities/route.js POST: perfil+gaps → vagas ilustrativas + plano
lib/
  llm.js                  chamada de IA, agnóstica de provedor (servidor)
  prompts.js              prompts de diagnóstico e oportunidades
  score.js                Career Health Score — cálculo DETERMINÍSTICO (pesos .40/.30/.20/.10)
  sample.js               persona de demonstração (Mariana)
```

**Princípios embutidos:**
- O **Career Health Score é calculado em código** (`lib/score.js`), não inventado pela IA. A IA só **explica** cada sub-score.
- Toda explicação textual termina com a **fonte** entre colchetes (`[Currículo]` ou `[Mercado]`), renderizada como tag na UI.
- As **vagas do radar são ilustrativas** (empresas fictícias) e isso é dito na própria interface.

---

## Limitações conhecidas (é um MVP)

- **Vagas ilustrativas**, não reais. Para conectar vagas reais, troque o `app/api/opportunities/route.js` por uma fonte indexada (API de vagas / base própria) e mantenha o formato de saída.
- **Sem persistência / login**: cada análise é stateless. Para histórico do gêmeo, adicione um banco (ex.: Postgres) e autenticação.
- **PDF**: a entrada hoje é texto colado. Para upload de PDF, adicione extração de texto (ex.: `pdf-parse`) antes de chamar `/api/analyze`.

---

## Próximos passos sugeridos (do escopo do time)

1. **Simulador de entrevista (STAR/CAR):** nova rota `api/interview` que gera perguntas a partir do cargo-alvo, avalia a resposta pela estrutura STAR/CAR e sugere melhoria **sem quebrar a autenticidade**.
2. **Camada Ikigai:** 3–4 perguntas no onboarding para personalizar tom e narrativa de transição.
3. **Base de conhecimento (RAG):** Postgres + `pgvector` para ancorar a frequência de skills e o matching de vagas em dados reais, reforçando a explicabilidade.
4. **Upload de PDF + LinkedIn** e **persistência do gêmeo** com LGPD (consentimento por fonte, apagar tudo).

---

*CareerTwin AI · MVP de discovery · interface 100% PT-BR.*
