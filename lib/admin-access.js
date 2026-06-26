// Controle de acesso pra /admin (visao de uso/metricas internas).
// Separado de OWNER_EMAILS (que e billing bypass pra equipe convidada).
//
// Distincao:
//  - OWNER_EMAILS: equipe que voce convidou pra testar (plano pro_yearly
//    automatico, sem cap diario). Multiplas pessoas.
//  - ADMIN_EMAILS: voce. Acesso a /admin com PII agregada de outros users.
//    Geralmente 1-2 emails do founder. NUNCA expandir pra equipe sem
//    decisao explicita.
//
// Defesa em camadas:
//  - Page /admin faz auth() + isAdminEmail() — 401/redirect se falha
//  - Rota /api/admin/* mesma checagem — 401/403 sem expor existencia
//  - Middleware so exige session em /admin (defense-in-depth, sem
//    duplicar isAdminEmail no edge runtime pra evitar import nesse path)
//
// Privacidade:
//  - Sem ADMIN_EMAILS no env, retorna false (fail closed). Logs warn
//    no primeiro hit pra voce notar configuracao faltando.
//  - Case-insensitive + trim, defesa contra typo em env var.

const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

let _warnedEmpty = false;

export function isAdminEmail(email) {
  if (ADMIN_EMAILS.size === 0) {
    if (!_warnedEmpty) {
      console.warn(
        "[admin-access] ADMIN_EMAILS env var nao configurada. /admin e /api/admin/* vao negar TODOS os usuarios. Configure no Vercel pra liberar."
      );
      _warnedEmpty = true;
    }
    return false;
  }
  if (!email) return false;
  return ADMIN_EMAILS.has(String(email).toLowerCase().trim());
}

// Exportado pra testes/diagnostico.
export function _getAdminEmailsCount() {
  return ADMIN_EMAILS.size;
}
