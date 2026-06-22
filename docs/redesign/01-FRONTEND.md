# Arquitetura Frontend — CareerTwin AI (versão Claude Design)

> Documento de referência pra reconstruir o frontend do CareerTwin AI a partir do
> protótipo "Claude Design" (índigo sereno, sidebar, 6 telas explicáveis).
> Audiência: dev front-end senior. Sem condescendência.
>
> Fontes citadas:
> - Mock: `/tmp/careertwin-mock/CareerTwin AI - entrega/fonte/CareerTwin AI.dc.html`
> - LEIA-ME: `/tmp/careertwin-mock/CareerTwin AI - entrega/LEIA-ME.md`
> - Produto atual: `app/`, `components/Report.js`, `app/globals.css`.

---

## 1. Visão geral

### Filosofia
O Claude Design é uma reescrita visual completa. **A direção editorial dark
do produto atual (Bricolage Grotesque + verde-limão `#B9D90C` + fundo `#0A0A0A`)
sai por inteiro.** Entra um sistema *light-first* com índigo sereno (`#4F4FB0`),
crema (`#F6F5F2`), serifa Spectral para "voz" e Plus Jakarta Sans para corpo. O
tom é **calmo, profissional, encorajador** — sem vermelho alarmista, sem
gamificação infantil, sem o exibicionismo editorial do tema "Dossiê".

### Princípio fundador, copiar e colar
**"Número = cálculo auditável. Texto = explicação com fonte."**
Esse princípio (já presente em `components/Report.js:301-308` como rodapé)
vira a *espinha dorsal* do produto inteiro: toda tela do Claude Design o
materializa. Cada número exibido tem fórmula visível (sub-scores no
`/dashboard`, breakdown em `/transparencia`); cada explicação narrativa tem
fonte citada (`· 142 vagas reais`, `· seu perfil`).

### Audiência
Profissional brasileiro 25–45, possivelmente em transição de carreira (a
persona do mock é Mariana Andrade, Eng. Backend → PM de IA). Lê em pt-BR.
Acessa principalmente desktop, mas espera-se uso mobile substantivo (ler
score em transporte público, abrir card de vaga no celular).

### Decisões macro (irrevogáveis)
1. **Light-first.** Fundo creme `#F6F5F2` é o estado canônico. Dark mode
   continua opt-in via `ThemeToggle.js`, mas o produto é desenhado pro light
   primeiro (oposto do produto atual, onde o dark é o cânone).
2. **Sidebar layout** em vez de top-bar + main vertical longa.
3. **Scroll vertical longo do "dossiê" morre.** O `Report.js` atual é uma única
   página com 5+ seções empilhadas — vira 5 rotas distintas.
4. **Stack React/Next mantida.** Sem libs novas, sem migração de framework.
5. **Persona de exemplo (Mariana Andrade) é a base do empty-state.** Quando o
   user não tem dados próprios, mostramos a Mariana como tour didático,
   sinalizado como demo.

---

## 2. Stack e tooling

| Camada | Decisão | Justificativa |
|---|---|---|
| Framework | Next.js 14 App Router (mantido) | Já em uso, server components facilitam reads de Prisma, `auth()` já integrado. |
| React | 18.3.1 (mantido) | Não há razão pra migrar pro 19 nesta entrega. |
| Estilo | CSS variables + CSS-in-JS via `<style jsx>` (mantém padrão atual) | Sem Tailwind, sem styled-components. O mock usa estilos inline puros (`style="..."`), que vamos converter pra classes em `globals.css` + módulos por rota. |
| Tipografia | Google Fonts via `<link>` (já existe em `app/layout.js:42-44`) | Trocar a família. Sem self-host pra simplificar Vercel. |
| Ícones | SVG inline (mantém padrão atual) | Mock já entrega tudo inline. Sem `lucide-react` ou similar. |
| Forms | Server Actions (mantém) | Já é o padrão em `/conta`, `/entrar`, `/meus-dados`. |
| Tests | Vitest + Playwright (mantém) | Cobertura aumenta junto com as novas rotas. |
| Auth | NextAuth v5 beta (mantém) | Sem alteração. |
| ORM | Prisma 6 (mantém) | Sem alteração. |

**Não entra:** Tailwind, shadcn/ui, Radix, Framer Motion, react-query.
Todas dispensáveis pra escopo. Animações CSS puras (`ctFade`, `ctShim`,
`ctSpin`) cobrem 100% das transições do mock.

---

## 3. Design tokens

### Paleta — "Índigo sereno"

Todos os valores extraídos do mock (`CareerTwin AI.dc.html` + LEIA-ME).
Cada token tem **papel semântico** + **componentes que usam**.

| Token | Hex | Papel | Onde usa (componente / linha do mock) |
|---|---|---|---|
| `--primary` | `#4F4FB0` | Índigo base — marca, scores, links | brand-mark, ring de score, números primários, botões CTA secundários (mock L32, L242) |
| `--primary-deep` | `#34357E` | Hover / gradiente fim | gradiente do logo (`linear-gradient(150deg,#6060C4,#34357E)`), gradiente do hero onboarding (mock L32, L96) |
| `--primary-mid` | `#6060C4` | Gradiente início | (mock L32) |
| `--primary-soft` | `#EEEEFB` | Background de pill ativa, LGPD card, cards selecionados | sidebar nav active (`#ECECFA`), banner LGPD sidebar (mock L51) |
| `--primary-bg` | `#ECECFA` | Hover de nav, badge "Concluído" via tag azul | nav active background, badges (mock L702) |
| `--avatar-from` | `#E7B98C` | Damasco claro — gradiente avatar | (mock L59) |
| `--avatar-to` | `#C98A57` | Damasco escuro — gradiente avatar + marca de referência mediana | avatar circle, mediana marker (mock L59, L261) |
| `--accent-warm-soft` | `#FBF6EC` | Wash âmbar — gaps, atenção | requirement row de gap, missing chip (mock L437) |
| `--accent-warm-border` | `#F0E4C9` | Borda do warm-soft | (mock L437) |
| `--positive` | `#1E9C7E` | Verde sereno — sucesso, "você tem" | check icons, dot de timeline concluído (mock L130) |
| `--positive-deep` | `#1E7E66` | Hover / texto verde escuro | label "analisado" (mock L131) |
| `--positive-soft` | `#ECF6F0` | Wash positivo — chip "você tem" | (mock L428) |
| `--positive-border` | `#CFE8DB` | Borda verde wash | (mock L428) |
| `--positive-bg-2` | `#EEF7F1` | Card "fonte conectada" | (mock L129) |
| `--positive-border-2` | `#BFE0D2` | Borda card conectado | (mock L129) |
| `--attention` | `#B6822A` | Âmbar — gaps, "falta" (nunca vermelho) | dot de gap, "Próximo" badge (mock L431, L821) |
| `--attention-deep` | `#7A6326` | Hover âmbar | (mock L356, L438) |
| `--attention-mid` | `#D6A23E` | Barra de gap | (mock L778) |
| `--attention-soft` | `#FBF4E6` | Wash âmbar tag | (mock L719) |
| `--bg` | `#F6F5F2` | Creme — fundo geral | `body` (mock L843) |
| `--bg-gradient` | `radial-gradient(130% 90% at 0% 0%, #EDEDFA 0%, #F6F5F2 52%)` | Background do onboarding | (mock L92) |
| `--surface` | `#FFFFFF` | Cards, sidebar | sidebar, todos os cards (mock L30, L299) |
| `--surface-soft` | `#F6F5FA` | Card de progresso onboarding | (mock L201) |
| `--surface-tag` | `#F1EFF6` | Chips de skill, level/model/salary | profile skills chip, job tags (mock L349, L476) |
| `--border` | `#E7E4EC` | Borda padrão de card | (mock L30, L299) |
| `--border-soft` | `#F0EEF5` | Divisores internos | divisor entre subscores (mock L275) |
| `--border-mid` | `#EDEBF4` | Borda neutra alt | borda do bloco LGPD sidebar (mock L58) |
| `--text-strong` | `#1F1D33` | Body text padrão | body (mock L16) |
| `--text` | `#332F40` | Texto em chips | (mock L349) |
| `--text-soft` | `#514E5C` | Texto secundário | sub-explanation (mock L282) |
| `--text-faint` | `#797585` | Texto terciário, labels uppercase | brand-sub, labels (mock L37) |
| `--text-mute` | `#9893A4` | Texto neutro (hint, divisor de chip) | "de 100", placeholders (mock L248) |
| `--text-mute-2` | `#8B8698` | Nav inactive | (mock L702) |
| `--text-active` | `#34357E` | Nav active | (mock L702) |
| `--text-on-primary` | `#FFFFFF` | Texto em fundos índigo | hero onboarding, principle card transp |
| `--text-on-primary-soft` | `#D6D6F2` | Texto sub em hero índigo | (mock L108) |
| `--text-on-primary-strong` | `#B9B9EC` | Eyebrow em hero índigo | (mock L106) |
| `--shadow-card` | `0 1px 2px rgba(28,26,54,.04)` | Sombra padrão de card | (mock L299) |
| `--shadow-hero` | `0 1px 2px rgba(28,26,54,.04), 0 14px 36px -26px rgba(28,26,54,.18)` | Sombra do hero | (mock L838) |
| `--shadow-onboard` | `0 40px 90px -48px rgba(28,26,54,.34)` | Sombra do card de onboarding desktop | (mock L837) |
| `--shadow-cta-primary` | `0 10px 24px -10px rgba(52,53,126,.5)` | Sombra do CTA "Ver gêmeo" | (mock L872) |

