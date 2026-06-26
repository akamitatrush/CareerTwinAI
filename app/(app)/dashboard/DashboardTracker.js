"use client";

import { useEffect } from "react";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

// Client component que dispara DASHBOARD_VIEWED uma vez ao montar.
// Necessario porque /dashboard e server component — track() so roda no client.
// Recebe metricas pre-calculadas via props pra evitar fetch redundante.
//
// Props:
//  - hasSnapshot: bool — se o user ja tem ScoreSnapshot.
//  - score: number — overall do snapshot mais recente (0 se sem).
//  - gapsCount: number — total de gaps no snapshot atual.
//
// Render: nada (return null). E so um "hook" visual que faz analytics.
export default function DashboardTracker({ hasSnapshot, score, gapsCount }) {
  useEffect(() => {
    track(EVENTS.DASHBOARD_VIEWED, {
      has_snapshot: !!hasSnapshot,
      score: Number(score) || 0,
      gaps_count: Number(gapsCount) || 0,
    });
  }, [hasSnapshot, score, gapsCount]);
  return null;
}
