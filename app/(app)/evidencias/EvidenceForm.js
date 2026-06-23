"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Form inline (vs modal): a pagina /evidencias e dedicada e existe pra esse
// fluxo. Modal so faria sentido se a feature fosse chamada de outra tela.
// Inline tambem e mais descobrivel pro user de primeira vez (form ja aberto).
//
// Toggle "colapsado/aberto" mantem visual limpo quando user ja tem N evidencias
// listadas e quer so consultar — o form fica como CTA discreto no topo.

const KIND_OPTIONS = [
  { value: "PROJECT", label: "Projeto" },
  { value: "CASE", label: "Case" },
  { value: "PUBLICATION", label: "Publicação" },
  { value: "CERTIFICATION", label: "Certificação" },
  { value: "AWARD", label: "Prêmio" },
  { value: "CONTRIBUTION", label: "Contribuição (open-source, comunidade)" },
];

const INITIAL = {
  kind: "PROJECT",
  title: "",
  description: "",
  skillsInput: "",
  metricLabel: "",
  metricValue: "",
  url: "",
  whenLabel: "",
};

export default function EvidenceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    // Skills no form sao livres separadas por virgula. Normalizamos pra array
    // limpa (sem duplicatas, sem vazias, max 10) antes de mandar pro server.
    // Server tambem valida — defense in depth.
    const skills = Array.from(
      new Set(
        form.skillsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 10);

    const payload = {
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim(),
      skills,
      // Strings vazias viram null no servidor (omitimos do payload pra deixar
      // o Zod fazer .nullish() e o handler converter "" -> null).
      ...(form.metricLabel.trim() ? { metricLabel: form.metricLabel.trim() } : {}),
      ...(form.metricValue.trim() ? { metricValue: form.metricValue.trim() } : {}),
      ...(form.url.trim() ? { url: form.url.trim() } : {}),
      ...(form.whenLabel.trim() ? { whenLabel: form.whenLabel.trim() } : {}),
    };

    try {
      const r = await fetch("/api/evidence", {
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
      setForm(INITIAL);
      setOpen(false);
      // refresh re-roda o server component da pagina e pega a evidence nova.
      router.refresh();
    } catch (e) {
      setError(e?.message || "Erro de rede.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="ct-evidence-toggle">
        <button
          type="button"
          className="ct-evidence-add-btn"
          onClick={() => setOpen(true)}
          aria-expanded="false"
        >
          + Adicionar nova evidência
        </button>
      </div>
    );
  }

  return (
    <form className="ct-evidence-form" onSubmit={submit} aria-label="Adicionar evidência">
      <div className="ct-evidence-form-head">
        <h2>Nova evidência</h2>
        <button
          type="button"
          className="ct-evidence-form-close"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          aria-label="Fechar formulário"
        >
          ✕
        </button>
      </div>

      <div className="ct-evidence-form-grid">
        <label className="ct-evidence-field">
          <span>Tipo</span>
          <select
            value={form.kind}
            onChange={(e) => update("kind", e.target.value)}
            required
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="ct-evidence-field">
          <span>Período</span>
          <input
            type="text"
            value={form.whenLabel}
            onChange={(e) => update("whenLabel", e.target.value)}
            placeholder="Ex: Q1 2024, Jan-Mar 2024"
            maxLength={80}
          />
        </label>

        <label className="ct-evidence-field ct-evidence-field-full">
          <span>Título *</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder='Ex: "Migração de monolito Rails pra microsserviços Go"'
            required
            minLength={3}
            maxLength={200}
          />
        </label>

        <label className="ct-evidence-field ct-evidence-field-full">
          <span>Descrição * <em>(o quê, como, qual impacto)</em></span>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Contexto: time de 4 devs, app monolitico Rails com 800k LOC e deploys de 45min. Eu: liderei a quebra em 3 servicos Go, propus a arquitetura, escrevi PoC e fiz pair com o time. Resultado: deploys caíram pra 6min, p95 da API caiu 40%, time ganhou autonomia pra deployar em paralelo."
            required
            minLength={20}
            maxLength={5000}
            rows={6}
          />
        </label>

        <label className="ct-evidence-field ct-evidence-field-full">
          <span>Skills demonstradas <em>(separadas por vírgula, até 10)</em></span>
          <input
            type="text"
            value={form.skillsInput}
            onChange={(e) => update("skillsInput", e.target.value)}
            placeholder="Ex: Go, microsserviços, liderança técnica, arquitetura"
            maxLength={400}
          />
        </label>

        <label className="ct-evidence-field">
          <span>Métrica - rótulo</span>
          <input
            type="text"
            value={form.metricLabel}
            onChange={(e) => update("metricLabel", e.target.value)}
            placeholder="Ex: Tempo de deploy"
            maxLength={80}
          />
        </label>

        <label className="ct-evidence-field">
          <span>Métrica - valor</span>
          <input
            type="text"
            value={form.metricValue}
            onChange={(e) => update("metricValue", e.target.value)}
            placeholder="Ex: -87%"
            maxLength={40}
          />
        </label>

        <label className="ct-evidence-field ct-evidence-field-full">
          <span>Link (opcional)</span>
          <input
            type="url"
            value={form.url}
            onChange={(e) => update("url", e.target.value)}
            placeholder="https://github.com/seu-user/projeto ou https://blog.empresa.com/post"
            maxLength={500}
          />
          <small className="ct-evidence-hint">
            Atenção à privacidade: links externos podem expor seu nome e dados pessoais. Use apenas URLs públicas que você quer mesmo compartilhar.
          </small>
        </label>
      </div>

      {error && (
        <p className="ct-evidence-form-error" role="alert">{error}</p>
      )}

      <div className="ct-evidence-form-actions">
        <button
          type="button"
          className="ct-evidence-btn-secondary"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="ct-evidence-btn-primary"
          disabled={submitting}
        >
          {submitting ? "Salvando…" : "Salvar evidência"}
        </button>
      </div>
    </form>
  );
}
