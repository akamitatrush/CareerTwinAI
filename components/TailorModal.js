import { useState, useEffect } from "react";
import Modal from "./Modal";

export default function TailorModal({ role, cv, vaga, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/tailor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role, cv, vaga }),
        });
        const d = await r.json();
        if (!active) return;
        if (!r.ok) throw new Error(d.error || "Falha ao adaptar.");
        setData(d);
      } catch (e) {
        if (active) setErr(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      title="Adaptar currículo para a vaga"
      subtitle={`${vaga.titulo} · ${vaga.empresa}`}
      onClose={onClose}
      wide
    >
      {loading && <div className="iv-loading">Adaptando seu currículo para esta vaga…</div>}
      {err && <div className="err">{err}</div>}

      {data && (
        <>
          <div className="tl-block">
            <span className="iv-collbl">Resumo adaptado</span>
            <p className="tl-resumo">{data.resumo_adaptado}</p>
          </div>

          <div className="tl-block">
            <span className="iv-collbl">Bullets sugeridos</span>
            <p className="tl-legend">
              <span className="tl-dot reorg" /> reorganização do que você já tem
              <span className="tl-dot nova" /> afirmação nova — confirme se é verdade
            </p>
            <div className="tl-bullets">
              {(data.bullets || []).map((b, i) => (
                <div className={"tl-bullet " + (b.tipo === "nova" ? "nova" : "reorg")} key={i}>
                  <p className="tl-text">{b.texto}</p>
                  {b.base && <p className="tl-base">{b.tipo === "nova" ? "Confirme: " : "Base: "}{b.base}</p>}
                </div>
              ))}
            </div>
          </div>

          {data.observacao && <p className="tl-obs">{data.observacao}</p>}
          <div className="tl-auth">Princípio de autenticidade: a IA reorganiza o que é seu. Tudo marcado como “nova” precisa ser verdadeiro antes de você usar.</div>
        </>
      )}
    </Modal>
  );
}
