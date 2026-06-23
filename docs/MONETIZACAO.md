# Monetização — CareerTwin AI

Documento de referência da camada de billing do CareerTwin (Stripe Phase 1+2).
A UI de pricing/paywall **ainda não foi construída** — aguarda validação de ICP.
Esta foundation é integralmente API-first e sem retrabalho quando a UI vier.

## Modelo (placeholder até validar ICP)

| Plano | Preço (BRL) | Limites |
|---|---|---|
| Free | R$ 0 | 3 diagnósticos/mês, 1 CV adaptado/mês, 5 buscas de vagas/dia, 5 simulações/mês |
| Pro (mensal) | R$ 29 | Ilimitado, priority LLM, sem branding |
| Pro (anual) | R$ 290 (~17% off) | Ilimitado, priority LLM, sem branding |
| Team (B2B) | R$ 99/seat/mês | Ilimitado + admin (seats/orgs em fase 3) |

Limites e preços em `lib/billing/plans.js` — única fonte de verdade.

## Arquitetura (resumo)

```
lib/billing/
  plans.js     -> Configuração de planos, limites, periodKey/dayKey.
  stripe.js    -> Singleton lazy do SDK. isStripeConfigured() pra fallback.
  enforce.js   -> getUserPlan, checkUsage, trackUsage, enforceUsage.

app/api/billing/
  checkout/    -> POST: cria Stripe Checkout Session (modo subscription).
  portal/      -> POST: abre Customer Portal pro user logado.
  webhook/     -> POST: recebe eventos Stripe (HMAC) + idempotência.
  plan/        -> GET: plano atual + uso do mês/dia do user logado.

app/api/cron/usage-cleanup/  -> Mensal: apaga UsageMeter > 3 meses.

prisma/schema.prisma:
  Subscription (1:1 com User)
  UsageMeter   (contador userId+feature+periodKey, upsert atômico)
  BillingEvent (log idempotente de webhooks)
```

## Setup Stripe (passo a passo)

1. **Conta Stripe**: crie em https://dashboard.stripe.com/. Em dev, use modo
   "Test" (chaves `sk_test_...`).
2. **API key**: Developers → API keys → Secret key. Cole em `STRIPE_SECRET_KEY`.
3. **Produtos e preços**: Products → Add product. Crie 3:
   - Pro mensal → R$ 29 / month → copie o `price_xxx` pra `STRIPE_PRICE_PRO_MONTHLY`.
   - Pro anual → R$ 290 / year → `STRIPE_PRICE_PRO_YEARLY`.
   - Team mensal → R$ 99 / month (per seat habilitado) → `STRIPE_PRICE_TEAM_MONTHLY`.
4. **Webhook**: Developers → Webhooks → Add endpoint
   - URL: `https://seu-dominio/api/billing/webhook`
   - Eventos:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Signing secret → `STRIPE_WEBHOOK_SECRET`.
5. **Customer Portal**: Settings → Billing → Customer portal → Activate (default
   liga troca de plano, cancelamento e atualização de método de pagamento).
6. **Deploy**: reinicie/redeploy o app após setar as envs no Vercel.

### Testes locais com Stripe CLI

```bash
# instala (https://stripe.com/docs/stripe-cli)
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
# usa o whsec_... que ele imprime como STRIPE_WEBHOOK_SECRET local
```

Dispara eventos manualmente:
```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

## Como ativar enforcement gradual

Hoje, o enforcement está **ativo** em 4 rotas LLM-heavy:

- `app/api/analyze/route.js` — feature `analyze` (3/mês no Free)
- `app/api/tailor/route.js` — feature `tailor` (1/mês no Free)
- `app/api/opportunities/route.js` — feature `opportunities` (5/dia no Free)
- `app/api/interview/route.js` — feature `interview` (5/mês no Free)

Sem `STRIPE_SECRET_KEY` setada, **enforcement continua funcionando** (limites
do plano free aplicados), só não há upgrade possível. Pra desligar enforcement
totalmente, basta editar `lib/billing/plans.js` e zerar os limites do Free pra
`Infinity` — mas o caminho recomendado é **manter limites** desde dia 1 pra
acostumar UX (mensagem de erro 402 já vem com `upgradeUrl: "/precos"`).

## Como adicionar plano novo

1. Edita `lib/billing/plans.js`:
   ```js
   export const PLANS = {
     // ... existentes ...
     pro_lifetime: {
       id: "pro_lifetime",
       name: "Pro vitalicio",
       priceBRL: 999,
       stripePriceId: process.env.STRIPE_PRICE_PRO_LIFETIME || "price_x",
       interval: null,  // one-time
       limits: { /* ... */ },
       features: { /* ... */ },
     },
   };
   ```
2. Cria Price no Stripe Dashboard (mode: one-time se `interval: null`).
3. Seta `STRIPE_PRICE_PRO_LIFETIME` no Vercel.
4. Pronto. Checkout aceita o novo `planId` (whitelist via `getPlan()`).

## Como mudar limites

Editar `lib/billing/plans.js` → campo `limits`. Mudança vale a partir do
próximo `checkUsage()`. Não afeta contagem histórica (UsageMeter mantém).

## Métricas pra acompanhar

A definir quando tiver volume:

- **MRR** (Monthly Recurring Revenue) — Stripe Dashboard tem nativo.
- **Churn rate** — % de cancelamentos / total ativos por mês.
- **LTV/CAC** — Lifetime Value vs Customer Acquisition Cost.
- **Conversão free → paid** — quantos % atingem limite e fazem upgrade.
- **Feature usage no Free** — qual feature bate limite primeiro (ICP signal).

## Segurança implementada

- **HMAC nos webhooks**: `stripe().webhooks.constructEvent()` valida assinatura
  antes de qualquer side-effect.
- **Idempotência**: `BillingEvent.stripeEventId` UNIQUE → segundo
  processamento do mesmo evento responde 200 sem reaplicar.
- **userId server-side**: nunca confiar em body — vem sempre de `auth()`.
- **planId whitelist**: `getPlan()` retorna `free` se id inválido (fail closed).
- **Status checking**: `getUserPlan` só retorna plano pago se status
  ACTIVE/TRIALING e `currentPeriodEnd` ≥ agora. Webhook delay protegido.
- **503 quando não configurado**: build passa sem `STRIPE_SECRET_KEY`.
- **PII**: webhook payload contém só dados do customer dono (Stripe não envia
  cross-customer). Logs usam só `.message`, sem PII.

## Roadmap (fase 3+, espera ICP)

- Página `/precos` com 3 colunas + CTA.
- Modal de paywall ao bater limite (UX consistente cross-feature).
- Trial flow (X dias grátis no Pro).
- NFe BR (decisão depende de PF vs PJ — talvez Iugu/Asaas se BR-only).
- Dunning emails (lembretes de cartão recusado).
- Team seats UI (admin convida membros, vê uso agregado).
- Lifetime/credit packs (one-time payments).

## Variáveis de ambiente

Ver `.env.example` na raiz. Sem as 5 variáveis abaixo, billing roda em modo
degraded (limites do Free aplicados, mas sem upgrade possível):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_TEAM_MONTHLY`
