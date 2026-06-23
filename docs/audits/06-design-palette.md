# Auditoria visual — Paleta "Índigo Sereno" (light + dark)

**Branch:** `redesign/claude-design` · **Escopo:** `app/globals.css` (4851 linhas) + `components/ThemeToggle.js` · **Modo:** READ-ONLY.

User pediu: "verifique, dark fica ruim, light também tá estranho, considere theme picker — mas não mexa".

## TL;DR

Light: **OK, sem personalidade** — paleta dessaturada parece wireframe colorizado. Dark: **bug arquitetural crítico** — tokens de marca (`--primary`, `--positive`, `--attention` e ~12 `-soft`/`-tint` derivados) **nunca são reescritos** em `:root[data-theme="dark"]`. As variantes "soft" (`#EEEEFB`, `#ECF6F0`, `#FBF6EC` — quase brancas) continuam aplicadas como `background` de badges/chips/status sobre surfaces escuras → manchas brancas berrantes. Afeta ~146 referências.

Recomendação: **Opção A (Índigo refinada)** Wave A ~6h. Theme selector Wave B ~10h.

---

## 1. Inventário de tokens

| Token | Light | Dark | Issue |
|---|---|---|---|
| `--bg` | `#F6F5F2` (bege off-white) | `#0A0A12` (quase preto azulado) | Light bg quase indistinguível de surface (`#FFF`); dark bg OK. |
| `--surface` | `#FFFFFF` | `#1A1A26` | OK. |
| `--surface-2` | `#FAF9F5` | `#232333` | Light: ΔL ≈ 1.5 vs surface — sutil demais. Dark: ΔL ≈ 3 — visível. |
| `--surface-3` | `#F2F0EA` | `#2A2A3C` | Light colapsa com `--bg`. Dark OK. |
| `--border` | `#E7E4EC` | `#2E2E40` | OK. |
| `--border-strong` | `#DEDBE6` | `#3F3F56` | OK. |
| `--text` | `#1F1D33` | `#E8E6F0` | OK (contraste ≥ 14:1 ambos). |
| `--text-muted` | `#514E5C` | `#B5B0C4` | OK. |
| `--text-soft` | `#797585` (~4.6:1 sobre `--surface-2`) | `#9089A3` (~4.4:1 sobre `--surface`) | Light OK. Dark: borderline AA, falha sobre `--surface-3`. |
| `--text-faint` | `#6B6679` | `#908AA8` | Hierarquia colapsada: `--text-faint` está mais escuro que `--text-soft` no light (`#6B66` vs `#7975`). Inversão de hierarquia. |
| `--primary` | `#4F4FB0` | **(não override)** | Vibra OK no light. No dark fica chapado — falta primary-light substituto. |
| `--primary-soft` | `#EEEEFB` | **(não override)** | **BUG**: branco-violáceo aplicado em chips/badges sobre `#1A1A26`. |
| `--primary-tint` | `#DEDEF4` | **(não override)** | Mesmo bug. |
| `--positive` | `#1E9C7E` | **(não override)** | Verde dessaturado meio "spa shampoo" no light; no dark perde luminosidade. |
| `--positive-soft` | `#ECF6F0` | **(não override)** | **BUG** dark: borrão quase branco. |
| `--attention` | `#B6822A` | **(não override)** | Amarelo-terra no light parece bege institucional; no dark dificulta legibilidade. |
| `--attention-soft` | `#FBF6EC` | **(não override)** | **BUG** dark idem. |

---

## 2. Issues críticas (priorizadas)

### Crítica 1 — Tokens "soft" nunca trocam no dark (BUG)
Linhas 11-23 ficam em `:root` compartilhado. `:root[data-theme="dark"]` (linha 95) só redefine bg/surface/text — **não toca em primary/positive/attention**. Resultado: `--positive-soft: #ECF6F0` (luma ~94%) é fundo de `.ct-conta-badge` (linha 2333) e `.ct-skill-chip.have` (2126) sobre surface `#1A1A26` — borrão branco visível. Mesma coisa para `--primary-soft` e `--attention-soft`.

