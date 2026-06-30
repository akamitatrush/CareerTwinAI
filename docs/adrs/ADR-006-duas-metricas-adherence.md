# ADR-006 — Duas métricas de aderência (top vs market)

**Status:** Aceito
**Data:** 2026-06-30
**Decisores:** Sérgio Hasher (fundador), Gandalf (auditoria), Saruman (architecture review), PO-PhD Career Sciences (parecer executivo)
**Tags:** algoritmo, scoring, semântica, lgpd-art-6

## Contexto

A página `/gaps` e o sub-score `aderencia_vagas` do Career Health Score (`lib/score.js:7-10`, peso 40%) historicamente compartilhavam o nome **"adherence"** mas eram calculados por fórmulas matematicamente distintas, duplicadas em 4 sites do código:

| Fórmula A — `/gaps` KPI strip | Fórmula B — sub-score Career Health |
|---|---|
| Top-N (=18) das skills mais pedidas | Pool inteiro (~200 vagas) |
| Pesa por `pct` (count/totalJobs) | Pesa por `freq` (count cru) |
| Domínio: ranking truncado | Domínio: long-tail completo |
| Inteligível ("8 das 18 críticas") | Estatístico ("8% do mercado coberto") |

A auditoria de 2026-06-29 (`docs/fluxos/auditoria/29062026/gandalf-auditoria-gaps.md`) classificou esta divergência como **P0 FORMULA-DRIFT** porque:

1. **Quebra o pitch central do produto** ("número auditável, sem caixa-preta") — usuário vê números diferentes em `/gaps` e em `/transparencia` sob o mesmo nome
2. **Duplicação em 4 sites** torna invisível o drift (ninguém olha a fórmula achando que é uma só)
3. **Risco regulatório** sob LGPD Art. 6 (transparência) e Art. 20 (revisão de decisão automatizada) — explicabilidade quebra se a fórmula "depende de onde você olha"

## Opções consideradas

### (a) Recalcular todos os snapshots históricos com fórmula unificada
**Rejeitada.** Viola imutabilidade de `ScoreSnapshot` (parte do contrato auditável). Usuário que viu 67 ontem e abre hoje vê 71 sem explicação — quebra confiança. Custo de migração + risco de inconsistência narrativa pro user.

### (b) Versionar com `formula_v=2` só pra snapshots novos
**Parcialmente válida.** Industry-standard pra ML models. Mas só faz sentido se a fórmula realmente MUDAR — e nesta auditoria descobrimos que ambas as fórmulas (top vs market) já existiam e são distintas em propósito, não erro.

### (c) Dual-write `v1` e `v2` por 1 release pra comparar
**Rejeitada.** Dobra storage, dobra compute, dobra superfície pra bug. E pra QUÊ comparar — já sabemos qual é a fórmula em cada contexto.

### (d) ✅ Renomear sem unificar — aceitar 2 métricas com semânticas distintas
**Aceita.** Centralizar em `lib/scoring/adherence.js` com 2 funções de nome explícito (`computeAdherenceTop` vs `computeAdherenceMarket`), helper compartilhado (`_aggregateSkillFrequency`) garante mesmo ranking subjacente, callers consomem a versão correta da semântica certa.

## Decisão

Manter as duas métricas com semânticas distintas, centralizadas em `lib/scoring/adherence.js`:

### `adherenceTop` — janela cognitiva (peso visual)
- **Onde:** KPI strip de `/gaps`, widgets cognitivos
- **Como:** top-N (default 18), pondera por `pct` normalizado
- **Por quê:** Lei de Miller (7±2) × 2 níveis ≈ 18 — limite cognitivo
- **Diz ao usuário:** "Você cobre 62% das skills críticas do mercado pro seu cargo"

### `adherenceMarket` — long-tail estatístico (peso algorítmico)
- **Onde:** sub-score `aderencia_vagas` (40% do Career Health Score)
- **Como:** pool inteiro, pondera por `freq` bruta
- **Por quê:** captura skills emergentes e nicho que o top-18 trunca
- **Diz ao algoritmo:** "Você endereça 48% do volume total do mercado pro seu cargo"

**Garantia matemática:** ambas usam `_aggregateSkillFrequency()` sobre o MESMO pool `jobs[]`, então o ranking subjacente é idêntico — só o corte (top-N vs completo) e a função-peso (`pct` vs `freq`) mudam. Quando `|S*| ≤ 18`, ambas convergem.

