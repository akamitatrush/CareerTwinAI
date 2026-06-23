"use client";

// Sininho de notificacoes in-app. Fetch /api/notifications no mount, abre
// drawer lateral quando clicado. Mark-as-read (individual e em lote) chama
// endpoints dedicados. Falha silenciosa de rede (sem toast) — o estado
// reconvergira no proximo mount/refresh.
//
// Recebe `compact` pra render menor (mobile header) onde o spacing fica
// apertado entre brand e avatar.

import { useEffect, useState, useCallback } from "react";

const EMPTY = { items: [], unreadCount: 0 };

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

  return (
    <>
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
      >
        <BellIcon size={compact ? 17 : 19} />
        {unread > 0 && (
          <span className="appshell-notif-badge" aria-hidden="true">
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
            className="appshell-notif-drawer"
            role="dialog"
            aria-label="Notificações"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
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
