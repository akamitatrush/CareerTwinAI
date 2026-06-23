"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@/components/PostHogProvider";
import { safeHref } from "@/lib/url-safe";

const STATUS_NEXT = {
  SAVED: ["APPLIED", "WITHDRAWN"],
  APPLIED: ["SCREENING", "REJECTED", "WITHDRAWN"],
  SCREENING: ["INTERVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["APPLIED", "REJECTED"],
  REJECTED: ["APPLIED"],
  WITHDRAWN: ["APPLIED"],
};

const STATUS_LABEL = {
  SAVED: "Salva",
  APPLIED: "Aplicada",
  SCREENING: "Triagem",
  INTERVIEW: "Entrevista",
  OFFER: "Oferta",
  REJECTED: "Recusada",
  WITHDRAWN: "Desistida",
};

// Microcopy específica por coluna — o que faz sentido ter ali quando ela está vazia
const COLUMN_EMPTY = {
  SAVED: "Vagas salvas aparecem aqui antes de você aplicar.",
  APPLIED: "Mova pra cá quando enviar a candidatura.",
  SCREENING: "Quando o recrutador responder, mova pra cá.",
  INTERVIEW: "Etapas técnicas, cultural fit, painel — tudo cai aqui.",
  OFFER: "Proposta na mão? Move pra cá. Boa sorte na negociação.",
  REJECTED: "Recusas acontecem. Use pra entender padrão, não pra punir.",
};

export default function KanbanClient({ initialItems, columns }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function changeStatus(id, status) {
    setBusyId(id);
    setError("");
    try {
      const r = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "patch_failed");
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
    } catch (e) {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("network") || msg.includes("failed to fetch")) {
        setError("Sem conexão pra atualizar agora. Verifica a internet e tenta de novo.");
      } else {
        setError("Não consegui mudar o status. Tenta de novo daqui a pouco.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id) {
    if (!confirm("Apagar essa candidatura? Não dá pra desfazer.")) return;
    setBusyId(id);
    setError("");
    try {
      const r = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete_failed");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError("Não consegui apagar essa candidatura agora. Tenta de novo em alguns segundos.");
    } finally {
      setBusyId(null);
    }
  }

  async function createNew(form) {
    const fd = new FormData(form);
    const body = {
      titulo: String(fd.get("titulo") || "").trim(),
      empresa: String(fd.get("empresa") || "").trim(),
      local: String(fd.get("local") || "").trim() || undefined,
      url: String(fd.get("url") || "").trim() || undefined,
      status: String(fd.get("status") || "SAVED"),
    };
    if (!body.titulo || !body.empresa) {
      setError("Preenche pelo menos o cargo e a empresa — o resto fica opcional.");
      return;
    }
    setError("");
    try {
      const r = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Não consegui criar a candidatura. Tenta de novo daqui a pouco.");
        return;
      }
      setItems((prev) => [data.item, ...prev]);
      setShowNew(false);
      form.reset();
      track("application_saved", {
        status: body.status,
        has_url: !!body.url,
        has_local: !!body.local,
        origin: "manual",
      });
    } catch (e) {
      setError("Falha de rede ao salvar. Verifica a conexão e tenta de novo.");
    }
  }

  const isEmpty = items.length === 0;

  return (
    <>
      {isEmpty && !showNew && (
        <div className="kanban-empty-hero">
          <div className="kanban-empty-hero-inner">
            <h2>Seu funil ainda está vazio.</h2>
            <p>
              Para começar, vá em <Link href="/meu-gemeo">Meu gêmeo → Vagas</Link> e
              clique em <b>+ Salvar candidatura</b> nas vagas que te interessarem —
              ou crie uma manualmente aqui mesmo.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <Link href="/meu-gemeo" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Ver vagas no meu gêmeo →
              </Link>
              <button className="btn btn-ghost" onClick={() => setShowNew(true)}>
                + Adicionar uma à mão
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {isEmpty
            ? "Cada coluna abaixo representa uma etapa do funil."
            : "Use o seletor em cada card para mover pela próxima etapa. As métricas no topo atualizam sozinhas."}
        </p>
        {!isEmpty && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + Nova candidatura
          </button>
        )}
      </div>

      {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}

      {showNew && (
        <form
          onSubmit={(e) => { e.preventDefault(); createNew(e.currentTarget); }}
          style={{ marginBottom: 20, padding: 16, border: "1px solid var(--border-strong)", borderRadius: 10, background: "var(--surface-2)" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input name="titulo" placeholder="Cargo (obrigatório)" className="ks-input" required />
            <input name="empresa" placeholder="Empresa (obrigatório)" className="ks-input" required />
            <input name="local" placeholder="Local (opcional)" className="ks-input" />
            <input name="url" placeholder="URL da vaga (opcional)" className="ks-input" type="url" />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select name="status" className="ks-input" defaultValue="SAVED" aria-label="Etapa inicial">
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">Adicionar ao funil</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowNew(false); setError(""); }}>Cancelar</button>
          </div>
        </form>
      )}

      <section className="kanban">
        {columns.map((col) => {
          const colItems = items.filter((i) => i.status === col.key);
          return (
            <div key={col.key} className="kanban-col">
              <div className="kanban-col-head">
                <span>{col.label}</span>
                <span className="kanban-col-count">{colItems.length}</span>
              </div>
              <div className="kanban-col-body">
                {colItems.length === 0 && (
                  <div className="kanban-empty">{COLUMN_EMPTY[col.key] || "Vazia por enquanto."}</div>
                )}
                {colItems.map((it) => (
                  <article key={it.id} className="kanban-card" style={{ opacity: busyId === it.id ? 0.5 : 1 }}>
                    <div className="kanban-card-t">{it.titulo}</div>
                    <div className="kanban-card-m">
                      {it.empresa}
                      {it.local && ` · ${it.local}`}
                    </div>
                    {it.source && <div className="kanban-card-src">{it.source}</div>}
                    {/* safeHref bloqueia javascript:/data: que poderia ter entrado
                        no DB antes do safeExternalUrl validator. */}
                    {safeHref(it.url) && (
                      <a href={safeHref(it.url)} target="_blank" rel="noopener noreferrer" className="kanban-card-link">
                        ver vaga ↗
                      </a>
                    )}
                    <div className="kanban-card-actions">
                      <select
                        value={it.status}
                        onChange={(e) => changeStatus(it.id, e.target.value)}
                        disabled={busyId === it.id}
                        aria-label="Mover para outra etapa"
                      >
                        <option value={it.status}>→ {STATUS_LABEL[it.status]}</option>
                        {(STATUS_NEXT[it.status] || []).map((s) => (
                          <option key={s} value={s}>→ {STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <button
                        className="kanban-x"
                        onClick={() => removeItem(it.id)}
                        disabled={busyId === it.id}
                        aria-label="Apagar candidatura"
                        title="Apagar"
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <style jsx>{`
        .kanban { display: grid; grid-template-columns: repeat(6, minmax(180px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 10px; }
        @media (max-width: 1100px) { .kanban { grid-template-columns: repeat(3, minmax(220px, 1fr)); } }
        @media (max-width: 700px) { .kanban { grid-template-columns: 1fr; } }
        .kanban-col { background: var(--surface-2); border-radius: 8px; padding: 10px; min-height: 200px; }
        .kanban-col-head { display: flex; justify-content: space-between; align-items: center; font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
        .kanban-col-count { background: var(--surface); padding: 2px 6px; border-radius: 10px; font-size: 10px; }
        .kanban-col-body { display: flex; flex-direction: column; gap: 8px; }
        .kanban-empty { font-size: 11px; color: var(--text-subtle); text-align: center; padding: 14px 8px; line-height: 1.5; font-style: italic; }
        .kanban-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px; font-size: 12px; transition: opacity .15s; }
        .kanban-card-t { font-weight: 600; font-size: 13px; line-height: 1.3; margin-bottom: 3px; }
        .kanban-card-m { color: var(--text-muted); font-size: 11px; margin-bottom: 4px; }
        .kanban-card-src { font-family: "JetBrains Mono", monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 4px; }
        .kanban-card-link { font-size: 11px; color: var(--accent); text-decoration: none; display: inline-block; margin-bottom: 6px; }
        .kanban-card-link:hover { text-decoration: underline; }
        .kanban-card-actions { display: flex; gap: 4px; margin-top: 6px; }
        .kanban-card-actions select { flex: 1; font-size: 11px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface-2); cursor: pointer; }
        .kanban-x { background: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; cursor: pointer; color: var(--text-subtle); font-size: 11px; }
        .kanban-x:hover { color: var(--alert); border-color: var(--alert); }
        .kanban-empty-hero { margin-bottom: 20px; padding: 22px; border: 1px dashed var(--border-strong); border-radius: 12px; background: var(--surface-2); }
        .kanban-empty-hero-inner h2 { margin: 0 0 8px; font-size: 20px; font-family: var(--font-display); font-weight: 700; }
        .kanban-empty-hero-inner p { margin: 0 0 14px; color: var(--text-muted); font-size: 14px; line-height: 1.55; max-width: 620px; }
        :global(.ks-input) { padding: 8px 10px; border: 1px solid var(--border-strong); border-radius: 6px; font-size: 13px; font-family: inherit; background: var(--surface); }
      `}</style>
    </>
  );
}