### Tipografia

| Família | Pesos importados | Função | Onde |
|---|---|---|---|
| `Plus Jakarta Sans` | 400, 500, 600, 700, 800 | Body, headings, números | Default em todo o app |
| `Spectral` | 400, 500, 600 + italic 400 | Display serif — saudações, eyebrow editorial | "Bom te ver de volta", eyebrow "Transparência" (mock L226, L574), título do hero onboarding (mock L107) |

`@import` substitui o link atual no `app/layout.js:42-44`:
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
```

**Famílias atuais que saem:** Bricolage Grotesque (display), Inter (body),
JetBrains Mono (mono), Source Serif 4. **Mono e Inter desaparecem do produto.**
Nenhuma fonte mono no Claude Design — números usam `font-variant-numeric:
tabular-nums` em Plus Jakarta Sans (mock L383, L539).

#### Escala tipográfica (extraída do mock)

| Token | Tamanho | Peso | Família | Uso | Exemplo |
|---|---|---|---|---|---|
| `--fz-display-1` | 33px | 600 | Spectral | Hero principal onboarding | mock L107 |
| `--fz-h1` | 28px | 800 | Plus Jakarta | "Olá, Mariana 👋" | mock L227 |
| `--fz-h1-screen` | 26px | 800 | Plus Jakarta | Título de tela (Gaps, Radar, Plano, Transparência) | mock L370, L453, L509, L575 |
| `--fz-h2-onboard` | 23px | 800 | Plus Jakarta | "Conecte de onde vêm seus dados" | mock L123 |
| `--fz-stat-big` | 26px | 800 | Plus Jakarta | KPI strip ("142", "11/18") | mock L383 |
| `--fz-score-final` | 30px | 800 | Plus Jakarta | Score total na transparência | mock L614 |
| `--fz-ring-num` | 48px | 800 | Plus Jakarta | "72" dentro do ring | mock L247 |
| `--fz-subscore-num` | 19px | 800 | Plus Jakarta | Sub-score numeral | mock L279 |
| `--fz-method-num` | 18px | 800 | Plus Jakarta | Peso da fórmula | mock L599 |
| `--fz-h2-section` | 16px | 800 | Plus Jakarta | "As 3 próximas ações", "Como esse número é formado" | mock L294, L546 |
| `--fz-brand` | 15px | 800 | Plus Jakarta | "CareerTwin" sidebar header | mock L36 |
| `--fz-spectral-italic` | 15px | 400 (italic) | Spectral | "Bom te ver de volta" | mock L226 |
| `--fz-title-card` | 15.5px | 800 | Plus Jakarta | Título de card de vaga | mock L472 |
| `--fz-body-large` | 14.5px | 700 | Plus Jakarta | Action title | mock L303 |
| `--fz-body` | 13.5px | 400-700 | Plus Jakarta | Default body | mock L371 |
| `--fz-body-small` | 13px | 400-700 | Plus Jakarta | Texto em cards densos | mock L341 |
| `--fz-meta` | 12.5px | 400-700 | Plus Jakarta | Sub-explanations | mock L282, L306 |
| `--fz-micro` | 12px | 600-700 | Plus Jakarta | Labels, chip text, descrição auxiliar | mock L120 |
| `--fz-micro-small` | 11.5px | 600 | Plus Jakarta | Pill, badge | mock L252 |
| `--fz-tiny` | 11px | 600-800 | Plus Jakarta | Eyebrow uppercase, micro-label | mock L37, L256 |
| `--fz-eyebrow` | 10.5px | 700 | Plus Jakarta | Sidebar brand sub | mock L37 |
| `--fz-eyebrow-small` | 10px | 700 | Plus Jakarta | "ADERÊNCIA" sob ring | mock L497 |

**Letter spacing:** uppercase usa `letter-spacing: .02em` a `.08em`; numerais
grandes (h1, scores) usam `letter-spacing: -.3px` a `-1px` (mock L227, L383).

### Espaçamento

Não há scale matemática rígida no mock; valores são empíricos. Adotamos:

| Token | Valor | Onde |
|---|---|---|
| `--space-1` | 4px | gap mínimo entre chips |
| `--space-2` | 6px | gap entre chips, padding interno de pill |
| `--space-3` | 8px | gap pequeno |
| `--space-4` | 10-11px | gap em row de card |
| `--space-5` | 13-14px | padding lateral de chip / card pequeno |
| `--space-6` | 16-18px | padding interno de card médio |
| `--space-7` | 20-22px | padding de card grande, gap entre seções dentro de uma tela |
| `--space-8` | 26-28px | padding lateral de hero |
| `--space-9` | 38-40px | padding hero onboarding |
| `--space-screen-desktop` | `30px 38px 56px` | padding de screen container desktop (mock L858) |
| `--space-screen-mobile` | `24px 18px 64px` | padding de screen container mobile (mock L858) |

### Border radius

| Token | Valor | Onde |
|---|---|---|
| `--radius-pill` | 20px | pills "ótimo", "em evolução" (mock L252) |
| `--radius-card-large` | 18-20px | cards de hero/section grande (mock L424, L514) |
| `--radius-card` | 16px | cards padrão de ação, vaga (mock L299, L468) |
| `--radius-card-mid` | 14px | LGPD card, kpi strip (mock L51, L382) |
| `--radius-input` | 13px | CTA grande, botão (mock L872) |
| `--radius-icon-square` | 13px | quadrado do avatar do profile (mock L328) |
| `--radius-icon-square-small` | 11px | quadrado de ícone em data-source card (mock L130) |
| `--radius-button` | 11px | botão de nav, banner LGPD (mock L702, L51) |
| `--radius-chip` | 10px | chip em missing skill (mock L437) |
| `--radius-icon` | 9-10px | logo brand, ícone de tag (mock L32, L308) |
| `--radius-tag` | 8px | chip "Você tem" (mock L428) |
| `--radius-tag-small` | 7px | chip pequeno de tag (mock L308) |
| `--radius-tag-micro` | 6px | tag de nível/modelo/salário (mock L476) |
| `--radius-bar` | 5-6px | progress bar (mock L207, L260) |
| `--radius-dot` | 50% | avatar circle, dot da timeline (mock L59) |

### Sombras

Três níveis:

- **`--shadow-card`** (`0 1px 2px rgba(28,26,54,.04)`): em todo card de
  conteúdo. Mal se vê — só dá um "pop" sobre o creme.
- **`--shadow-hero`** (`0 1px 2px rgba(28,26,54,.04), 0 14px 36px -26px
  rgba(28,26,54,.18)`): no hero do dashboard.
- **`--shadow-onboard`** (`0 40px 90px -48px rgba(28,26,54,.34)`): apenas no
  card grande do onboarding (mock L837).
- **`--shadow-cta-primary`** (`0 10px 24px -10px rgba(52,53,126,.5)`): em CTAs
  índigo (mock L32, L872).

### Motion

- **`--ease-default`**: `cubic-bezier(.4,0,.2,1)` (mock L207)
- **`--dur-fast`**: `150ms` — toggle de tema, hover (`globals.css:154`)
- **`--dur-mid`**: `200-300ms` — transições de estado
- **`--dur-slow`**: `400-500ms` — `ctFade` (entrada de tela), `ctShim` (skeleton)

Keyframes (mock L17-19):
```css
@keyframes ctFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes ctShim { 0% { background-position: -200px 0 } 100% { background-position: 200px 0 } }
@keyframes ctSpin { to { transform: rotate(360deg) } }
```

Scrollbar custom (mock L20-22): track invisível, thumb `#D7D4E0`,
border-radius 9px.

