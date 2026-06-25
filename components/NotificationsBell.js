"use client";

// Sininho de notificacoes in-app. Fetch /api/notifications no mount, abre
// drawer lateral quando clicado. Mark-as-read (individual e em lote) chama
// endpoints dedicados. Falha silenciosa de rede (sem toast) — o estado
// reconvergira no proximo mount/refresh.
//
// Recebe `compact` pra render menor (mobile header) onde o spacing fica
// apertado entre brand e avatar.
//
// Achievement toast: quando uma notificacao kind=ACHIEVEMENT_UNLOCKED ainda
// nao lida e nao foi mostrada como toast antes (controle via localStorage),
// dispara o AchievementToast pra micro-celebracao com confetti CSS.

import { useEffect, useState, useCallback } from "react";
import AchievementToast from "@/components/AchievementToast";

const EMPTY = { items: [], unreadCount: 0 };

// Chave do localStorage pra trackear ids ja exibidos como toast. Sem isso,
// abrir o sino refresh-aria o achievement em cada mount.
const TOAST_SEEN_KEY = "ct_achievement_toasts_seen";
const TOAST_SEEN_MAX = 100; // limite simples pra evitar storage growth

function loadToastSeen() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage?.getItem(TOAST_SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.slice(-TOAST_SEEN_MAX));
  } catch {
    return new Set();
  }
}

function saveToastSeen(set) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const arr = Array.from(set).slice(-TOAST_SEEN_MAX);
    window.localStorage.setItem(TOAST_SEEN_KEY, JSON.stringify(arr));
  } catch {
    // Sem-op: localStorage indisponivel (private mode / quota) — toast pode
    // aparecer 2x; aceitavel UX.
  }
}

function BellIcon({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  );
}

