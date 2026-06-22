"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function PortfolioImportButton({ onImport, disabled }) {
  const [open, setOpen] = useState(false);
  const [github, setGithub] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  async function submit() {
    setErr("");
    if (!github.trim() && !url.trim()) {
      setErr("Informe seu usuário do GitHub ou a URL do seu portfólio.");
      return;
    }
    setBusy(true);
    try {
      const body = {};
      if (github.trim()) body.github = github.trim();
      if (url.trim()) body.url = url.trim();
      const r = await fetch("/api/portfolio/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha ao importar.");
      setResult(data.portfolio);
      onImport?.(data.portfolio);
    } catch (e) {
      setErr(e.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
        disabled={disabled}
        type="button"
      >
        Adicionar portfólio
      </button>
      {open && (
        <Modal
          title="Adicionar portfólio"
          subtitle="GitHub público (sem login) e/ou um site pessoal."
          onClose={() => !busy && setOpen(false)}
          wide
        >
          {!result ? (
            <>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, marginTop: 4 }}>
                Usuário GitHub
              </label>
              <input
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="ex.: shasher"
                style={{ width: "100%", padding: 10, fontSize: 14, border: "1px solid var(--border-strong)", borderRadius: 6, fontFamily: "inherit", marginBottom: 10 }}
                disabled={busy}
              />
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                URL do portfólio (opcional)
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://seu-site.com"
                type="url"
                style={{ width: "100%", padding: 10, fontSize: 14, border: "1px solid var(--border-strong)", borderRadius: 6, fontFamily: "inherit" }}
                disabled={busy}
              />
              {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy} type="button">
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={submit} disabled={busy} type="button">
                  {busy ? "Analisando…" : "Analisar"}
                </button>
              </div>
            </>
          ) : (
            <PortfolioPreview portfolio={result} onClose={() => { setOpen(false); setResult(null); }} />
          )}
        </Modal>
      )}
    </>
  );
}

function PortfolioPreview({ portfolio, onClose }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5, marginTop: 0 }}>{portfolio.resumo}</p>
      {portfolio.stack?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Stack</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {portfolio.stack.map((s) => (
              <span key={s} style={{ fontSize: 11, padding: "3px 8px", background: "var(--surface-2)", borderRadius: 12, fontFamily: "JetBrains Mono, monospace" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {portfolio.projetos?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Projetos</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {portfolio.projetos.map((p, i) => (
              <li key={i} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
                      {p.nome} ↗
                    </a>
                  ) : (
                    p.nome
                  )}
                </div>
                {p.descricao && <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{p.descricao}</div>}
                {p.destaque && <div style={{ fontSize: 12, color: "var(--alert)", marginTop: 4, fontStyle: "italic" }}>{p.destaque}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button className="btn btn-primary" onClick={onClose} type="button">
          Fechar
        </button>
      </div>
    </div>
  );
}