---

## 4. Layout — AppShell

### Desktop (`window.innerWidth >= 880`)

```
┌────────────┬──────────────────────────────────────┐
│            │                                      │
│            │                                      │
│  Sidebar   │         Main (overflow-y: auto)      │
│  252px     │         flex: 1                      │
│  fixa      │         max-width: 1180px (content)  │
│            │         padding: 30px 38px 56px      │
│            │                                      │
│  brand     │                                      │
│  nav       │                                      │
│  ...       │                                      │
│  LGPD card │                                      │
│  avatar    │                                      │
│            │                                      │
└────────────┴──────────────────────────────────────┘
```

- Sidebar `width: 252px; flex: none; height: 100%; background: #fff; border-right: 1px solid #E7E4EC; padding: 22px 16px 16px; display: flex; flex-direction: column` (mock L30)
- Main `flex: 1; height: 100%; overflow-y: auto; overflow-x: hidden` (mock L88)
- Container interno por tela: `max-width: 1180px; margin: 0 auto; padding: 30px 38px 56px` (mock L222, L858)

### Mobile (`< 880px`)

Sidebar vira header. Layout:

```
┌────────────────────────────────────┐
│ [logo] CareerTwin           [avt]  │
│ [Dashboard][Gaps][Radar][Plano]... │ <-- scrollable horizontal
├────────────────────────────────────┤
│                                    │
│  Main (overflow-y: auto)           │
│  padding: 24px 18px 64px           │
│                                    │
└────────────────────────────────────┘
```

- Header `background: #fff; border-bottom: 1px solid #E7E4EC; padding: 10px 14px 8px; display: flex; flex-direction: column; gap: 9px; z-index: 5` (mock L70)
- Nav horizontal scrollable `display: flex; gap: 4px; overflow-x: auto`, cada botão `flex: none; padding: 6px 11px; font-size: 10px` (mock L78-85)

### Breakpoint

**Único breakpoint: 880px** (do mock L686, `mobile = s.vw < 880`).
Não há tablet intermediário. Quem está em iPad portrait (768px) entra no
mobile layout; iPad landscape (1024px) está no desktop. Aceitamos isso
porque o mock define só dois estados — adicionar um terceiro estado tablet
custa caro e não move agulha.

### AppShell — componente

Arquivo: `app/(app)/layout.js` (novo, server component).

Pseudo-implementação:
```jsx
// Server component, lê session e profile pra alimentar Sidebar.
export default async function AppLayout({ children }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");
  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  return (
    <div className="appshell">
      <Sidebar
        userName={session.user.name || session.user.email}
        targetRole={profile?.targetRole}
      />
      <main className="appshell-main">{children}</main>
    </div>
  );
}
```

`Sidebar` é client component (precisa de `usePathname` pra estado active).

**Route Group `(app)`** isola o layout do AppShell das rotas públicas (`/`,
`/entrar`). Next.js convention.

---

## 5. Estrutura de rotas

| Rota | Componente | Auth | Layout | Substitui produto atual |
|---|---|---|---|---|
| `/` | `Onboarding` | público | sem shell | atual `/` (`app/page.js`) — reescrita |
| `/dashboard` | `Dashboard` | obrigatório | AppShell | era `/meu-gemeo` |
| `/gaps` | `AnaliseGaps` | obrigatório | AppShell | nova (era seção 02 do `Report.js`) |
| `/oportunidades` | `RadarVagas` | obrigatório | AppShell | nova (era seção 03 do `Report.js`) |
| `/plano` | `Plano` | obrigatório | AppShell | nova (era seção 04 do `Report.js` + histórico) |
| `/transparencia` | `Transparencia` | obrigatório | AppShell | nova (era rodapé do `Report.js`) |
| `/conta` | `Conta` | obrigatório | AppShell | mantém com novo layout |
| `/candidaturas` | `Kanban` | obrigatório | AppShell | mantém com novo layout |
| `/meus-dados` | `MeusDados` | obrigatório | AppShell | mantém com novo layout |
| `/entrar` | `Login` | público | sem shell | mantém com nova paleta |
| `/meu-gemeo` | `redirect("/dashboard")` | — | — | renomeado |
| `/design-lab` | (manter ou apagar) | público | sem shell | playground existente |

Rotas de API (`app/api/**`) **não são tocadas neste documento** — são contrato
estável. A migração frontend lê os mesmos endpoints (`/api/analyze`,
`/api/opportunities`, `/api/cv/upload`, `/api/linkedin/parse`,
`/api/portfolio/import`, `/api/applications`).

### Server vs client por padrão

- **Server por default** (Next 14 App Router): toda página em `(app)/` lê
  Prisma via `await prisma.*` no componente exportado, faz `auth()`, passa
  dados serializáveis pros filhos.
- **Client (`"use client"`) apenas onde necessário**: Sidebar
  (`usePathname`), `ThemeToggle`, modais (`InterviewModal`, `TailorModal`,
  `ChatModal`), animações controladas por JS (poucas — só onboarding live).

---

## 6. As 6 telas em detalhe

### 6.1 Onboarding (`/`)

#### Propósito
Primeira impressão + conexão de 3 fontes (CV obrigatório; LinkedIn,
GitHub opcionais). Substitui a "home" atual (`app/page.js`) — que mistura
onboarding com geração de diagnóstico em uma única tela com 3 stages.

#### Layout
Sem AppShell. Background creme com gradient radial `#EDEDFA → #F6F5F2`
(mock L92). Card central:

- **Desktop**: grid 2 colunas `0.92fr 1.08fr` (mock L837). Esquerda = brand
  panel índigo (`linear-gradient(165deg,#4F4FB0 0%,#2E2F70 70%,#28285E 100%)`),
  direita = upload panel branco. `max-width: 1020px; border-radius: 26px;
  overflow: hidden`. Sombra `--shadow-onboard`.
- **Mobile**: 1 coluna, `max-width: 520px; border-radius: 22px`.

#### Componentes
- **`<OnboardBrandPanel>`** — left, índigo. Logo, eyebrow "CONSTRUA SEU GÊMEO",
  H1 Spectral 33px, lede, card LGPD interno com glass effect (`rgba(255,255,255,.08)`).