export default function NotificationsBell({ compact = false }) {
  const [notifs, setNotifs] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Fila de toasts de achievements a exibir. Cada item: { id, title, desc, icon, points }.
  // Renderiza apenas o primeiro (head); o resto espera o onDismiss.
  const [toastQueue, setToastQueue] = useState([]);

  // Carrega ao montar. Reusamos a mesma chamada quando o drawer abre pra
  // refrescar o estado (eventos novos sem reload da pagina). Falhas de rede
  // sao silenciosas — a UI degradada e o estado vazio, nao mensagem agressiva.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data?.items)) {
        setNotifs({
          items: data.items,
          unreadCount: Number(data.unreadCount) || 0,
        });

        // Detecta novos ACHIEVEMENT_UNLOCKED unread + nao mostrados ainda
        // como toast. Marca como "seen" no localStorage logo ao enfileirar
        // pra que segundo fetch (ex: drawer reabriu) nao re-dispare.
        const seen = loadToastSeen();
        const newToasts = [];
        for (const n of data.items) {
          if (n.kind !== "ACHIEVEMENT_UNLOCKED") continue;
          if (n.readAt) continue; // ja lida (user viu)
          if (seen.has(n.id)) continue;
          // Extrai meta do payload da notify (ver lib/notifications.js
          // achievementUnlocked template).
          const meta = n.meta && typeof n.meta === "object" ? n.meta : {};
          newToasts.push({
            id: n.id,
            title: typeof n.title === "string" ? n.title.replace(/^\S+\s+/, "") : "Conquista",
            desc: typeof n.body === "string" ? n.body : "",
            icon: typeof meta.icon === "string" ? meta.icon : "🏆",
            points: Number.isFinite(meta.points) ? meta.points : 0,
          });
          seen.add(n.id);
        }
        if (newToasts.length > 0) {
          saveToastSeen(seen);
          setToastQueue((q) => [...q, ...newToasts]);
        }
      }
    } catch {
      // Sem-op: estado anterior preservado, sem mensagem ao usuario.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Dismiss do toast head — desempilha pra exibir o proximo, se houver.
  const dismissToast = useCallback(() => {
    setToastQueue((q) => (q.length > 0 ? q.slice(1) : q));
  }, []);

  // Quando drawer abre, refresca pra mostrar mudancas recentes.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Esc fecha o drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function markAllRead() {
    // Otimista: zera badge no cliente; servidor confirma. Falha => proximo
    // load() reconcilia.
    setNotifs((prev) => ({
      ...prev,
      unreadCount: 0,
      items: prev.items.map((i) =>
        i.readAt ? i : { ...i, readAt: new Date().toISOString() }
      ),
    }));
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      // Sem-op.
    }
  }

  async function markOneRead(id) {
    setNotifs((prev) => ({
      ...prev,
      unreadCount: Math.max(0, prev.unreadCount - 1),
      items: prev.items.map((i) =>
        i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i
      ),
    }));
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      // Sem-op.
    }
  }

  const unread = notifs.unreadCount;
  const btnCls = "appshell-notif-btn" + (compact ? " compact" : "");
  // Apenas o head da fila eh renderizado por vez (toast nao empilha visualmente
  // — espera onDismiss pra desempilhar).
  const currentToast = toastQueue[0] || null;

  return (
    <>
      {currentToast && (
        <AchievementToast
          key={currentToast.id}
          achievement={currentToast}
          onDismiss={dismissToast}
        />
      )}
      <button
        type="button"
        className={btnCls}
        aria-label={
          unread > 0
            ? `Notificações (${unread} não lidas)`
            : "Notificações"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={
          // Refresh visual: quando ha unread, icone "respira" com glow cyan sutil.
          unread > 0
            ? { filter: "drop-shadow(0 0 6px var(--accent-cyan-glow))" }
            : undefined
        }
      >
        <BellIcon size={compact ? 17 : 19} />
        {unread > 0 && (
          <span
            className="appshell-notif-badge"
            aria-hidden="true"
            style={{
              // Refresh visual: badge ganha halo cyan-glow (em cima do background
              // attention vermelho original). Reforca "novidade" sem mudar a cor.
              boxShadow: "0 0 12px var(--accent-cyan-glow)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="appshell-notif-drawer-bg"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <aside
            className="appshell-notif-drawer app-glass"
            role="dialog"
            aria-label="Notificações"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              // Refresh visual: drawer ganha glassmorphism + borda cyan-glow.
              // Background opaco do CSS original substituido por glass blur;
              // overflow:auto + animation do CSS preservados via composicao de classe.
              background: "var(--app-glass-bg)",
              backdropFilter: "blur(var(--app-glass-blur))",
              WebkitBackdropFilter: "blur(var(--app-glass-blur))",
              borderLeft: "1px solid var(--accent-cyan-glow)",
            }}
          >
            <div className="appshell-notif-drawer-head">
              <h3>Notificações</h3>
              <div className="appshell-notif-drawer-actions">
                {notifs.items.some((i) => !i.readAt) && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="appshell-notif-mark-all"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  type="button"
                  className="appshell-notif-close"
                  aria-label="Fechar"
                  onClick={() => setOpen(false)}
                >
                  &times;
                </button>
              </div>
            </div>

            {loading && notifs.items.length === 0 ? (
              <p className="appshell-notif-empty">Carregando...</p>
            ) : notifs.items.length === 0 ? (
              <p className="appshell-notif-empty">
                Sem notificações por enquanto.
              </p>
            ) : (
              <ul className="appshell-notif-list">
                {notifs.items.map((n) => (
                  <li
                    key={n.id}
                    className={
                      "appshell-notif-item" + (n.readAt ? " read" : "")
                    }
                    onClick={() => {
                      if (!n.readAt) markOneRead(n.id);
                    }}
                    style={
                      // Refresh visual: items nao lidos ganham border-left cyan,
                      // sinalizando "novo" sem depender so do background primary-soft.
                      !n.readAt
                        ? { borderLeft: "2px solid var(--accent-cyan)" }
                        : undefined
                    }
                  >
                    <div className="appshell-notif-title">{n.title}</div>
                    {n.body && (
                      <div className="appshell-notif-body">{n.body}</div>
                    )}
                    <div className="appshell-notif-time">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </div>
                    {n.link && (
                      <a
                        href={n.link}
                        className="appshell-notif-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver detalhes
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