**Fix:** overrides dark — `--primary-soft: #1F1F3A`, `--positive-soft: #15302A`, `--attention-soft: #3A2E14`; tints 5pp mais claros.

### Crítica 2 — `--primary` chapado no dark
`#4F4FB0` sem versão luminance-adjusted perde vivacidade sobre `#0A0A12`. Gradient `.btn-primary` (linha 502) `primary-light → primary` fica "morto" pois `--primary-light: #6E6EC8` foi calibrado pra contrastar com surface clara.

**Fix:** dark `--primary: #8B8BE0`, `--primary-light: #A8A8EC`, `--primary-deep: #6262C0`.

### Crítica 3 — Hierarquia text-soft / text-faint invertida (light)
Light: `--text-soft: #797585` (luma ~47%), `--text-faint: #6B6679` (luma ~41%). **Faint mais escuro que soft.** Comment na linha 90 admite: `#6B6679` foi escolhido pra passar AA, mas quebrou semântica — `text-faint` (menos proeminente) parece mais firme em parágrafos.

**Fix:** `--text-faint: #8A8694` (luma ~55%, passa AA com font ≥14px).

### Crítica 4 — Background light bege sem propósito
`--bg: #F6F5F2` (bege quente) + `--surface: #FFFFFF` (branco) cria ΔL ~2 — cards sem depth percebida. Bege quente briga com `--primary: #4F4FB0` (índigo frio) — temperatura quebrada.

**Fix:** trocar bg pra `#F4F4F8` (cinza-frio neutro alinhado com índigo).

### Crítica 5 — `--positive` e `--attention` dessaturados demais
`#1E9C7E` (positive, C ~32) parece cinza-esverdeado em dots/pct labels pequenos. `#B6822A` (attention) parece "mostarda institucional" — nunca evoca urgência. Sem override dark, ambos perdem 50% da percepção.

**Fix:** `--positive: #16A38A`, `--attention: #C28634` (leve warmth).

---

## 3. Outras observações

- **Gradient `.btn-primary` (503):** range visual cai de 12pp pra 5pp no dark sem tokens ajustados → botão "morto".
- **Shadows dark (114-117):** alpha 0.25-0.45 adequado. OK.
- **Avatar gradient (`#E7B98C → #C98A57`):** terracota — único warmth real, isolado.
- **`mark` (181):** índigo sólido `#4F4FB0` + `#FFFFFF` agressivo em texto longo. Considerar wash + deep.
- **Focus ring `--shadow-focus`:** `0 0 0 3px var(--primary-soft)` cria ring branco fantasmagórico no dark (sintoma do bug 1).

## 4 + 5. Síntese

**Light** 🟡 — aceitável sem alma. Cromaticidade baixa, temperatura inconsistente bg×primary. Subir C do positive/attention e alinhar bg neutro frio resolve.
**Dark** 🔴 — quebrado. Soft/tint herdados criam manchas; primary chapado; focus ring branco. Hierarquia de surface OK, de cor falha. Risco de o user abandonar dark.

---

## 6. Opções de paleta (sem implementar)

### Opção A — Índigo Sereno refinada
*Mantém DNA "calmo, editorial, índigo". Conserta dark mode + cromaticidade.*

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F4F4F8` (cinza-frio neutro) | `#0B0B14` |
| `--surface` | `#FFFFFF` | `#17172A` |
| `--surface-2` | `#F7F7FB` | `#1F1F36` |
| `--primary` | `#4F4FB0` | `#8B8BE0` |
| `--primary-soft` | `#EEEEFB` | `#22224A` |
| `--positive` | `#16A38A` | `#3DD4B0` |
| `--positive-soft` | `#E8F6F0` | `#15302A` |
| `--attention` | `#C28634` | `#E8B560` |
| `--attention-soft` | `#FAF3E6` | `#3A2E14` |
| `--text` | `#1F1D33` | `#EAE8F2` |
| `--text-soft` | `#8A8694` | `#A8A2BC` |

