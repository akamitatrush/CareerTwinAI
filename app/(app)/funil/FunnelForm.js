"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Form de auto-reporte de numeros semanais. Pre-popula com a entry da semana
// corrente (se existe) — assim editar = upsert (mesmo endpoint).
//
// Validacao no client e leve (numeros >= 0, hierarquia coerente). O servidor
// faz a validacao definitiva via Zod strict — defense in depth.

const INITIAL = {
  applications: 0,
  callbacks: 0,
  hmConversations: 0,
  finals: 0,
  offers: 0,
  notes: "",
};

function asInitial(entry) {
  if (!entry) return { ...INITIAL };
  return {
    applications: Number(entry.applications) || 0,
    callbacks: Number(entry.callbacks) || 0,
    hmConversations: Number(entry.hmConversations) || 0,
    finals: Number(entry.finals) || 0,
    offers: Number(entry.offers) || 0,
    notes: entry.notes || "",
  };
}

export default function FunnelForm({ initial = null, weekLabel = "" }) {
  const router = useRouter();
  const [form, setForm] = useState(() => asInitial(initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateNumber(field, raw) {
    // Coerce pra int >= 0. String vazia vira 0 (UX: input vazio = zero).
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    setForm((f) => ({ ...f, [field]: n }));
  }

  function updateText(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validacao basica no client antes de gastar round-trip.
    if (form.callbacks > form.applications) {
      setError("Callbacks nao pode ser maior que applications.");
      return;
    }
    if (form.hmConversations > form.callbacks) {
      setError("Conversas com HM nao podem ser maior que callbacks.");
      return;
    }
    if (form.finals > form.hmConversations) {
      setError("Finais nao podem ser maior que conversas com HM.");
      return;
    }
    if (form.offers > form.finals) {
      setError("Offers nao podem ser maior que finais.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        applications: form.applications,
        callbacks: form.callbacks,
        hmConversations: form.hmConversations,
        finals: form.finals,
        offers: form.offers,
        // notes so vai se nao for vazio — Zod aceita optional.
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const r = await fetch("/api/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json?.error || "Falhou ao salvar.");
        setSubmitting(false);
        return;
      }
      setSuccess("Numeros salvos. Atualizando analise...");
      // refresh re-roda o server component da pagina e pega a nova analise.
      router.refresh();
      // Limpa mensagem de sucesso depois de 2.5s.
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.message || "Erro de rede. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Registrar numeros do funil desta semana"
      className="app-glass"
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 22,
        marginTop: 8,
      }}
    >
      <style>{`
        .ct-funnel-input:focus {
          outline: none;
          border-color: var(--accent-cyan) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-cyan) 22%, transparent), 0 0 18px -4px var(--accent-cyan-glow);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-.2px",
            }}
          >
            Numeros desta semana
          </h2>
          {weekLabel && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--text-muted)",
                letterSpacing: ".06em",
              }}
            >
              Semana de {weekLabel} - {initial ? "editando" : "novo registro"}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 14,
        }}
      >
        <NumberField
          label="Aplicacoes"
          hint="vagas enviadas"
          value={form.applications}
          onChange={(v) => updateNumber("applications", v)}
          max={500}
        />
        <NumberField
          label="Callbacks"
          hint="resposta recrutador"
          value={form.callbacks}
          onChange={(v) => updateNumber("callbacks", v)}
          max={200}
        />
        <NumberField
          label="HMs"
          hint="conversa c/ hiring mgr"
          value={form.hmConversations}
          onChange={(v) => updateNumber("hmConversations", v)}
          max={100}
        />
        <NumberField
          label="Finais"
          hint="entrevista final"
          value={form.finals}
          onChange={(v) => updateNumber("finals", v)}
          max={50}
        />
        <NumberField
          label="Offers"
          hint="propostas recebidas"
          value={form.offers}
          onChange={(v) => updateNumber("offers", v)}
          max={20}
        />
      </div>

      <label
        style={{
          display: "block",
          marginTop: 16,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: ".05em",
          textTransform: "uppercase",
        }}
      >
        Observacoes (opcional, max 500 chars)
        <textarea
          value={form.notes}
          onChange={(e) => updateText("notes", e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ex: tentei mudar abordagem de email, foquei em empresas series B-C..."
          className="ct-funnel-input"
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-2)",
            fontSize: 14,
            fontFamily: "inherit",
            color: "var(--text)",
            resize: "vertical",
            boxSizing: "border-box",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        />
      </label>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(220,80,80,.08)",
            border: "1px solid rgba(220,80,80,.25)",
            borderRadius: "var(--radius-sm)",
            color: "#B33",
            fontSize: 13,
          }}
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(80,200,150,.10)",
            border: "1px solid rgba(80,200,150,.3)",
            borderRadius: "var(--radius-sm)",
            color: "#0A7A55",
            fontSize: 13,
          }}
        >
          {success}
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 22px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: submitting
              ? "var(--text)"
              : "linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-cyan-deep, var(--accent-cyan)) 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.65 : 1,
            boxShadow: submitting ? "none" : "0 4px 16px -6px var(--accent-cyan-glow)",
          }}
        >
          {submitting ? "Salvando..." : initial ? "Atualizar numeros" : "Salvar numeros"}
        </button>
      </div>
    </form>
  );
}

function NumberField({ label, hint, value, onChange, max }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      {hint && (
        <span
          style={{
            display: "block",
            fontSize: 10,
            color: "var(--text-subtle)",
            marginBottom: 4,
          }}
        >
          {hint}
        </span>
      )}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ct-funnel-input"
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-2)",
          color: "var(--text)",
          fontFamily: "var(--font-display)",
          textAlign: "right",
          boxSizing: "border-box",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
        }}
      />
    </label>
  );
}
