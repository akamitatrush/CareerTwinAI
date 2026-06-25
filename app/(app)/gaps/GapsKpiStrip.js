/**
 * Ato 1 — "Onde voce esta".
 *
 * KPI strip do topo da /gaps. Server component puro.
 *
 * Estados:
 *  - "celebrate": todas as microacoes do snapshot atual estao completas
 *    (zero pendentes). Strip ganha realce verde + banner CTA pra refazer
 *    diagnostico.
 *  - "first": usuario ainda nao completou nenhuma microacao do snapshot
 *    atual. Subhead destaca a primeira lacuna como ponto de partida.
 *  - default: subhead pragmatica resumindo o estado.
 *
 * As tres KPIs principais sao calculadas no servidor a partir do snapshot
 * + summary das vagas. NAO altera schema nem endpoints; soh apresenta.
 */
export default function GapsKpiStrip({ summary, snapshot, targetRole }) {
  const gaps = Array.isArray(snapshot?.gaps) ? snapshot.gaps : [];
  const totalGaps = gaps.length;
  const completedGaps = gaps.filter((g) => g.completedAt).length;
  const openGaps = totalGaps - completedGaps;
  const progressPct =
    totalGaps > 0 ? Math.round((completedGaps / totalGaps) * 100) : 0;

  const celebrate = totalGaps > 0 && openGaps === 0;
  const isFirstTime = totalGaps > 0 && completedGaps === 0;

  let subHeading;
  if (celebrate) {
    subHeading = (
      <>
        Você fechou todas as lacunas do diagnóstico atual. Que tal{" "}
        <strong>refazer o diagnóstico</strong> pra atualizar o mapa?
      </>
    );
  } else if (isFirstTime && totalGaps > 0) {
    subHeading = (
      <>
        Hoje você tem <strong>{openGaps} lacunas</strong> mapeadas
        {targetRole ? (
          <>
            {" "}em relação a <strong>{targetRole}</strong>
          </>
        ) : null}
        . Comece pela primeira lá embaixo — ela tem o maior impacto.
      </>
    );
  } else if (totalGaps > 0) {
    subHeading = (
      <>
        <strong>{openGaps} lacunas em aberto</strong>, {completedGaps} já
        marcadas como concluídas
        {targetRole ? (
          <>
            {" "}em relação a <strong>{targetRole}</strong>
          </>
        ) : null}
        .
      </>
    );
  } else if (summary?.totalJobs > 0) {
    subHeading = (
      <>
        Analisamos <strong>{summary.totalJobs} vagas reais</strong> pra montar
        o panorama abaixo
        {targetRole ? (
          <>
            {" "}de <strong>{targetRole}</strong>
          </>
        ) : null}
        .
      </>
    );
  } else {
    subHeading = (
      <>Resumo do seu posicionamento em relação ao mercado abaixo.</>
    );
  }

  return (
    <section
      className={
        "ct-gaps-act ct-gaps-act-1 app-glass" +
        (celebrate ? " celebrate" : "")
      }
      aria-labelledby="gaps-act-1"
      style={{
        boxShadow:
          "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)",
      }}
    >
      <header className="ct-gaps-act-head">
        <span className="ct-gaps-act-num" aria-hidden="true">
          1
        </span>
        <div>
          <h2 id="gaps-act-1" className="ct-gaps-act-title">
            Onde você está
          </h2>
          <p className="ct-gaps-act-sub">{subHeading}</p>
        </div>
      </header>

      <div className={"ct-kpi-strip" + (celebrate ? " ct-kpi-celebrate" : "")}>
        <KPICard
          value={openGaps}
          label={openGaps === 1 ? "lacuna em aberto" : "lacunas em aberto"}
          color={openGaps > 0 ? "attention" : "positive"}
        />
        <KPICard
          value={completedGaps}
          label={
            completedGaps === 1 ? "microação concluída" : "microações concluídas"
          }
          color={completedGaps > 0 ? "positive" : null}
        />
        <KPICard
          value={`${progressPct}%`}
          label="progresso do diagnóstico"
          color="primary"
        />
        {summary?.adherence != null ? (
          <KPICard
            value={`${summary.adherence}%`}
            label="aderência ao mercado"
            color="primary"
          />
        ) : (
          <KPICard
            value={totalGaps}
            label="lacunas detectadas"
            color="primary"
          />
        )}
      </div>

      {celebrate && (
        <div className="ct-gaps-celebrate-banner" role="status">
          <div>
            <strong>Tudo concluído!</strong> Hora de medir de novo e ver quanto
            você avançou.
          </div>
          <a className="ct-gaps-celebrate-cta" href="/dashboard">
            Refazer diagnóstico →
          </a>
        </div>
      )}
    </section>
  );
}

function KPICard({ value, label, color }) {
  const colorClass =
    color === "attention"
      ? "ct-kpi-attention"
      : color === "primary"
        ? "ct-kpi-primary"
        : color === "positive"
          ? "ct-kpi-positive"
          : "";
  // KPIs "primary" e "positive" recebem glow cyan; "attention" preserva o
  // tom de alerta nativo. accent-cyan-glow some no light-mode token.
  const isHighlight = color === "primary" || color === "positive";
  return (
    <div
      className="ct-kpi-card app-glass"
      style={{
        boxShadow: isHighlight
          ? "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)"
          : "var(--shadow-md)",
      }}
    >
      <div
        className={"ct-kpi-value " + colorClass}
        style={
          isHighlight
            ? { filter: "drop-shadow(0 0 6px var(--accent-cyan-glow))" }
            : undefined
        }
      >
        {value}
      </div>
      <div className="ct-kpi-label">{label}</div>
    </div>
  );
}
