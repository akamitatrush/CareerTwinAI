# Setup de Auth em Producao — Checklist

Esse doc e pro founder/admin habilitar login em producao. Sem isso, prod fica em "modo demo" e nenhum usuario consegue entrar.

Tempo total esperado: 60-90min na primeira vez (DNS leva tempo pra propagar).

## Pre-requisitos

- [ ] Conta Vercel com acesso ao projeto `career-twin-ai`
- [ ] Dominio decidido (custom — `careertwin.com.br` / `careertwin.com` — ou subdominio existente tipo `app.dominio.com`)
- [ ] Acesso ao registrar de DNS do dominio (registro.br se `.com.br`, Cloudflare/Namecheap/etc se outro)
- [ ] `AUTH_SECRET` ja setado em Production (caso contrario, ver "Variaveis obrigatorias adicionais" no fim do doc)

## Como funciona o "modo demo"

Hoje, se nenhum provider tem credenciais setadas, a tela de login mostra "Login em modo demo" e nao deixa entrar. Isso e proposital: o codigo so registra um provider se as env vars dele estiverem presentes (ver `lib/auth.js` — todos os providers tem `if (process.env.X && process.env.Y)`). Adicionar as variaveis abaixo no Vercel + redeploy = providers aparecem na tela de login automaticamente.

---

## Provider 1 — Resend (Magic Link via Email) — RECOMENDADO COMO PRIMEIRO

### Por que primeiro?
Magic link e fallback universal: usuario sem Google/LinkedIn consegue entrar. Tambem e barato (free tier 3000 emails/mes) e nao depende de OAuth consent screen review.

### Passo-a-passo

1. **Criar conta Resend**: https://resend.com (free tier: 3000 emails/mes, 100/dia).
2. **Verificar dominio**:
   - Dashboard Resend → Domains → Add Domain
   - Adicione `careertwin.com.br` (ou o subdominio escolhido, tipo `mail.careertwin.com.br`)
   - Resend mostra 2-3 registros DNS (SPF, DKIM, opcionalmente MX e DMARC)
   - Copia os registros e adiciona no teu registrar de DNS:
     - `.com.br` puro → registro.br → Editar zona DNS
     - Cloudflare/outro → painel do provider de DNS
   - Aguarda propagacao (geralmente 5min, ate 24h no pior caso)
   - Volta no Resend e clica em "Verify". Status deve ficar `Verified`.
3. **Gerar API Key**:
   - Dashboard → API Keys → Create API Key
   - Nome: `careertwin-prod`
   - Permission: `Sending access` (sufficient)
   - Copia a key (comeca com `re_`). NAO vai aparecer de novo.
4. **Configurar no Vercel**:
   - Project `career-twin-ai` → Settings → Environment Variables
   - Adicione:
     - `AUTH_RESEND_KEY=re_xxxxxxxxxxxxx` — marcar **Production + Preview**
     - `EMAIL_FROM=login@careertwin.com.br` (ou o dominio verificado) — marcar **Production + Preview**
5. **Redeploy**:
   - Settings → Deployments → ultima deployment → ... → Redeploy
   - OU empurra qualquer commit pra branch que dispara deploy
6. **Smoke test**: ver secao "Smoke test pos setup" no final.

Pronto. Magic link deve funcionar.

---

## Provider 2 — Google OAuth

### Pre-requisitos
- Conta Google (gmail pessoal serve pra criar o projeto)
- 15-45min disponiveis (Cloud Console confunde na primeira vez)

### Passo-a-passo

1. **Criar projeto no Google Cloud**:
   - https://console.cloud.google.com
   - Top bar → "Select Project" → "New Project"
   - Nome: `careertwin-auth`
   - Organization: pode deixar "No organization"
   - Clica Create. Aguarda 10-30 segundos.