- **`<OnboardSourceCard kind="cv|linkedin|github" state="pending|loading|done">`** — três variantes:
  - `pending`: borda dashed `#CECAD9`, ícone box `#F0EEF5`, CTA inline "Enviar"/"Conectar"
  - `loading`: borda sólida `#E7E4EC`, spinner `ctSpin` em círculo `#EEEEFB`, label "Analisando…/Importando…", barra shimmer `ctShim`
  - `done`: borda verde `#BFE0D2`, background `#EEF7F1`, check icon `#1E9C7E`, label "analisado/importado/conectado"
- **`<OnboardProgressCard>`** — card creme `#F6F5FA` com texto IA + barra de progresso (`width: aiPct%`, gradient `#6060C4 → #6E6EC8`)
- **`<OnboardCTA>`** — botão índigo full-width com shadow, disabled (cinza `#BBB7C6`) até `cv === true`

#### Estados
```ts
type SourceState = 'pending' | 'loading' | 'done';
state = {
  cv: SourceState,
  linkedin: SourceState,
  github: SourceState,
};
```

`doneCount = filter(state => state === 'done').length` (0-3)
`aiPct = [12, 62, 81, 96][doneCount]` (mock L711)
`aiText`: muda conforme `done`/`anyLoading` (mock L713)

#### API
- `POST /api/cv/upload` (FormData `file`, retorna `{ text }`) — já existe (`app/api/cv/upload/`)
- `POST /api/linkedin/parse` — já existe via `<LinkedinImportButton>`
- `POST /api/portfolio/import` — já existe via `<PortfolioImportButton>`

> **Atenção:** o produto atual exige texto bruto colado em textarea
> (`app/page.js:269`). O Claude Design **não tem textarea** — só upload de
> arquivo + import oficial. **Esta é mudança de fluxo significativa.** Se
> manter o textarea fica como fallback, ele vira um link discreto "Colar
> texto manualmente" (NÃO faz parte do mock — decisão de produto pendente).

#### Animações
- Card inteiro: `ctFade .5s ease both`
- Skeleton shimmer durante loading: `ctShim 1.2s ease infinite`
- Spinner: `ctSpin .7s linear infinite`
- Barra de progresso: `transition: width .6s cubic-bezier(.4,0,.2,1)`

#### Próximo passo
Quando `cv === 'done'`, o CTA "Ver meu gêmeo digital" habilita. Click
dispara `/api/analyze` + `/api/opportunities` (como hoje em `app/page.js:87-99`)
e ao terminar redireciona pra `/dashboard`. **Tela de loading do diagnóstico
some** (era stage `proc` em `app/page.js:335`) — agora a navegação acontece
dentro do `/dashboard` com skeleton de score (ver 6.2).

#### Empty / error
- CV upload falhar → toast vermelho (não no mock — adotar padrão atual
  `<div className="err">`).
- 401 no upload → modal "Entre antes de subir PDF — texto colado funciona
  sem login" (já existe lógica em `app/page.js:298-304`).
- Persona demo: se `unauthenticated`, mostrar overlay opcional "Veja o gêmeo
  da Mariana" → carrega `lib/sample.js` e vai direto pra `/dashboard?demo=1`.

#### Mobile
- Brand panel some (ou colapsa em header de 60px). Upload panel vira tela cheia.
- Touch target 44px mínimo.

---

### 6.2 Dashboard (`/dashboard`)

#### Propósito
Tela canônica do produto pós-login. Substitui `/meu-gemeo` (que continua
existindo como redirect). Mostra Career Health Score com decomposição,
comparação com mediana, 3 próximas ações, perfil estruturado.

#### Layout
AppShell. Container `max-width: 1180px; padding: 30px 38px 56px`.

- Header (h-flex space-between): "Bom te ver de volta, Olá [Nome] 👋" à esquerda,
  pill "CARGO-ALVO [role]" à direita.
- **Hero** (card único, padding 26-28px, radius 20px, `--shadow-hero`): grid
  desktop `248px 1fr`, mobile `1fr`.
  - Coluna 1: ring 172px + label "Saúde da carreira" + pill verde "+18 em 5
    meses" + texto "Baseado em N vagas reais" + bloco "Mediana de contratados 78"
    com barra dual (sua barra + marker damasco da mediana).
  - Coluna 2: list de 4 sub-scores com label + pill de tag + número grande +
    barra de progresso + frase "porque… · fonte".
- **2 colunas** (grid `1.45fr 1fr` desktop, `1fr` mobile, gap 22px, mt 22px):
  - Esquerda: "As 3 próximas ações" — 3 cards com numeração `1/2/3`,
    título, why, tag "Match de skill", badge "Alto impacto" / "Médio impacto",
    botão "Começar →"
  - Direita: "Seu perfil estruturado" — card único com avatar damasco grande,
    nome, localização, list de campos (Atual / Alvo / Skills principais com
    chips), aviso âmbar "Falta 1 item"

#### Componentes
- **`<DashboardHeader greeting role />`**
- **`<ScoreRing value={72} delta={+18} radius={86} stroke={13} gradient="ringg" />`** — SVG inline, `stroke-dasharray=464.9`, `stroke-dashoffset` calculado `464.9 * (1 - value/100)`. Centro: número 48px + "de 100" 11px.
- **`<MedianaComparison your={72} median={78} />`** — barra dual com marker damasco posicionado em `left: 78%`
- **`<SubScoreList items=[{label, value, tag, why, source}] />`** — usa helper `tone(value)` (verde ≥80 / índigo ≥60 / âmbar <60) (mock L719)
- **`<ActionCard n title why tag impact />`** — número 1/2/3 em quadrado índigo
- **`<ProfileSnapshot user skills completeness />`** — completeness arc + chip âmbar de aviso
- **`<TargetRolePill role />`** — pill clicável (vai pra /conta?)

#### Estados
Tudo vem do server (Prisma). Reveal animado dos sub-scores com `ctFade`
escalonado (sem JS). Diferente do produto atual em `Report.js:38-48`, que
controla reveal com `setTimeout` em useEffect — aqui usamos `animation-delay`
CSS puro.

> **Bug a evitar:** o `Report.js` atual sofre de "0 piscando" porque renderiza
> `liveOverall` real desde o primeiro mount (`Report.js:64`) e a barra começa
> em 0 via `--ss-target`. **Solução no Claude Design**: render do número final
> direto no DOM; barra de score começa com `stroke-dashoffset` calculado
> server-side (não há "fade-in numeral"). Anima só opacidade/transform.

#### API
- Tela é 100% server-rendered. Lê `prisma.scoreSnapshot.findFirst(...)` +
  `prisma.profile.findUnique(...)` + `prisma.planItem.findMany(...)`. Nada de fetch client-side.

#### Empty state
Se `snapshots.length === 0`: card grande com Mariana persona stub + CTA "Gerar
diagnóstico" → `/`. Reusa lógica de `app/meu-gemeo/page.js:32-51` mas com
visual nova.

#### Mobile
- Hero vira 1 coluna (ring em cima, sub-scores embaixo com `border-top: 1px
  solid #EDEBF4`).
- 2 colunas inferiores empilham. ActionCards mantêm número à esquerda.

---

### 6.3 Análise de gaps (`/gaps`)

#### Propósito
Mostra distância entre o perfil e o que as vagas pedem.

#### Layout
- Header: H1 "Análise de gaps" + pill CARGO-ALVO (mesma do dashboard)
- **KPI strip** (grid `repeat(4,1fr)` desktop, `repeat(2,1fr)` mobile, gap 14px):
  4 cards iguais com número 26px + label 12px:
  - "142 vagas reais analisadas"
  - "11/18 skills exigidas que você tem"
  - "2 gaps de alta prioridade" (cor âmbar)
  - "64% aderência média ao cargo" (cor índigo)
- **2 colunas** (grid `1.6fr 1fr` desktop, `1fr` mobile, gap 22px):
  - Esquerda: card "O que as vagas pedem" — 8 rows. Cada row: dot colorido
    (verde/índigo/âmbar), label, status pill, progress bar com label
    "pedido em X% · N de 142"
  - Direita rail: 2 cards:
    - "Skills que você já tem" — chips verdes wash
    - "Priorize aprender estas" — list de 4 rows com background âmbar wash

