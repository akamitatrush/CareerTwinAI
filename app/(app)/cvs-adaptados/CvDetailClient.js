"use client";

import { useEffect, useState } from "react";

// Modal de detalhe de um CV adaptado. Lazy-load: so chama /api/tailored-cvs/[id]
// quando o user clica "Ver completo →" (poupa banda no carregamento da pagina,
// que ja tem afterText pro preview do card). Toggle Adaptado/Original mostra
// beforeText (CV antes) vs afterText (saida do LLM com bullets reescritos).
//
// IDOR-safe pelo lado do servidor: o endpoint /api/tailored-cvs/[id] valida
// userId. Aqui no client a gente confia na resposta (404 = nao seu).
export default function CvDetailClient({ cvId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [view, setView] = useState("after"); // "before" | "after"
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Esc fecha modal — padrao a11y (WAI-ARIA APG dialog).
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function loadDetail() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/tailored-cvs/${cvId}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || "Falhou");
      setData(json.item);
    } catch (e) {
      setError(e?.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  function show() {
    setOpen(true);
    if (!data && !loading) loadDetail();
  }

  async function handleDelete() {
    // confirm() e sincrono — basta pra ser destrutivo sem virar UX horrivel.
    if (!confirm("Apagar esse CV adaptado? Não dá pra desfazer.")) return;
    setDeleting(true);
    setError("");
    try {
      const r = await fetch(`/api/tailored-cvs/${cvId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Falhou ao apagar");
      // Reload da pagina inteira pra re-puxar do server (lista atualizada).
      // Mais simples que prop-drill um callback de remocao no card.
      window.location.reload();
    } catch (e) {
      setError(e?.message || "Erro ao apagar");
      setDeleting(false);
    }
  }

  async function copyText() {
    if (!data?.afterText) return;
    try {
      await navigator.clipboard.writeText(data.afterText);
      alert("Copiado!");
    } catch {
      alert("Falhou ao copiar");
    }
  }

  return (
    <>
      {/* Refresh visual (Sam) — modal com glass + gradient cyan no copy. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tailor-modal-glass {
              box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-cyan-glow);
            }
            .tailor-modal-glass .ct-tailor-btn-copy {
              background: linear-gradient(140deg, var(--accent-cyan) 0%, var(--accent-cyan-deep) 100%);
              color: #08313F;
              border: 1px solid transparent;
              box-shadow: var(--shadow-md);
              transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
            }
            .tailor-modal-glass .ct-tailor-btn-copy:hover {
              transform: translateY(-1px);
              box-shadow: var(--shadow-lg), 0 0 0 3px var(--accent-cyan-glow);
              filter: brightness(1.04);
            }
            .tailor-modal-glass .ct-tailor-btn-copy:focus-visible {
              outline: none;
              box-shadow: var(--shadow-md), 0 0 0 3px var(--accent-cyan-glow);
            }
            @media (prefers-reduced-motion: reduce) {
              .tailor-modal-glass .ct-tailor-btn-copy,
              .tailor-modal-glass .ct-tailor-btn-copy:hover {
                transition: none;
                transform: none;
              }
            }
          `,
        }}
      />
      <button
        onClick={show}
        className="ct-tailor-btn-view"
        type="button"
        aria-haspopup="dialog"
      >
        Ver completo →
      </button>

      {open && (
        <div
          className="ct-tailor-modal-bg"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="ct-tailor-modal app-glass tailor-modal-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ct-tailor-modal-title"
          >
            <div className="ct-tailor-modal-head">
              <div>
                <h2 id="ct-tailor-modal-title">CV adaptado</h2>
                {data && (
                  <p className="ct-tailor-modal-sub">
                    {data.vagaTitulo}
                    {data.vagaEmpresa ? ` · ${data.vagaEmpresa}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ct-tailor-modal-close"
                aria-label="Fechar"
                type="button"
              >
                ✕
              </button>
            </div>

            {loading && (
              <p className="ct-tailor-modal-loading">Carregando…</p>
            )}
            {error && (
              <p className="ct-tailor-modal-error" role="alert">
                {error}
              </p>
            )}

            {data && (
              <>
                <div className="ct-tailor-modal-tabs" role="tablist">
                  <button
                    onClick={() => setView("after")}
                    className={view === "after" ? "active" : ""}
                    role="tab"
                    aria-selected={view === "after"}
                    type="button"
                  >
                    Adaptado
                  </button>
                  <button
                    onClick={() => setView("before")}
                    className={view === "before" ? "active" : ""}
                    role="tab"
                    aria-selected={view === "before"}
                    type="button"
                  >
                    Original
                  </button>
                </div>

                <div className="ct-tailor-modal-content">
                  {view === "after" && (
                    <pre className="ct-tailor-text">{data.afterText}</pre>
                  )}
                  {view === "before" && (
                    <pre className="ct-tailor-text">{data.beforeText}</pre>
                  )}
                </div>

                <div className="ct-tailor-modal-actions">
                  <button
                    onClick={copyText}
                    className="ct-tailor-btn-copy"
                    type="button"
                  >
                    Copiar adaptado
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="ct-tailor-btn-delete"
                    type="button"
                  >
                    {deleting ? "Apagando…" : "Apagar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
