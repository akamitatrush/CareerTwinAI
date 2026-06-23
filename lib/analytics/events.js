// Taxonomy canonical de events PostHog. Importe daqui em vez de string
// literal pra evitar typos. Cada constante = um nome estavel pro dashboard.
//
// Convencao:
//  - snake_case minusculo (PostHog padrao).
//  - verbo no passado (`_completed`, `_clicked`, `_started`).
//  - prefixos por dominio: cv_*, gap_*, tailor_*, paywall_*, etc.
//
// PII handling:
//  - NUNCA inclua email/nome/CV cru em properties. Use IDs ou contagens.
//  - userId entra via identify() (lado do client), nao como property em capture.
//  - IP capturado pelo PostHog SaaS e anonimizado server-side por eles.

export const EVENTS = {
  // === Aquisição ===
  HOME_VIEWED: "home_viewed",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",

  // === Onboarding ===
  CV_PASTE_STARTED: "cv_paste_started",
  CV_UPLOAD_STARTED: "cv_upload_started",
  CV_UPLOAD_SUCCEEDED: "cv_upload_succeeded",
  CV_UPLOAD_FAILED: "cv_upload_failed",
  LINKEDIN_IMPORT_CLICKED: "linkedin_import_clicked",
  LINKEDIN_IMPORT_COMPLETED: "linkedin_import_completed",
  GITHUB_IMPORT_CLICKED: "github_import_clicked",
  GITHUB_IMPORT_COMPLETED: "github_import_completed",
  ROLE_DEFINED: "role_defined",

  // === Ativação (first value moment) ===
  DIAGNOSIS_STARTED: "diagnosis_started",
  DIAGNOSIS_COMPLETED: "diagnosis_completed",
  DIAGNOSIS_FAILED: "diagnosis_failed",

  // === Engagement ===
  DASHBOARD_VIEWED: "dashboard_viewed",
  GAP_VIEWED: "gap_viewed",
  GAP_COMPLETED: "gap_completed",
  GAP_UNCOMPLETED: "gap_uncompleted",
  COURSE_CLICKED: "course_clicked",
  EVIDENCE_ADDED: "evidence_added",
  ASSESSMENT_STARTED: "assessment_started",
  ASSESSMENT_COMPLETED: "assessment_completed",

  // === CV AI rewriter inline (feature #4 STRATEGY_ROADMAP) ===
  // Highlight de bullets fracos em /conta com sugestao de reescrita inline.
  // Sem PII em props (so contagens + scores agregados).
  CV_ANALYZED: "cv_analyzed",
  CV_SUGGESTION_VIEWED: "cv_suggestion_viewed",
  CV_SUGGESTION_ACCEPTED: "cv_suggestion_accepted",

  // === Career actions ===
  TAILOR_STARTED: "tailor_started",
  TAILOR_COMPLETED: "tailor_completed",
  INTERVIEW_STARTED: "interview_started",
  INTERVIEW_COMPLETED: "interview_completed",
  APPLICATION_SAVED: "application_saved",
  APPLICATION_STATUS_CHANGED: "application_status_changed",
  REFRESH_DIAGNOSIS_CLICKED: "refresh_diagnosis_clicked",
  REFRESH_DIAGNOSIS_COMPLETED: "refresh_diagnosis_completed",

  // === Copilot (widget flutuante sempre visivel) ===
  // Sprint 1 do STRATEGY_ROADMAP: presenca de IA conversacional persistente.
  // OPENED dispara so quando user abre (nao a cada page view), MESSAGE_*
  // capturam len+path pra entender intenção sem PII (conteúdo nao vai junto).
  COPILOT_OPENED: "copilot_opened",
  COPILOT_MESSAGE_SENT: "copilot_message_sent",
  COPILOT_MESSAGE_RECEIVED: "copilot_message_received",
  COPILOT_SUGGESTION_CLICKED: "copilot_suggestion_clicked",

  // === Retenção ===
  RETURN_AFTER_24H: "return_after_24h",
  RETURN_AFTER_7D: "return_after_7d",
  DIGEST_CLICKED: "digest_clicked",

  // === Monetização (Stripe quando ativar) ===
  PAYWALL_SHOWN: "paywall_shown",
  PAYWALL_DISMISSED: "paywall_dismissed",
  UPGRADE_CLICKED: "upgrade_clicked",
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  CHECKOUT_ABANDONED: "checkout_abandoned",
  SUBSCRIPTION_CANCELED: "subscription_canceled",

  // === LGPD ===
  DATA_EXPORTED: "data_exported",
  ACCOUNT_DELETED: "account_deleted",
};

// Identifica os funis principais pra dashboards PostHog. Cada array eh uma
// sequencia ordenada que o user idealmente percorre. PostHog calcula o
// dropoff entre cada par consecutivo.
export const FUNNELS = {
  ACTIVATION: [
    EVENTS.HOME_VIEWED,
    EVENTS.CV_PASTE_STARTED,
    EVENTS.DIAGNOSIS_STARTED,
    EVENTS.DIAGNOSIS_COMPLETED,
    EVENTS.DASHBOARD_VIEWED,
  ],
  FIRST_ACTION: [
    EVENTS.DASHBOARD_VIEWED,
    EVENTS.GAP_VIEWED,
    EVENTS.GAP_COMPLETED,
  ],
  CV_ADAPTATION: [
    EVENTS.GAP_COMPLETED,
    EVENTS.TAILOR_STARTED,
    EVENTS.TAILOR_COMPLETED,
    EVENTS.APPLICATION_SAVED,
  ],
  MONETIZATION: [
    EVENTS.PAYWALL_SHOWN,
    EVENTS.UPGRADE_CLICKED,
    EVENTS.CHECKOUT_STARTED,
    EVENTS.CHECKOUT_COMPLETED,
  ],
};

// Lista de events que devem ser enviados via server-side (rota /api/_track)
// em vez de direto do client. Motivo: dados sensiveis a fraude (monetizacao,
// LGPD) onde o cliente nao pode ser fonte canonica.
export const SERVER_SIDE_EVENTS = new Set([
  EVENTS.CHECKOUT_STARTED,
  EVENTS.CHECKOUT_COMPLETED,
  EVENTS.CHECKOUT_ABANDONED,
  EVENTS.SUBSCRIPTION_CANCELED,
  EVENTS.DATA_EXPORTED,
  EVENTS.ACCOUNT_DELETED,
]);