#### Componentes
- **`<KPIStripCard value label valueColor />`**
- **`<RequirementRow name pct count statusLabel statusTone />`** — row com bg condicional (`#FDFAF3` se status === "Falta")
- **`<SkillChip variant="have|missing" />`** — verde wash vs âmbar wash
- **`<MissingSkillRow name pct />`** — row densa com background âmbar

#### API
Server. Lê `latestSnapshot.gapsJson` (já existe no schema).

#### Mobile
KPI strip 2x2. Cols viram 1 col (have/missing acima da lista? ou abaixo? —
mock define `flex-direction` natural, então have/missing fica **abaixo**
da lista no mobile).

---

### 6.4 Radar de vagas (`/oportunidades`)

#### Propósito
Lista de vagas reais ordenadas por aderência. Cada vaga = card com fit ring.

#### Layout
- Header simples (H1 + lede 13.5px)
- **Filters bar** (h-flex, gap 10px, flex-wrap):
  - "24 vagas compatíveis" (texto bold)
  - Divisor vertical 1px
  - 3 botões de filtro: Senioridade, Modelo, Aderência mín. (visual de dropdown, mock não implementa interação real)
- **Lista** (column, gap 14px): cada card vaga com grid `auto 1fr auto` (desktop)
  ou `auto 1fr` (mobile, com ring abaixo):
  - Coluna 1: logo quadrado 48px (cor variável por índice — mock usa array `#7E5BD6, #E03E2F, #1E9C7E, #2C7D4F, #C98A57` mock L793)
  - Coluna 2: role title + " · " + company + tags (level/model/salary) + chips why (verde) + chips falta (âmbar)
  - Coluna 3 (desktop): ring 62px com fit %, label "ADERÊNCIA" abaixo

#### Componentes
- **`<JobFilters seniority model minFit />`** — controlled. Click abre dropdown (a implementar — não no mock).
- **`<JobCard job={vaga} variant="desktop|mobile" />`**
- **`<JobLogo initial color />`** — quadrado colorido com letra branca
- **`<FitRing value={82} size={62} />`** — variant menor do ScoreRing
- **`<WhyChip text />`** / **`<MissingChip text />`** — chips verde/âmbar inline com check/cross icon

#### API
Lê `latestSnapshot` + chama `/api/opportunities` se precisar de refresh,
ou trabalha com cache do snapshot. **Decisão**: padrão é mostrar vagas do
último snapshot (rápido); botão "Atualizar vagas" no header dispara nova
busca async (mostra skeleton durante).

#### Empty state
Lógica de "Nenhuma vaga voltou agora" já existe em `Report.js:186-203`.
Replicar com visual nova: card único centralizado com mensagem + sugestões
em `<ul>`.

#### Mobile
Card vira grid 2 col (logo + content), ring desce pra rodapé do card com
`border-top: 1px solid #F0EEF5; padding-top: 12px`.

---

### 6.5 Plano de evolução (`/plano`)

#### Propósito
Mostra o lado "longitudinal" do gêmeo — evolução do score no tempo + ações.

#### Layout
- Header: H1 + lede
- **Card de gráfico** (`--radius-card-large`, padding 22px 26px):
  - Header interno: "Saúde da carreira ao longo do tempo" + delta "+18 pontos · desde janeiro"
  - SVG inline 640x230 (`viewBox="0 0 640 230"`, `width: 100%; height: auto`):
    - 3 linhas horizontais de grid (`#F0EEF5`)
    - 3 labels y-axis (76/63/50, font 11px)
    - Area path com gradient (`linearGradient id="areag"`, `#6E6EC8` → transparent)
    - Polyline com stroke `#4F4FB0`, 5 pontos (Jan-Mai)
    - 5 dots brancos com stroke índigo; último é sólido grande (`r=6, fill=#4F4FB0`)
    - Labels x-axis (mês) + labels valor acima de cada ponto
- **Timeline de ações** (`<h2>Linha do tempo das ações</h2>`):
  - Card único com `padding: 8px 24px`
  - Cada row: grid `96px 28px 1fr` (data | dot | content)
  - Dot circular 28px com background condicional (verde concluído / índigo andamento / branco com border âmbar para próximo)
  - Linha vertical 2px entre dots (`#EDEBF4`)
  - Content: title + tag pill + detail

#### Componentes
- **`<ScoreOverTimeChart points={[{date, value}]} delta />`** — SVG props-driven (calcula posições internamente)
- **`<TimelineRow date title detail status />`** — status determina cor (`tlTone` mock L818)

#### Dados
Lê `prisma.scoreSnapshot.findMany({ orderBy: createdAt asc, take: 12 })` +
`prisma.planItem.findMany({ where: { snapshotId: latestId } })`.

#### Empty state
Se há só 1 snapshot, mostra gráfico com 1 ponto + texto "Refaça daqui a
1-2 semanas pra ver a evolução de verdade" (lógica já em
`app/meu-gemeo/page.js:148-170`).

#### Mobile
- SVG escala via `width: 100%; height: auto` (já é vetorial, ok).
- Timeline: grid `60px 28px 1fr` (data mais curta).

#### Risco
SVG inline com 5 pontos é fácil. **Mas o produto vai precisar de 12+ pontos
quando o histórico crescer** — vai precisar de cálculo dinâmico (espaçamento
proporcional, labels que somem para evitar overlap). Não-trivial. Estimar
+4h aqui.

---

### 6.6 Transparência (`/transparencia`)

#### Propósito
Materializa o princípio "número = cálculo, texto = explicação com fonte".
Tela mais "marketing" do app — vende confiança.

#### Layout
- Header: eyebrow Spectral italic "Transparência" + H1 "Por que você pode confiar nesse número" + lede
- **Card princípio** (grid 2 col desktop, 1 col mobile, gap 22px, padding 26px 28px,
  background `linear-gradient(135deg,#4F4FB0,#30316E)`, color `#fff`,
  border-radius 20px):
  - Coluna 1: ícone clipboard branco translúcido + "Número = cálculo auditável" + lede
  - Coluna 2: ícone chat branco translúcido + "Texto = explicação com fonte" + lede
- **Fórmula breakdown** (H2 + lede + card grande):
  - 4 rows, cada uma: peso `35%` (índigo grande) + label + número + barra + frase "Cálculo: ..."
  - Row final: "Saúde da carreira = média ponderada" + número 30px índigo
- **De onde vêm os dados** (H2 + grid `repeat(3,1fr)` desktop, `1fr` mobile, gap 14px):
  - 3 cards iguais com ícone em quadrado wash índigo + título + lede
- **LGPD card** (background `#EEEEFB`, border `#DEDEF4`, border-radius 16px,
  padding 18px 20px, ícone shield + texto)

#### Componentes
- **`<PrincipleCard items=[{icon, title, lede}] />`** — gradient índigo
- **`<FormulaRow weight label value formula tone />`**
- **`<FormulaTotal value />`** — row final com número 30px
- **`<DataSourceCard icon title lede />`** — wash índigo box
- **`<LGPDBanner />`** — pode reusar em /conta, /meus-dados

#### Dados
Server. Lê fórmula direto de `lib/score.js` (`WEIGHTS`, `SS_META` já existem).
Os 4 sub-scores vêm do `latestSnapshot.subScoresJson`.

---

## 7. Componentes compartilhados (library)

> Diretório: `components/redesign/` (separado do legado durante migração).
> Cada componente é um arquivo único, prefira composição sobre props expansivas.

