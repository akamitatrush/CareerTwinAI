/**
 * Ato 2 (lado direito) — "O que o mercado pede mais".
 *
 * Top N habilidades mais frequentes nas vagas reais analisadas, com barra
 * de frequencia e marcador de "voce ja tem" / "falta".
 *
 * Configuravel via prop `limit` (default 8) pra caber bem ao lado do
 * SkillMap em desktop. A versao antiga (RequirementsList) mostrava 18 itens
 * e ocupava metade do layout — agora deixamos a versao enxuta aqui e
 * mantemos a lista completa acessivel via cliques (futuro) ou no detalhe
 * de cada microacao.
 */
export default function RequirementsFrequency({
  requirements,
  isIllustrative,
  limit = 8,
}) {
  const list = Array.isArray(requirements) ? requirements.slice(0, limit) : [];
  return (
    <section className="ct-req-freq app-glass" aria-labelledby="gaps-req-freq-title">
      <header className="ct-req-freq-head">
        <div>
          <h3 id="gaps-req-freq-title" className="ct-req-freq-title">
            O que o mercado pede mais
          </h3>
          <p className="ct-req-freq-sub">
            Top {list.length} habilidades por frequência nas vagas reais.
          </p>
        </div>
      </header>

      {isIllustrative && (
        <div className="ct-req-illustrative">
          Sem provider de vagas configurado — exibindo dados ilustrativos.
          Configure ADZUNA_APP_ID / JOOBLE_API_KEY pra vagas reais.
        </div>
      )}

      <ul className="ct-req-freq-list">
        {list.map((r, i) => (
          <li className="ct-req-freq-row" key={r.name + i}>
            <div className="ct-req-freq-row-head">
              <span className="ct-req-freq-name">{r.name}</span>
              <span
                className={
                  "ct-req-freq-tag " +
                  (r.status === "have" ? "have" : "missing")
                }
                style={
                  r.status === "have"
                    ? {
                        filter:
                          "drop-shadow(0 0 6px var(--accent-cyan-glow))",
                      }
                    : undefined
                }
              >
                {r.status === "have" ? "você tem" : "falta"}
              </span>
            </div>
            <div className="ct-req-freq-bar-wrap">
              <div className="ct-req-freq-bar">
                <div
                  className={
                    "ct-req-freq-bar-fill " +
                    (r.status === "have" ? "have" : "missing")
                  }
                  style={{ width: r.pct + "%" }}
                />
              </div>
              <span className="ct-req-freq-pct">{r.pct}%</span>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="ct-req-freq-empty">
            Sem requisitos detectados ainda.
          </li>
        )}
      </ul>
    </section>
  );
}
