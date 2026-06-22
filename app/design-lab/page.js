// Lab de comparacao visual das 3 direcoes de design.
// Acesse /design-lab — mesmo conteudo (gemeo + score + 1 vaga) em 3 esteticas.
// Para escolher uma direcao: olhe lado a lado em mobile e desktop.

import "./lab.css";

const DEMO = {
  nome: "Sérgio Hasher",
  cargo_atual: "Engenheiro de Software Sênior",
  alvo: "Engenheiro de Segurança Sênior",
  overall: 72,
  subs: [
    { k: "Aderência a vagas", v: 78 },
    { k: "Relevância de habilidades", v: 65 },
    { k: "Otimização do perfil", v: 81 },
    { k: "Experiência de mercado", v: 64 },
  ],
  gap: "Threat modeling",
  vaga: {
    titulo: "Senior Security Engineer",
    empresa: "Nubank",
    local: "São Paulo, SP",
    match: 78,
    fonte: "Adzuna",
  },
};

export default function DesignLab() {
  return (
    <main className="lab">
      <header className="lab-head">
        <h1>Design Lab — 3 direções</h1>
        <p>
          Mesmo conteúdo (gêmeo + score + 1 vaga real) renderizado em 3 estéticas.
          Escolha uma e me diga qual aplicar globalmente. <a href="/">← voltar pra home</a>
        </p>
      </header>

      <section className="lab-grid">
        <Dossier data={DEMO} />
        <Terminal data={DEMO} />
        <Memorando data={DEMO} />
      </section>

      <footer className="lab-foot">
        <p>
          Atual: <a href="/">tech-noir minimalista (papel quente + #B9D90C)</a> — bom mas conservador.
        </p>
      </footer>
    </main>
  );
}

/* =====================================================================
 * 1. DOSSIÊ — Editorial jornalístico (FT / Bloomberg Businessweek)
 * ===================================================================== */
function Dossier({ data }) {
  return (
    <article className="dir dossier">
      <div className="dir-tag">Direção 1 · Dossiê</div>
      <hr className="rule rule-thick" />
      <div className="meta">CAREERTWIN · DOSSIÊ Nº 0001 · {hoje()}</div>
      <h2 className="kicker">PERFIL</h2>
      <h3 className="head">
        {data.nome}, hoje {data.cargo_atual.toLowerCase()}, em transição para{" "}
        <em>{data.alvo}</em>.
      </h3>
      <hr className="rule" />
      <div className="dos-cols">
        <div>
          <div className="dos-eyebrow">SCORE GERAL</div>
          <div className="dos-score">{data.overall}</div>
          <div className="dos-sub">de 100 — composto auditável</div>
        </div>
        <ul className="dos-bars">
          {data.subs.map((s) => (
            <li key={s.k}>
              <span className="dos-bar-k">{s.k}</span>
              <span className="dos-bar-v">{s.v}</span>
              <div className="dos-bar">
                <div className="dos-bar-fill" style={{ width: `${s.v}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <hr className="rule" />
      <div className="dos-pull">
        Lacuna prioritária: <mark>{data.gap}</mark> — citada em {72}% das vagas analisadas.
      </div>
      <hr className="rule" />
      <div className="dos-vaga">
        <div className="dos-eyebrow">VAGA EM DESTAQUE · {data.vaga.fonte}</div>
        <h4 className="dos-vaga-t">{data.vaga.titulo}</h4>
        <div className="dos-vaga-m">
          {data.vaga.empresa} · {data.vaga.local} ·{" "}
          <span className="dos-match">match {data.vaga.match}</span>
        </div>
      </div>
    </article>
  );
}

/* =====================================================================
 * 2. TERMINAL — Bloomberg / Linear dark
 * ===================================================================== */
function Terminal({ data }) {
  return (
    <article className="dir term">
      <div className="dir-tag term-tag">Direção 2 · Terminal</div>
      <div className="term-tickers">
        <span>SCORE <b>{data.overall}</b> <i className="up">▲ +4</i></span>
        <span>VAGAS <b>1.284</b> <i className="up">▲ 6.2%</i></span>
        <span>GAP CRIT <b className="alert">{data.gap.toUpperCase()}</b></span>
      </div>
      <header className="term-head">
        <div>
          <div className="term-id">USR / {slug(data.nome)}</div>
          <div className="term-name">{data.nome}</div>
          <div className="term-role">{data.cargo_atual} → {data.alvo}</div>
        </div>
        <div className="term-gauge">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" stroke="#2A2D36" strokeWidth="6" fill="none" />
            <circle
              cx="50" cy="50" r="42"
              stroke="#B9D90C" strokeWidth="6" fill="none"
              strokeDasharray={`${(data.overall / 100) * 264} 264`}
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
            />
          </svg>
          <div className="term-gauge-v">{data.overall}</div>
        </div>
      </header>
      <table className="term-table">
        <thead>
          <tr>
            <th>METRIC</th>
            <th>VAL</th>
            <th>DELTA</th>
            <th>TREND</th>
          </tr>
        </thead>
        <tbody>
          {data.subs.map((s, i) => {
            const delta = [+3, -2, +6, +1][i];
            return (
              <tr key={s.k}>
                <td>{s.k}</td>
                <td className="num">{s.v}</td>
                <td className={"num " + (delta >= 0 ? "up" : "down")}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
                </td>
                <td className="num"><Sparkline up={delta >= 0} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="term-vaga">
        <div className="term-vaga-h">
          <span className="term-tag-src">{data.vaga.fonte.toUpperCase()}</span>
          <span className="term-match">MATCH {data.vaga.match}</span>
        </div>
        <div className="term-vaga-t">{data.vaga.titulo}</div>
        <div className="term-vaga-m">{data.vaga.empresa} · {data.vaga.local}</div>
      </div>
      <div className="term-kbd">⌘K busca · G+J vagas · ? atalhos</div>
    </article>
  );
}

function Sparkline({ up }) {
  const path = up
    ? "M0 18 L8 14 L16 16 L24 8 L32 10 L40 2"
    : "M0 4 L8 8 L16 6 L24 14 L32 12 L40 18";
  return (
    <svg viewBox="0 0 40 20" width="40" height="14" style={{ verticalAlign: "middle" }}>
      <path d={path} stroke={up ? "#B9D90C" : "#FF6A3D"} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/* =====================================================================
 * 3. MEMORANDO — Neo-brutalismo honesto
 * ===================================================================== */
function Memorando({ data }) {
  return (
    <article className="dir memo">
      <div className="dir-tag memo-tag">Direção 3 · Memorando</div>
      <div className="memo-from">
        <div>DE: CareerTwin</div>
        <div>PARA: {data.nome}</div>
        <div>DATA: {hoje()}</div>
        <div>RE: Diagnóstico de carreira</div>
      </div>
      <div className="memo-stamp" style={{ transform: "rotate(-4deg)" }}>
        SCORE {data.overall}/100
      </div>
      <p className="memo-body">
        Você é hoje <b>{data.cargo_atual}</b>. Quer ser <b>{data.alvo}</b>. A distância,
        medida com fontes auditáveis, é a seguinte:
      </p>
      <pre className="memo-formula">
{`score = Σ(sub_i × peso_i)
overall = ${data.overall}
`}
      </pre>
      <ul className="memo-list">
        {data.subs.map((s) => (
          <li key={s.k}>
            <span className="memo-box">[{s.v >= 70 ? "x" : " "}]</span>{" "}
            {s.k}: <b>{s.v}</b>
          </li>
        ))}
      </ul>
      <div className="memo-gap">
        <div className="memo-stamp" style={{ transform: "rotate(2deg)" }}>GAP CRÍTICO</div>
        <p>{data.gap} — apareceu em {72}% das vagas analisadas.</p>
      </div>
      <hr className="memo-rule" />
      <div className="memo-vaga">
        <div className="memo-vaga-h">
          <b>{data.vaga.titulo}</b>
          <span className="memo-stamp" style={{ transform: "rotate(-2deg)" }}>
            MATCH {data.vaga.match}
          </span>
        </div>
        <div className="memo-vaga-m">
          {data.vaga.empresa} · {data.vaga.local} · fonte: <b>{data.vaga.fonte}</b>
        </div>
      </div>
      <div className="memo-foot">— fim do memorando —</div>
    </article>
  );
}

function hoje() {
  const d = new Date();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
}