| Componente | Onde usa | Props | Estados visuais | A11y |
|---|---|---|---|---|
| `<AppShell>` | layout `(app)` | `children`, `session` | — | landmarks: `<aside>` + `<main>` |
| `<Sidebar>` | AppShell desktop | `userName`, `userRoleHint`, `targetRole` | active item por `usePathname()` | `<nav aria-label="Principal">`, current via `aria-current="page"` |
| `<MobileTopBar>` | AppShell mobile | igual ao Sidebar | — | nav horizontal: scroll-snap + roving tabindex |
| `<ScoreRing>` | Dashboard, Radar (variant=small) | `value`, `size=172`, `stroke=13`, `gradient` | inicial idle; sem animação live (evita "0 piscando") | `role="img" aria-label="Score 72 de 100"` |
| `<SubScoreList>` | Dashboard | `items=[{label,value,tag,why,source}]` | tone(value) determina cor | `<dl>` semântico |
| `<MedianaComparison>` | Dashboard | `your`, `median` | — | descrição textual abaixo, não só visual |
| `<ActionCard>` | Dashboard | `n`, `title`, `why`, `tag`, `impact` | hover: bg `#FAF9FE` | botão "Começar" tem aria-label completo |
| `<ProfileSnapshot>` | Dashboard | `user`, `skills`, `completeness` | — | chip de skill = `<span>` semântico |
| `<TargetRolePill>` | Dashboard, Gaps | `role`, `onClick` | hover: bg `#F6F5FA` | `<button>` com `aria-label="Mudar cargo-alvo"` |
| `<KPIStripCard>` | Gaps | `value`, `label`, `valueColor`, `valueSub` | — | numero em `<strong>` |
| `<RequirementRow>` | Gaps | `name`, `pct`, `count`, `status` | bg condicional por status | row tem `<tr>` ou `role="row"` |
| `<JobCard>` | Radar | `job`, `variant` | hover: shadow lift sutil | card todo é `<article>`, link "Ver vaga" tem `rel="noopener noreferrer"` |
| `<JobFilters>` | Radar | `filters`, `onChange` | open/closed dropdown | `<details>` ou combobox WAI-ARIA |
| `<FitRing>` | JobCard | `value`, `size=62` | tone(fit) — verde ≥80, índigo ≥70, oliva resto | `aria-label` |
| `<WhyChip>` / `<MissingChip>` | JobCard | `text` | — | `<span>` |
| `<ScoreOverTimeChart>` | Plano | `points`, `delta` | nenhum (server-rendered SVG) | `<figure>` com `<figcaption>` descrevendo evolução |
| `<TimelineRow>` | Plano | `date`, `title`, `detail`, `status` | dot color via status | `<li>` em `<ol>` |
| `<PrincipleCard>` | Transparência | `items` | — | h3 dentro |
| `<FormulaRow>` | Transparência | `weight`, `label`, `value`, `formula`, `tone` | tone(value) cor | — |
| `<DataSourceCard>` | Transparência | `icon`, `title`, `lede` | — | h3 |
| `<LGPDBanner>` | Sidebar + Transparência + Conta | (sem props) | — | landmark? Provavelmente não — é apenas info |
| `<EmptySnapshotState>` | Dashboard, Gaps, Radar, Plano | `cta` | — | h1 + lede |
| `<Skeleton>` | Loading | `width`, `height`, `radius` | ctShim infinite | `aria-hidden="true"` |
| `<Toast>` | Reusa do atual ou refaz | `type`, `message` | success/warn/err | `role="status"` |
| `<Modal>` | Reusa `components/Modal.js` atual | `onClose`, `children` | open/closed | focus trap + ESC |

Componentes legados que **continuam vivos sem mudança** durante a migração
(serão usados nos modais):
- `<InterviewModal>` (`components/InterviewModal.js`)
- `<TailorModal>` (`components/TailorModal.js`)
- `<ChatModal>` (`components/ChatModal.js`)
- `<PostHogProvider>` (`components/PostHogProvider.js`)

Esses precisam **só de retoque de paleta** (substituir `var(--accent)` por
`var(--primary)` etc.) — não de reescrita.

Componentes legados que **morrem ou viram parte de outro**:
- `<Report>` (`components/Report.js`, 367 linhas) — explode em 5 telas.
- `<LinkedinImportButton>`, `<PortfolioImportButton>` — viram filhos de
  `<OnboardSourceCard>` (mantém lógica, troca presentation).

---

## 8. Gestão de estado

### Estado local (`useState`)
- Onboarding (estado das 3 fontes)
- Modais abertos/fechados em telas autenticadas
- Toggle de expand/collapse de sub-score se mantivermos (mock não usa — sub-scores são planos no dashboard, vão pra `/transparencia` quando o user quer profundidade)

### Estado de sessão (auth)
- `await auth()` em todo server component que precisa de session
- Sem store global. Sem `useSession()` hook (NextAuth v5 server-first).

### Estado server (Prisma)
- **Toda tela autenticada lê do banco no server.** Sem fetch client em
  Dashboard/Gaps/Radar/Plano/Transparência.
- Dados:
  - `Profile` (`/api/profile`-equivalent ou Prisma direto)
  - `ScoreSnapshot[]` (com `gaps`, `planItems`, `perfilJson`, `subScoresJson`)
  - `Application[]` (candidaturas)
  - `User` (nome, email, digestEnabled)

### Estado client-side (caches)
- **Não usamos SWR ou react-query.** Server components + `revalidatePath()` em
  server actions cobrem tudo.
- Quando user marca microação como "concluída" no `/dashboard`, dispara
  server action que atualiza `PlanItem.status` no banco e `revalidatePath("/dashboard")`.
- Não há "live recalc do score" como tem o `Report.js:54-65` hoje — o score
  recalcula no próximo snapshot. **Mudança comportamental significativa.**

### Estado de tema
- `<ThemeToggle>` mantém-se sem mudanças (`components/ThemeToggle.js`).
- Default: **light** (oposto do atual).
- Layout root muda fallback de `'dark'` pra `'light'` no script inline
  (`app/layout.js:32` precisa virar `'light'`).

---

## 9. Responsive strategy

### Decisão: **desktop-first**
O mock é desktop-first (`vw < 880 ? mobile : desktop`). Vamos seguir.

Justificativa: o produto **viceja em desktop** (lendo CV, escrevendo cargo,
analisando vagas). Mobile é estado de leitura (ler score em ônibus). O
audit de UX (`docs/UX_AUDIT.md`) ressalta que o uso primário é desktop pra
gestão de busca de emprego (parecido com Huntr). Otimizar mobile-first nos
forçaria a achatar o ScoreRing 172px e o Plano SVG 640x230, que são *o
produto*.

### Breakpoint único: **880px**
- `< 880px`: mobile (sidebar vira header, container 100% width com padding 18px lateral)
- `>= 880px`: desktop (sidebar 252px fixa, container max 1180px)

### Sidebar collapse
**Não há sidebar colapsável.** Em mobile, ela transforma-se em header
horizontal. Em desktop, sempre 252px aberta. Sem variante "tablet" intermediária.

### Touch targets
- Mínimo 44x44px em mobile (botões de nav header, dots da timeline).
- Mock cumpre isso na maior parte; revisar especificamente os chips
  pequenos de skill que ficam com height 28px (não-interativos — ok).

### Typography scaling
- Não há clamp() ou fluid type no mock. Cada token tem **tamanho fixo**.
- H1 de tela = 26px desktop e mobile (não shrink).
- H1 do dashboard = 28px desktop e mobile.
- Mantemos isso — a legibilidade está calibrada manualmente.

---

## 10. Acessibilidade

### Contrast (WCAG AA mínimo)
- `--text-strong #1F1D33` sobre `--bg #F6F5F2`: contraste 14.7:1 ✓
- `--text-soft #514E5C` sobre `#fff`: contraste 8.4:1 ✓
- `--text-faint #797585` sobre `#fff`: contraste 4.78:1 ✓ (limite para text < 18px)
- `--text-mute #9893A4` sobre `#fff`: contraste 3.14:1 ✗ — **usar só em texto ≥ 18px ou para elementos não-textuais (linhas, dots, ícones decorativos)**