2. **Configurar OAuth Consent Screen**:
   - Menu lateral (hamburguer) → APIs & Services → OAuth consent screen
   - User Type: **External** (pra qualquer email Google poder logar)
   - Clica Create.
   - Preencha:
     - App name: `CareerTwin AI`
     - User support email: teu email
     - App logo: opcional (recomendado pra producao)
     - App domain → Application home page: `https://careertwin.com.br` (ou o teu dominio)
     - App domain → Privacy policy: `https://careertwin.com.br/privacidade`
     - App domain → Terms of service: `https://careertwin.com.br/termos` (se existir)
     - Authorized domains: adiciona `careertwin.com.br` (sem `https://`, sem path)
     - Developer contact: teu email
   - Save and continue.
   - Scopes: clica "Add or Remove scopes" → marca `email`, `profile`, `openid`. Save.
   - Test users: enquanto app estiver em "Testing", so emails aqui conseguem logar. Adiciona teu email + qualquer beta tester. Save.
3. **Criar credenciais OAuth**:
   - Menu → APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Name: `CareerTwin Web Auth`
   - Authorized JavaScript origins:
     - `https://careertwin.com.br` (prod custom)
     - `https://career-twin-ai-git-redesign-claude-design-log-null-sec.vercel.app` (preview branch atual; atualize quando trocar de branch)
     - `http://localhost:3000` (dev local)
   - Authorized redirect URIs:
     - `https://careertwin.com.br/api/auth/callback/google`
     - `https://career-twin-ai-git-redesign-claude-design-log-null-sec.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
   - Clica Create.
   - Copia o **Client ID** (xxx.apps.googleusercontent.com) e o **Client Secret** (GOCSPX-xxxxx).
4. **Configurar no Vercel**:
   - Settings → Environment Variables
   - Adicione:
     - `AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com` — **Production + Preview**
     - `AUTH_GOOGLE_SECRET=GOCSPX-xxxxxxxxxx` — **Production + Preview**
5. **Publicar app** (quando tiver pronto pra usuarios reais alem dos test users):
   - OAuth consent screen → Publishing status → "Publish App"
   - Para scopes basicos (`email`, `profile`, `openid`), **nao precisa de Google review** — vira `In production` na hora.
   - Quota: 100 unverified users / dia ate publicar. Com scopes basicos, publicar nao trava nada.
6. **Redeploy** e smoke test.

---

## Provider 3 — LinkedIn OAuth

### Por que importante?
Produto de carreira — LinkedIn e a fonte de dados perfeita. Login pre-popula perfil profissional. Diferenciador competitivo direto.

### Pre-requisitos
- Pagina LinkedIn da empresa CareerTwin (cria em https://www.linkedin.com/company/setup/new se nao tiver)

### Passo-a-passo

1. **Criar app LinkedIn**:
   - https://www.linkedin.com/developers/apps/new
   - App name: `CareerTwin AI`
   - LinkedIn Page: seleciona a pagina da empresa
   - Privacy policy URL: `https://careertwin.com.br/privacidade`
   - App logo: logo da empresa (obrigatorio, qualquer PNG 100x100+)
   - Aceita os termos, Create.
2. **Configurar Auth**:
   - Na app criada → aba "Auth"
   - **Authorized redirect URLs**:
     - `https://careertwin.com.br/api/auth/callback/linkedin`
     - `https://career-twin-ai-git-redesign-claude-design-log-null-sec.vercel.app/api/auth/callback/linkedin`
     - `http://localhost:3000/api/auth/callback/linkedin`
   - OAuth 2.0 scopes: na aba "Products" → adiciona "Sign In with LinkedIn using OpenID Connect". LinkedIn aprova na hora pra esse produto basico. Os scopes liberados sao `openid`, `profile`, `email`.
3. **Pegar credenciais**:
   - Aba "Auth" → "Application credentials"
   - Client ID + Client Secret (copia ambos)
4. **Configurar no Vercel**:
   - Adicione:
     - `AUTH_LINKEDIN_ID=xxxxxxxxx` — **Production + Preview**
     - `AUTH_LINKEDIN_SECRET=xxxxxxxxx` — **Production + Preview**
5. **Redeploy** e smoke test.

---

