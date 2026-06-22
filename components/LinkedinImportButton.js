"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function LinkedinImportButton({ onImport, disabled }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (text.trim().length < 120) {
      setErr("Cole pelo menos 120 caracteres do seu perfil (Sobre + Experiência + Skills).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/linkedin/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha ao importar.");
      onImport?.({ cv: data.cv, perfil: data.perfil });
      setOpen(false);
      setText("");
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
        Importar do LinkedIn
      </button>
      {open && (
        <Modal
          title="Importar do LinkedIn"
          subtitle="Cole as seções Sobre + Experiência + Formação + Skills do seu perfil."
          onClose={() => !busy && setOpen(false)}
          wide
        >
          <ol style={{ fontSize: 13, color: "#4C5048", marginTop: 0, paddingLeft: 18, lineHeight: 1.55 }}>
            <li>Abra seu perfil em <a href="https://linkedin.com/in/me" target="_blank" rel="noopener noreferrer">linkedin.com/in/me</a></li>
            <li>Selecione e copie tudo de <b>Sobre</b> + <b>Experiência</b> + <b>Formação</b> + <b>Skills</b></li>
            <li>Cole abaixo. A IA estrutura e devolve um currículo pronto pro diagnóstico.</li>
          </ol>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o conteúdo do seu LinkedIn…"
            rows={12}
            style={{ width: "100%", padding: 12, fontSize: 13, border: "1px solid #D4D6CA", borderRadius: 8, fontFamily: "inherit", resize: "vertical", marginTop: 8 }}
            disabled={busy}
          />
          {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy} type="button">
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={busy} type="button">
              {busy ? "Processando…" : "Importar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