> **Atenção:** `#9893A4` aparece pra "de 100" sob ring (mock L248). 11px ≠ AA.
> Decisão: aceitar pois é decorativo/redundante (o número 72 ao lado já comunica).
> Validar com leitor de tela: incluir aria-label completo no `<ScoreRing>`.

### Focus visible
- Reusar `globals.css:120-123` (já existe):
  ```css
  :focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  ```
- Específico para botões índigo: outline branco interno + outline índigo externo
  (CTA "Ver gêmeo" sobre brand panel).

### Aria-labels obrigatórios
- Sidebar `<nav aria-label="Navegação principal">`
- ScoreRing `aria-label="Saúde da carreira: 72 de 100, mais 18 pontos em 5 meses"`
- FitRing por vaga `aria-label="Aderência de 82%"`
- Pills de tag (em evolução, ótimo, atenção): label completo "Match de skill: 64, em evolução"
- Botões ícone-only (close de modal, expand/collapse): `aria-label` descritivo

### Keyboard navigation
- Tab order: Skip link → sidebar nav → main content (h1 primeiro)
- Skip link no AppShell: `<a href="#main" className="visually-hidden focus:not-sr-only">Pular pro conteúdo</a>`

### Reduced motion
- `@media (prefers-reduced-motion: reduce)` já existe em `globals.css:116`.
- Manter regra global `*{animation:none!important; transition:none!important;}`.
- Adicionar exceção: `<Spinner>` (em loading) precisa ainda rotacionar para
  comunicar progresso — solução: substituir spinner por texto "Aguarde…"
  quando reduced-motion.