## Variaveis obrigatorias adicionais

Independente dos providers acima, esses sao necessarios pro Auth.js funcionar:

- `AUTH_SECRET` — segredo simetrico pra assinar JWTs.
  - Gera com: `openssl rand -base64 32`
  - Setar em **Production E Preview**.
  - **Nunca commitar.** Nunca compartilhar fora de env vars Vercel.
- `AUTH_TRUST_HOST=true` — necessario em deploys atras de proxy (Vercel).
- `DATABASE_URL` — postgres connection string (Neon). Provavelmente ja setado, confirma em Settings → Environment Variables.
- `AUTH_URL` (opcional mas recomendado em prod) — URL canonico, ex: `https://careertwin.com.br`. Sem isso, Auth.js infere do request host (funciona, mas pode confundir em proxies).
- `OWNER_EMAILS` — comma-separated, libera acesso a `/admin`. Ex: `OWNER_EMAILS=sergio@lognullsec.com`. Sem isso, ninguem vira admin.

### Opcional — rate limit em prod

Pra rate-limit de magic link funcionar entre lambdas Vercel (em vez de in-memory por instancia):

- `UPSTASH_REDIS_REST_URL` — cria em https://upstash.com (free tier serve)
- `UPSTASH_REDIS_REST_TOKEN`

Sem essas, rate limit cai pra in-memory (funciona mas e per-lambda, defesa mais fraca).

---

## Smoke test pos setup

Depois de adicionar variaveis e fazer redeploy:

1. Acessa `https://careertwin.com.br/entrar` (ou URL Vercel direto)
2. Deve ver botoes de Google e/ou LinkedIn (NAO mais "Login em modo demo")
3. **Google**: clica em Google → consent screen aparece → autoriza → volta logado no dashboard
4. **LinkedIn**: idem
5. **Magic link**: digita teu email → "Receber link" → checa inbox → clica no link do email → entra logado
6. Confere `/conta` ou `/dashboard` mostrando teu email correto

### Se algum provider falha

- Acessa Vercel → Project → Functions → `/api/auth/[...nextauth]` → veja logs do request
- Confirma env vars setadas em **AMBOS** Production E Preview (drift causa "funciona em preview, nao em prod" — sintoma classico)
- Confirma redirect URLs no provider match **exatamente** com o dominio que ta sendo usado (caracter por caracter, incluindo http vs https)
- Para Google: confirma que o teu email ta na lista de "Test users" se o app estiver em "Testing" status
- Para erro `OAuthAccountNotLinked`: o email ja tem conta com outro provider — use o provider original ou consolida via DB

### Codigos de erro comuns na pagina `/auth/error`

A pagina mostra mensagens amigaveis. Os codigos sao do Auth.js (https://authjs.dev/reference/core/errors):

- `Configuration` — env var faltando, secret quebrado
- `AccessDenied` — user clicou "negar" no consent
- `Verification` — magic link expirado ou ja usado
- `OAuthAccountNotLinked` — email com conta em outro provider
- `OAuthCallback` — provider retornou erro na callback (ver logs)

---

## Rollback

Se setup quebrar prod, **remove as env vars novas** no Vercel → proximo deploy volta pro "modo demo" inofensivo. Ninguem perde dados (sessions JWT expiram naturalmente, contas DB permanecem).

Se um provider especifico ta dando merda mas outros funcionam, remove SO as env vars dele (ex: `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`). O provider some da tela, os outros continuam.

---

## Manutencao

- **Secret rotation**: trocar `AUTH_SECRET` invalida todas as sessions ativas. Faz a cada 6-12 meses ou se vazar.
- **OAuth secret rotation**: Google/LinkedIn permitem rotacionar client secret no dashboard sem perder users (so atualiza env var Vercel + redeploy).
- **Quota Resend**: monitora em https://resend.com/emails. Free tier 3000/mes; se passar, upgrade pra $20/mes (50k emails).
- **Quota Google**: 100 unverified users/dia ate publicar. Publicado: ilimitado pra scopes basicos.