## Consequências

### Positivas
- ✅ **Pitch "auditável" restaurado** — fonte única em `lib/scoring/adherence.js`, impossível mostrar números diferentes "acidentalmente"
- ✅ **Long-tail capturado** sem perder janela cognitiva — `adherenceTop` continua útil pra UI, `adherenceMarket` continua útil pro algoritmo
- ✅ **Imutabilidade de `ScoreSnapshot` preservada** — sem migração, sem `formula_v`, sem recalcular histórico
- ✅ **Defesa LGPD Art. 6** — explicabilidade documentada (este ADR), nomes auto-documentados (`Top` vs `Market`)
- ✅ **Sem dívida técnica** — duplicação eliminada em 4 sites, helper compartilhado garante coerência

### Negativas
- ⚠️ **Custo cognitivo +1** pra novos devs entenderem por que duas métricas existem — mitigado por docstrings em `adherence.js` + este ADR
- ⚠️ **Risco de regressão narrativa** — se algum dev futuro consolidar pra "DRY" sem ler este ADR, volta o FORMULA-DRIFT. **Mitigação:** referência explícita ao ADR no docstring de `adherence.js`
- ⚠️ **Possível confusão de produto futura** — se design system quiser mostrar "Aderência" como nome único, precisa escolher qual das duas. **Decisão:** convenção é `adherenceTop` na UI (default), `adherenceMarket` só no contexto de explicação do Career Health Score

## Métricas de validação (próximas 4 semanas)

**Instrumentação obrigatória** recomendada pelo PO-PhD Career Sciences:

1. Logar correlação **Pearson(adherenceTop, adherenceMarket)** por usuário em cada `/api/analyze`
2. Janela: 14 dias após o primeiro deploy
3. Interpretação esperada:
   - **ρ > 0.95**: redundância empírica — reabrir discussão de consolidação na próxima retro
   - **0.7 ≤ ρ ≤ 0.95**: separação justificada — manter status quo
   - **ρ < 0.7**: separação fortemente justificada — comunicar diferença explicitamente na UI

## Implementação

- **PR:** `ba38750` (commit em 2026-06-29) — `refactor(scoring): unifica adherence + corrige FIXTURE-LEAK (Gandalf)`
- **Arquivo principal:** `lib/scoring/adherence.js` (172 linhas)
- **Wrapper back-compat:** `lib/scoring/subscores.js::computeAderenciaVagas()` continua retornando `{valor, n_vagas, comuns}` pra preservar shape de `ScoreSnapshot.sub_scores.aderencia_vagas`
- **Testes:** 1159/1159 vitest pass, zero regressão
- **Validação `/transparencia`:** Saruman confirmou shape-compat (`app/(app)/transparencia/page.js:526-527` apenas lê `subScores?.[k]?.valor` — sem dependência de `_meta`, `n_vagas`, etc.)

## Refs

- Auditoria técnica: `docs/fluxos/auditoria/29062026/gandalf-auditoria-gaps.md` (§5 risco P0 FORMULA-DRIFT, §9 fundamento matemático)
- Parecer PO sênior: `docs/fluxos/auditoria/30062026/po-specialist-parecer.md` (§3 B2)
- Código:
  - `lib/scoring/adherence.js` — fonte única
  - `lib/scoring/subscores.js:38-39` — wrapper de compat
  - `app/api/gaps/summary/route.js`, `app/api/gaps/requirements/route.js`, `app/(app)/gaps/page.js` — consumers do `adherenceTop`
- Literatura referência:
  - Lei de Miller (1956), "The Magical Number Seven, Plus or Minus Two" — justificativa pro top-18
  - LinkedIn Skills Genome (2017) — taxonomia hierárquica, precedente pra aceitar múltiplas métricas semânticas sobre o mesmo grafo
  - LGPD Art. 6 (princípio da transparência) — base regulatória do pitch

---

**Revisores ratificantes:**
- 🧙 Gandalf (auditoria técnica) — ✅ refactor implementado e testado
- 🧙‍♂️ Saruman (architecture review) — ✅ shape-compat com `/transparencia` validado
- 🎓 PO-PhD Career Sciences — ✅ "decisão certa, ressalva: este ADR existe"