### Screen reader
- Todos os SVGs decorativos: `aria-hidden="true"` (ícones em chip, em row).
- SVGs informativos (ScoreRing, gráfico Plano): `<title>` + `<desc>` semânticos.
- Gráfico do `/plano`: incluir descrição textual abaixo do SVG ("Score saiu de
  54 em janeiro para 72 em maio").

---

## 11. Performance

### Bundle target
- **Sub-100kb JS por rota** (cliente). Plausível porque:
  - Server components dominam (Dashboard, Gaps, Plano, Transparência = 0 JS de
    componentes próprios)
  - Modais são lazy-loaded via `next/dynamic({ ssr: false })`
  - Sem react-query, sem framer-motion, sem libs de gráfico

### Image strategy
- **Zero raster.** Logos de empresa são iniciais coloridas em quadrado (mock L805).
- Avatares de usuário: gradient damasco com inicial branca; **só se** existir
  `user.image` carregamos `<img>` (já cobre em `/conta`).
- Ícones: SVG inline (já é o padrão atual).

### Font loading
- Mantém `<link rel="preconnect">` em `app/layout.js`.
- Famílias reduzidas pra Plus Jakarta + Spectral (atual tem 4 famílias → vai pra 2).
- `font-display: swap` (Google Fonts já injeta).

### LCP target
- LCP < 1.5s em 4G (provavelmente o card hero do dashboard).
- Sem imagens, LCP recai sobre texto + SVG inline — ambos servidos no HTML
  do server component. Não há fetch crítico no caminho.

### Caching
- Dashboard, Gaps, Plano, Transparência são `force-dynamic` (sempre fresh
  via session). Sem ISR.
- Onboarding (`/`) e `/entrar` podem ser estáticos *exceto* pela CSP nonce
  (já com `force-dynamic` em produção, ver `app/layout.js:11`).

---

## 12. Animações

| Animação | Implementação | Onde |
|---|---|---|
| **`ctFade`** (entrada de tela) | `animation: ctFade .4s ease both` no container `<div data-screen-label>` | Toda tela autenticada (mock L222, L367, L451, L507, L572). Onboarding usa `.5s`. |
| **`ctShim`** (skeleton loading) | `background: linear-gradient(90deg,#EDEBF4 25%,#E5E2EC 37%,#EDEBF4 63%); background-size: 400px 100%; animation: ctShim 1.2s ease infinite` | `<Skeleton>` reusável (onboarding L139, L163, L186) |
| **`ctSpin`** (loader) | `border: 2.5px solid #DAD9F1; border-top-color: #4F4FB0; animation: ctSpin .7s linear infinite` | Onboarding source loading (mock L136) |
| **Score reveal** | Sem animação JS. SVG `stroke-dashoffset` calculado server-side, valor final desde o mount. Container fade-in via `ctFade`. | Dashboard ScoreRing |
| **Progress bar onboarding** | `transition: width .6s cubic-bezier(.4,0,.2,1)` em `width: aiPct%` | Onboarding (mock L207) |
| **Hover** | `transition: background-color .15s, color .15s` | Botões, nav, source cards |
| **Tema** | `transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease` | Já existe em `globals.css:19` |

### Sobre o "bug do 0 piscando"
O `Report.js:64` calcula `liveOverall` no client e o `<circle>` começa com
`stroke-dashoffset = CIRC` (vazio) e anima até o valor real após o reveal
`setTimeout`. No Claude Design **não fazemos isso**:
- SVG é renderizado server-side com `stroke-dashoffset` calculado já no valor final.
- Container do hero faz `ctFade` (opacity 0 → 1, translate 8px → 0).
- Resultado: o número 72 e o arco do ring aparecem juntos, sem flash de "0".

---

## 13. Dark mode

### Status
`ThemeToggle.js` mantém-se. **Default vira light** (atual default é dark).

### Paleta dark do Claude Design
Não está no mock. Decisão pendente — opções:

**Opção A: "Índigo escuro" (recomendado)**
- `--bg #1A1A2E` (índigo bem escuro)
- `--surface #232347`
- `--primary #6E6EC8` (mais claro que o do light)
- Manter damasco e verde sereno iguais
- Identidade visual preservada

**Opção B: Reusar dark atual**
- `--bg #0A0A0A`, `--surface #1A1A1A`
- Mistura desconfortável: índigo `#4F4FB0` sobre preto perde a paz que define o tema

**Opção C: Adiar dark mode**
- Esconder o `<ThemeToggle>` na rota `(app)` até o dark do Claude Design estar
  desenhado. Light-only durante a transição.

**Recomendação:** **Opção C agora, Opção A em fase 2.** Migrar light é o
foco. Dark fica como follow-up.

---

## 14. Estratégia de migração

### Aproveitar route groups para coexistência
- Manter `app/page.js` (home atual) intocado durante dev.
- Criar `app/(app)/dashboard/page.js`, `app/(app)/gaps/page.js`, etc. em paralelo.
- O grupo `(app)` tem `layout.js` próprio com AppShell + paleta nova; rotas
  fora do grupo (`/`, `/entrar`) continuam com `app/layout.js` global.
- `/meu-gemeo` continua renderizando `Report.js` (apontando pro endpoint
  novo só quando estiver pronto).

### Ordem sugerida
1. **Sprint 1 (foundation):** Trocar fonts em `app/layout.js`. Renomear tokens
   em `globals.css` (criar duplicação `--primary` etc., manter aliases
   `--accent` → `--primary` durante migração). Implementar `<AppShell>`.
2. **Sprint 2 (core):** `/dashboard` (substitui `/meu-gemeo`).
3. **Sprint 3 (consequência):** `/gaps`, `/oportunidades`, `/plano`,
   `/transparencia`.
4. **Sprint 4 (entrada):** `/` (onboarding redesign), `/entrar` (retoque), redirect `/meu-gemeo` → `/dashboard`.
5. **Sprint 5 (cleanup):** apagar `<Report>` (`components/Report.js`),
   remover CSS legado, remover fontes Bricolage/Inter/JetBrains do `<link>`,
   limpar aliases (`--accent` → `--primary` etc.).

### Feature flag?
**Não usar feature flag.** Migração é em branch (`redesign/claude-design`)
e merge é big-bang. Tem 2 motivos:
- O CSS é incompatível (tokens diferentes). Conviver dois temas é caro.
- Coexistência via route group já dá segurança de rollback (revert do PR).

### Riscos do go-live
- **CSS legado contaminando rotas novas:** `globals.css` tem 1276 linhas hoje.
  Estratégia: criar `app/redesign.css`, importar **só** em `app/(app)/layout.js`
  e nas rotas `/`, `/entrar`. Quando o legado morrer, fundir os dois.
- **Modais legados:** `<InterviewModal>` e cia. usam `var(--accent)` (verde-limão).
  No Claude Design, `--accent` não existe — vira `--primary`. Adicionar
  shim em `globals.css`:
  ```css
  :root { --accent: var(--primary); --accent-soft: var(--primary-soft); }
  ```
  até reescrita completa dos modais.

---

## 15. Riscos técnicos (top 5)

1. **AppShell + route groups:** Next 14 com route groups e layout aninhado tem
   pegadinha quando combinado com `force-dynamic` + middleware CSP nonce
   (já presente). Validar early: criar AppShell vazio + rota dummy
   `/dashboard` mostrando "hello" antes de qualquer componente complexo.
2. **Coexistência de paletas (legado dark + Claude light):** modais legados
   compartilham `globals.css` com as telas novas. CSS variables resolvem
   tematização local, mas se um modal abrir sobre fundo creme com `--bg #0A0A0A`
   por baixo (scrim), quebra. Solução: scope explícito (`.legacy *` /
   `.redesign *`) ou eliminação dos legados antes do go-live.
3. **Line chart SVG do `/plano`:** mock entrega 5 pontos hardcoded com
   coordenadas manuais. Real-world: snapshots irregulares no tempo, 1 a 30+
   pontos. Precisa de função que calcule x/y proporcional. Em `<TimelineRow>`
   o problema é simétrico (ordenação + agrupamento por data). Subestimável.
4. **Score "live recalc" sumindo:** o `Report.js:54-65` permite marcar gap
   como concluído e ver o score subir na hora. **No Claude Design isso some**
   (ações concluídas geram novo snapshot no próximo build). É mudança de
   produto — alinhamento com PM antes de implementar. Se manter, o `/dashboard`
   precisa de client state isolado por ação.
5. **Acessibilidade do gráfico de evolução:** SVG inline com 5 pontos labeled
   é OK; mas se evolui pra "tooltip on hover" (esperado em produção), vira
   problema de teclado/SR. Custo do "polishing" muitas vezes ultrapassa o
   custo do render base.

---

## 16. Estimativas

> Hours = horas de trabalho realista pra **um dev senior focado**. Inclui
> implementação, testes manuais, ajuste responsivo, code review. NÃO inclui
> design handoff (mock é suficiente como spec).

| Etapa | Horas |
|---|---|
| **Sprint 1 — Foundation** | |
| Tokens em `globals.css` (paleta + tipografia + scale) | 4h |
| Trocar fonts no `app/layout.js` + remover legado | 1h |
| `<AppShell>` (layout `(app)`, Sidebar desktop, MobileTopBar) | 8h |
| `<Skeleton>`, `<Toast>`, `<LGPDBanner>` reusáveis | 3h |
| `<ScoreRing>` + `<FitRing>` (SVG props-driven) | 4h |
| Subtotal Sprint 1 | **20h** |
| **Sprint 2 — Dashboard** | |
| `/dashboard` (server component + leituras Prisma) | 4h |
| `<DashboardHeader>` + `<TargetRolePill>` | 2h |
| Hero card (ring + mediana + sub-scores list) | 8h |
| `<ActionCard>` + 3 próximas ações | 4h |
| `<ProfileSnapshot>` | 4h |
| Empty state + responsividade | 3h |
| Subtotal Sprint 2 | **25h** |
| **Sprint 3 — Demais telas autenticadas** | |
| `/gaps` (KPI strip + requirements + right rail) | 12h |
| `/oportunidades` (filters + JobCard com FitRing) | 14h |
| `/plano` (SVG dinâmico + timeline) | 16h |
| `/transparencia` (principle card + fórmula + sources) | 8h |
| Subtotal Sprint 3 | **50h** |
| **Sprint 4 — Pública** | |
| `/` onboarding (brand panel + 3 source cards stateful + progress) | 16h |
| `/entrar` retoque de paleta (lógica intocada) | 3h |
| Redirect `/meu-gemeo` → `/dashboard` | 0.5h |
| Subtotal Sprint 4 | **19.5h** |
| **Sprint 5 — Cleanup + remanescentes** | |
| Adaptar `<InterviewModal>`, `<TailorModal>`, `<ChatModal>` (paleta) | 6h |
| Adaptar `/conta`, `/meus-dados`, `/candidaturas` ao AppShell | 14h |
| Remover CSS legado, fontes, aliases | 4h |
| Cobertura de testes Vitest (componentes shared) | 8h |
| Cobertura Playwright (smoke das 6 telas + auth flow) | 8h |
| A11y audit + correções (axe) | 6h |
| Subtotal Sprint 5 | **46h** |
| **Buffer (15%)** | **24h** |
| **Total esperado** | **~185h** |

**Tradução em calendário:** ~5 semanas de 1 dev senior focado a 80%
(considerando interrupções, code review, reuniões). Em time de 2 devs
trabalhando em paralelo (com merge contínuo): ~3 semanas calendar.

---

## Anexos: Inconsistências mock × produto atual

> Não-bloqueante, mas merecedor de discussão com produto:

1. **Onboarding sem textarea.** Atual permite colar texto cru; mock não.
   Forçar upload de PDF pode ser fricção pra quem não tem PDF na mão.
2. **Live recalc do score** (microação concluída → score sobe) é feature-killer
   no produto atual. Mock não tem. Confirmar se sumiu de propósito.
3. **CTA "Treinar entrevista" / "Conversar com gêmeo"** existem no `Report.js:93-100`
   mas não no mock. Onde vão no Claude Design? Sugestão: pill no header do
   `/dashboard` ou seção própria.
4. **Análise de gaps tem 8 requirements** no mock, mas o produto atual gera 3-5
   gaps por snapshot. Precisa ampliar a saída do `/api/analyze`?
5. **Vagas no mock têm `level`, `model`, `salary` separados em tags;** atual tem
   tudo em string única (`"Pleno · Remoto · R$ 16-22k"`). Padronizar shape.
6. **Persona "Mariana"** é onipresente no mock — vira empty-state demo no produto?
   Decisão de produto.
7. **Sidebar mostra "M" no avatar e "Mariana Andrade · Eng. Backend → PM de IA"**
   no rodapé — o produto atual mostra email. No Claude Design, exibir
   `user.name || user.email` + targetRole atual. Atualizar `Profile.targetRole`
   via `/conta` (já existe lógica).
8. **`/transparencia` é uma rota nova** — não existia. Decidir se a entrada é
   via sidebar permanente ou só link no rodapé de cada tela.

---

## Referências cruzadas

- Mock fonte: `/tmp/careertwin-mock/CareerTwin AI - entrega/fonte/CareerTwin AI.dc.html`
- Princípios: `/tmp/careertwin-mock/CareerTwin AI - entrega/LEIA-ME.md`
- Componente principal a ser explodido: `components/Report.js` (367 linhas)
- Design system atual a ser substituído: `app/globals.css` (1276 linhas)
- Layout root atual: `app/layout.js`
- Toggle de tema mantido: `components/ThemeToggle.js`
- Auth lib (mantida): `lib/auth.js`
- Schema Prisma (mantido): `prisma/schema.prisma`
- Endpoints de API (mantidos): `app/api/{analyze,opportunities,cv,linkedin,portfolio,applications}`
- UX audit anterior (contexto de mercado): `docs/UX_AUDIT.md`
- Produto descrito: `docs/PRODUTO.md`
- API descrita: `docs/API.md`
