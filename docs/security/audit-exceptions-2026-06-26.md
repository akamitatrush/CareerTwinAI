# Audit exceptions — 2026-06-26

Documenta vulnerabilidades aceitas temporariamente para destravar deploy a prod do redesign Sociedade do Anel (PR #13).

## Resumo

| Pacote | Versão atual | Severidade | CVEs | Fix disponível | Ação |
|---|---|---|---|---|---|
| `next` | `^14.2.35` | HIGH | 14 | ✅ `next@16.2.9` (2 major bumps) | Sprint dedicada de upgrade |
| `nodemailer` | `^7.0.13` (transitiva via `@auth/core`) | HIGH | 6 | ❌ sem fix upstream | Aguardar `@auth/core` patch |
| `postcss` | (transitiva) | MODERATE | 1 | ✅ via upgrade Next | Resolve junto com Next 16 |

CI gate rebaixado de `--audit-level=high` para `--audit-level=critical` em `.github/workflows/ci.yml` enquanto os dois itens acima estiverem em aberto.

## Análise de exposição em produção

### Next.js 14.2.35

CVEs listados:

1. GHSA-9g9p-9gw9-jx7f — DoS via Image Optimizer `remotePatterns` (self-hosted)
2. GHSA-h25m-26qc-wcjf — HTTP request deserialization → DoS em RSC inseguro
3. GHSA-ggv3-7p47-pfv8 — Request smuggling em rewrites
4. GHSA-3x4c-7xq6-9pq8 — `next/image` disk cache unbounded → exhaustion
5. GHSA-q4gf-8mx6-v5v3 — DoS via Server Components
6. GHSA-8h8q-6873-q5fj — DoS via Server Components (variante)
7. GHSA-3g8h-86w9-wvmq — Middleware/Proxy cache poisoning
8. GHSA-ffhc-5mcf-pf4q — XSS via CSP nonces em App Router
9. GHSA-vfv6-92ff-j949 — Cache poisoning via colisão RSC cache-busting
10. GHSA-gx5p-jg67-6x7h — XSS em `beforeInteractive` scripts
11. GHSA-h64f-5h5j-jqjh — DoS em Image Optimization API
12. GHSA-c4j6-fc7j-m34r — SSRF via WebSocket upgrades
13. GHSA-wfc6-r584-vfw7 — Cache poisoning em RSC responses
14. GHSA-36qx-fr4f-26g5 — Middleware/Proxy bypass em Pages Router com i18n

**Mitigantes em prod hoje:**
- Deploy é em Vercel (não self-hosted) — mata #1 e mitiga #4, #11 (Vercel gerencia image optimizer e cache).
- Aplicação usa App Router exclusivamente — #14 (Pages Router i18n) não se aplica.
- WAF da Vercel está ativo (rate limit + bot detection).
- CSP nonces não estão em uso atualmente — #8 não se aplica.
- `beforeInteractive` scripts não estão em uso — #10 não se aplica.

**Risco residual relevante:**
- #2, #5, #6 (DoS via RSC) — exploráveis em endpoints públicos.
- #7, #13 (cache poisoning) — exploráveis se houver shared cache layer.
- #3 (request smuggling rewrites) — depende de rewrites configuradas em `vercel.json`.

**Plano:** sprint dedicada para upgrade Next 14 → 16, com codemod oficial e testes E2E completos. Não fazer em janela de deploy de redesign.

### Nodemailer 7.0.13

CVEs listados:

1. GHSA-c7w3-x93f-qmm8 — SMTP command injection via `envelope.size`
2. GHSA-vvjj-xcjg-gr5g — CRLF injection em `transport name` (EHLO/HELO)
3. GHSA-268h-hp4c-crq3 — CRLF injection em `List-*` headers
4. GHSA-wqvq-jvpq-h66f — `jsonTransport` ignora `disableFileAccess`/`disableUrlAccess`
5. GHSA-r7g4-qg5f-qqm2 — TLS cert validation improper em OAuth2 token fetch
6. GHSA-p6gq-j5cr-w38f — `raw` option bypass de file/url access → SSRF + file read

**Mitigantes em prod hoje:**
- Nodemailer é usado apenas via `@auth/core` para envio de magic links de auth.
- `envelope.size`, `transport name` e `List-*` headers não recebem input de usuário — só strings hardcoded internas.
- `jsonTransport` e `raw` option não estão em uso.
- SMTP TLS é configurado para validar cert do provider externo.

**Risco residual relevante:**
- #5 (TLS cert validation OAuth2) — depende de provider OAuth2 SMTP estar em uso.

**Plano:** monitorar `@auth/core` releases; quando o fix entrar no upstream, aplicar imediatamente.

## Critério de reabertura

Antes de mergear qualquer PR futuro, conferir se:

- [ ] `next` foi atualizado para `>=16.2.9` (resolve 14 CVEs)
- [ ] `@auth/core` recebeu fix para nodemailer (resolve 6 CVEs)

Quando ambos os checks estiverem ✅, reverter `audit-level` em `.github/workflows/ci.yml` para `high`.

## Owner

- **Decisão de aceite:** Sérgio Hasher — 2026-06-26
- **Revisão obrigatória:** próximo audit OWASP da Sociedade do Anel (mensal)
