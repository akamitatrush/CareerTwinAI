"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeHref } from "@/lib/url-safe";

// Card de evidencia + delete. Client component so pelo botao "Apagar" (precisa
// de fetch). O card em si poderia ser server, mas misturar ficaria pior. Custo
// e baixo: poucos elementos, sem state pesado.
export default function EvidenceItem({ evidence, kindLabel }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  async function handleDelete() {
    if (!confirm("Apagar essa evidência? Não dá pra desfazer.")) return;
    setDeleting(true);
    setErr("");
    try {
      const r = await fetch(`/api/evidence/${evidence.id}`, { method: "DELETE" });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setErr(json?.error || "Falhou ao apagar.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e?.message || "Erro de rede.");
      setDeleting(false);
    }
  }

  return (
    <article className="ct-evidence-card">
      <div className="ct-evidence-head">
        <div>
          <span className="ct-evidence-kind">{kindLabel}</span>
          {evidence.whenLabel && (
            <span className="ct-evidence-when">{evidence.whenLabel}</span>
          )}
        </div>
        {evidence.metricLabel && evidence.metricValue && (
          <div className="ct-evidence-metric">
            <span className="ct-evidence-metric-value">{evidence.metricValue}</span>
            <span className="ct-evidence-metric-label">{evidence.metricLabel}</span>
          </div>
        )}
      </div>

      <h3 className="ct-evidence-title">{evidence.title}</h3>
      <p className="ct-evidence-desc">{evidence.description}</p>

      {Array.isArray(evidence.skills) && evidence.skills.length > 0 && (
        <div className="ct-evidence-skills">
          {evidence.skills.map((s, i) => (
            <span key={i} className="ct-skill-chip">{s}</span>
          ))}
        </div>
      )}

      <div className="ct-evidence-foot">
        {/* safeHref: defesa-em-profundidade contra javascript:/data:/vbscript:/file:
            URLs que o validator deveria ter bloqueado mas que poderiam existir em
            dados antigos do DB. Retorna null se URL nao for http/https. */}
        {safeHref(evidence.url) && (
          // noopener+noreferrer: protege contra tabnabbing + nao envia referer
          // pra URL externa (privacidade — o destino nao sabe que veio do app).
          <a
            href={safeHref(evidence.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="ct-evidence-link"
          >
            Ver projeto ↗
          </a>
        )}
        <button
          type="button"
          className="ct-evidence-delete"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Apagar evidência: ${evidence.title}`}
        >
          {deleting ? "Apagando…" : "Apagar"}
        </button>
      </div>

      {err && <p className="ct-evidence-card-error" role="alert">{err}</p>}
    </article>
  );
}
