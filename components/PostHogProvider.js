"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

let inited = false;
let identified = false;

export function initPostHog() {
  const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!KEY || inited || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: "localStorage",
    disable_session_recording: true,
    respect_dnt: true,
    sanitize_properties: (properties) => {
      const stripped = { ...properties };
      delete stripped.$current_url_search;
      return stripped;
    },
  });
  inited = true;
}

// Wrapper de captura. Use sempre via constantes EVENTS de lib/analytics/events.
// Silencioso quando PostHog nao esta configurado (NEXT_PUBLIC_POSTHOG_KEY
// ausente em dev local) ou quando estamos no SSR.
export function track(event, props) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props || {});
  } catch {}
}

// Identify + super properties. Chamada uma vez por session quando o user loga.
// userId e o cuid do Prisma (nao email). Email passa pra PostHog identify
// (armazenado no SaaS, coberto pelo DPA do PostHog). Nao colocamos email em
// capture.properties pra evitar PII redundante em cada event.
export function identifyUser(user) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (!user?.id) return;
  if (identified) return;
  try {
    posthog.identify(user.id, {
      email: user.email || undefined,
      name: user.name || undefined,
    });
    // Super properties — anexadas em TODOS os events subsequentes na session.
    // Permitem segmentar funis por plano/owner/idade-da-conta sem trackear PII.
    posthog.register({
      plan: user.plan || "free",
      is_owner: !!user.isOwner,
      signed_up_at: user.createdAt || null,
    });
    identified = true;
  } catch {}
}

// Reset ao logout (limpa anonymous ID e super properties).
export function resetIdentity() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.reset();
    identified = false;
  } catch {}
}

export default function PostHogProvider({ children }) {
  useEffect(() => {
    initPostHog();
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("utm_source") === "digest") {
        track("digest_clicked", {
          medium: params.get("utm_medium") || "email",
          campaign: params.get("utm_campaign") || "weekly",
          landing: window.location.pathname,
        });
      }
    } catch {}

    // Identify-on-load: se ha sessao ativa, pega userId e roda identify.
    // Endpoint publico do NextAuth (/api/auth/session) — devolve so o que o
    // user ja sabe (id/email/name). Falha silenciosa nao quebra a app.
    //
    // Tambem dispara LOGIN_COMPLETED na primeira vez que vemos o user nessa
    // sessao do browser (key ct_seen em localStorage). SIGNUP_COMPLETED se
    // a session.user.createdAt e recente (< 5min) — heuristica simples.
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!s?.user?.id) return;
        identifyUser({
          id: s.user.id,
          email: s.user.email,
          name: s.user.name,
          plan: s.user.plan,
          isOwner: s.user.isOwner,
          createdAt: s.user.createdAt,
        });
        // Primeira visita nessa session (mas user pode ja existir no banco)
        try {
          const lastSeenKey = `ct_login_${s.user.id}`;
          const lastSeen = localStorage.getItem(lastSeenKey);
          if (!lastSeen) {
            // Conta nova OU sessao nova no browser. Pra distinguir, comparamos
            // createdAt (se exposto) com agora. < 5min => signup; senao => login.
            const created = s.user.createdAt ? new Date(s.user.createdAt) : null;
            const isFresh =
              created && Date.now() - created.getTime() < 5 * 60 * 1000;
            if (isFresh) {
              track("signup_completed", {});
            } else {
              track("login_completed", {});
            }
            localStorage.setItem(lastSeenKey, String(Date.now()));
          }
        } catch {}
      })
      .catch(() => {});
  }, []);
  return children;
}