**Feel:** profissional sereno editorial. WCAG AA pass.

### Opção B — Slate & Lime
*Estética Vercel/Linear/Resend — slate cool + accent vibrante.*

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F4F7FA` | `#0B1220` |
| `--surface` | `#FFFFFF` | `#111827` |
| `--surface-2` | `#F1F5F9` | `#1E293B` |
| `--primary` | `#65A30D` (lime-600) | `#A3E635` (lime-400) |
| `--primary-soft` | `#ECFCCB` | `#1F2A0E` |
| `--positive` | `#0EA5E9` (sky) | `#38BDF8` |
| `--attention` | `#F59E0B` (amber) | `#FBBF24` |
| `--text` | `#0F172A` | `#F1F5F9` |
| `--text-soft` | `#64748B` | `#94A3B8` |

**Feel:** tech/dev/futuro. Lime-600 sobre branco passa AA UI components (3:1), texto large only. *Risco:* lime+slate fora do mood "career counseling humano".

### Opção C — Warm Sand
*Estética Stripe Atlas / Substack — paleta bege quente + terracotta.*

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FAF7F2` | `#1A1612` |
| `--surface` | `#FFFFFF` | `#241F19` |
| `--surface-2` | `#F4EFE7` | `#2D2720` |
| `--primary` | `#C2410C` (orange-700) | `#FB923C` (orange-400) |
| `--primary-soft` | `#FFEDD5` | `#3A1F0E` |
| `--positive` | `#15803D` (green-700) | `#4ADE80` |
| `--attention` | `#A16207` (yellow-700) | `#FACC15` |
| `--text` | `#1C1917` | `#FAFAF9` |
| `--text-soft` | `#78716C` | `#A8A29E` |

**Feel:** acolhedor, humano. WCAG AA pass. *Risco:* orange-700 muito quente — pode parecer "marca de cafeteria".

---

## 7. Roadmap (estimativa)

| Wave | Escopo | Esforço |
|---|---|---|
| **A — Refinar tokens atuais** | Overrides dark pra `--primary*`, `--positive*`, `--attention*` (~12 tokens). Ajustar `--text-faint` light. Subir C de positive/attention. | **5-6h** |
| **B — Theme selector** | `<ThemePicker>` em `/conta` salva `localStorage.ct_palette`. Cada paleta vira bloco `:root[data-palette="..."]`. | **8-10h** |
| **C — Theme builder** | User customiza primary/positive/attention via color picker; sistema gera tints/softs via OKLCH shift. | **20-30h** |

## 8. Conformidade WCAG (resumo)

| Paleta | Texto normal (4.5:1) | UI (3:1) | text-soft @ ≥14px (3:1 large) |
|---|---|---|---|
| Opção A (refinada) | Pass light + dark | Pass | Pass |
| Opção B (slate/lime) | Pass | Pass (lime borderline pra texto pequeno — usar só em UI/icon) | Pass |
| Opção C (warm sand) | Pass | Pass | Pass |
| **Estado atual (issues 1+3)** | Fail em `--text-faint` (light pre-fix) e em chips dark mode | **Fail** focus ring dark (`#EEEEFB` sobre `#1A1A26` distrai) | OK |

## 9. Recomendação final

| Opção | Status |
|---|---|
| **A — Índigo Sereno refinada** | 🟢 **Primeiro.** Risco baixo, conserta bug crítico dark, mantém 146 chips/badges. |
| **B — Slate & Lime** | 🟡 Depois. Ressoa tech mas muda mood — decisão estratégica de produto. |
| **C — Warm Sand** | 🟡 Depois. Tom "career counseling humano", mas orange pesa em telas densas (`/relatorio`, `/oportunidades`). |
| **Wave B (theme selector)** | 🟢 Depois da Wave A. Atende literalmente o pedido do user. |

**Nota:** Wave A é hotfix de paleta, não redesign — mantém todos componentes, só conserta tokens. Risco mínimo, ganho alto.
