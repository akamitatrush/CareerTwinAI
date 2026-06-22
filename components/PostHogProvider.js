"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

let inited = false;

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

export function track(event, props) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props || {});
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
  }, []);
  return children;
}
