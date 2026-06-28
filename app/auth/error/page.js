// Pagina customizada de erro de auth. Auth.js v5 redireciona pra ca via
// pages.error="/auth/error" sempre que falha login (OAuth, magic link,
// credentials). Sem essa pagina, falhas caem no /api/auth/error builtin
// (tela em branco/stack trace exposta).
//
// Seguranca (OWASP A09 + A03):
//  - searchParams.error vem do Auth.js (codes documentados em
//    https://authjs.dev/reference/core/errors). Validamos contra a whitelist
//    ERROR_MESSAGES — qualquer valor fora cai no "default", evitando
//    reflected XSS via ?error=<script>.
//  - React JSX escapa por default; nao usar dangerouslySetInnerHTML.
//  - Nao logamos o code nem revelamos detalhe alem da mensagem amigavel
//    (evita account enumeration / info leak via erro de provider).
//  - force-dynamic: searchParams sempre fresco; sem cache de pagina de erro.

import Link from "next/link";

const ERROR_MESSAGES = {
  Configuration: "Algo no setup do auth ta faltando. Tenta de novo em alguns minutos.",
  AccessDenied: "Voce cancelou a autorizacao. Tenta de novo quando quiser.",
  Verification: "O link magico expirou ou ja foi usado. Pede um novo.",
  OAuthAccountNotLinked: "Esse email ja tem conta com outro provider. Use o provider original.",
  OAuthCallback: "Falhou na troca de autorizacao. Tenta de novo.",
  OAuthSignin: "Nao consegui iniciar o login. Tenta outro provider.",
  OAuthCreateAccount: "Nao consegui criar conta com esse provider. Tenta outro.",
  EmailCreateAccount: "Nao consegui criar conta com esse email. Tenta outro.",
  Callback: "Algo deu errado no retorno do provider. Tenta de novo.",
  EmailSignin: "Nao consegui enviar o link magico. Confere o email.",
  CredentialsSignin: "Credenciais invalidas.",
  SessionRequired: "Faca login pra acessar essa pagina.",
  default: "Algo deu errado no login. Tenta de novo.",
};

export const dynamic = "force-dynamic";

export default async function AuthErrorPage({ searchParams }) {
  // Next 15: searchParams e Promise.
  const sp = (await searchParams) || {};
  const raw = sp.error;
  // Whitelist: so codes conhecidos passam. Qualquer outro -> default.
  const code = typeof raw === "string" && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, raw)
    ? raw
    : "default";
  const message = ERROR_MESSAGES[code];

  return (
    <main className="wrap" style={{ paddingTop: 96 }}>
      <section style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <p className="app-eyebrow" style={{ marginBottom: 16 }}>ERRO DE LOGIN</p>
        <h1 className="ct-page-header-title" style={{ marginBottom: 16 }}>
          Nao consegui te entrar.
        </h1>
        <p style={{ fontSize: 16, color: "var(--fg-muted)", marginBottom: 32 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/entrar" className="btn-primary" style={{
            padding: "12px 24px", background: "var(--accent)", color: "var(--bg)",
            borderRadius: "var(--radius-md)", textDecoration: "none", fontWeight: 600,
          }}>Tentar de novo</Link>
          <Link href="/" className="btn-ghost" style={{
            padding: "12px 24px", border: "1px solid var(--border-strong)", color: "var(--fg)",
            borderRadius: "var(--radius-md)", textDecoration: "none", fontWeight: 500,
          }}>Voltar pra home</Link>
        </div>
        {code !== "default" && (
          <p style={{
            marginTop: 32, fontSize: 12, color: "var(--fg-dim)", fontFamily: "var(--font-mono)",
          }}>Codigo: {code}</p>
        )}
      </section>
    </main>
  );
}
