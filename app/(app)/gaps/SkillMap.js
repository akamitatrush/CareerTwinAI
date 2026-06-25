/**
 * Ato 2 (lado esquerdo) — "Suas habilidades cruzadas com o mercado".
 *
 * Renderiza as habilidades do perfil do usuario classificadas em 3 grupos:
 *
 *   - covered: a habilidade aparece nas vagas analisadas (skill bate em
 *     pelo menos um dos requirements top-18).
 *   - rare:    a habilidade NAO foi detectada em nenhuma vaga do pool
 *     atual. Pode ser nicho/diferencial, mas tambem pode ser sinal de
 *     desalinho com o cargo-alvo.
 *   - unknown: a habilidade nao bate com nenhum termo da taxonomy. Pode
 *     ser uma soft skill, uma ferramenta nichada ou um typo. Mostramos com
 *     visual neutro pra nao desencorajar a auto-declaracao.
 *
 * NAO altera dados: trabalha apenas com profile.skills, requirements (vindo
 * do server) e canonicalSkillNames (set computado em page.js).
 */
export default function SkillMap({ skills, requirementSet, canonicalSet }) {
  const list = Array.isArray(skills) ? skills.map((s) => String(s)) : [];

  // Classificacao determinstica. Sem dependencia de LLM nem chamada externa.
  const buckets = { covered: [], rare: [], unknown: [] };
  for (const s of list) {
    const key = s.toLowerCase();
    if (requirementSet.has(key)) {
      buckets.covered.push(s);
    } else if (canonicalSet.has(key)) {
      buckets.rare.push(s);
    } else {
      buckets.unknown.push(s);
    }
  }

  const total = list.length;
  const coveredCount = buckets.covered.length;
  const coveragePct =
    total > 0 ? Math.round((coveredCount / total) * 100) : 0;

  return (
    <section
      className="ct-skill-map app-glass"
      aria-labelledby="gaps-skill-map-title"
      style={{
        boxShadow: "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)",
      }}
    >
      <header className="ct-skill-map-head">
        <div>
          <h3 id="gaps-skill-map-title" className="ct-skill-map-title">
            Suas habilidades cruzadas com o mercado
          </h3>
          <p className="ct-skill-map-sub">
            {total === 0
              ? "Adicione habilidades no seu perfil pra ver o cruzamento."
              : `${coveredCount} de ${total} aparecem nas vagas analisadas (${coveragePct}%)`}
          </p>
        </div>
      </header>

      {total === 0 ? null : (
        <>
          <Legend />
          <div className="ct-skill-map-groups">
            <Group
              variant="covered"
              label="Aparecem nas vagas"
              hint="O mercado pede isso e você já tem."
              items={buckets.covered}
            />
            <Group
              variant="rare"
              label="Raras no mercado atual"
              hint="Você tem, mas o pool de vagas analisado não destacou."
              items={buckets.rare}
            />
            <Group
              variant="unknown"
              label="Fora do nosso mapa"
              hint="Habilidade declarada que ainda não mapeamos. Pode ser soft skill ou nicho."
              items={buckets.unknown}
            />
          </div>
        </>
      )}
    </section>
  );
}

function Legend() {
  return (
    <ul className="ct-skill-map-legend" aria-label="Legenda do mapa">
      <li className="ct-skill-map-legend-item">
        <span className="ct-skill-pill covered" aria-hidden="true" />
        cobre vaga
      </li>
      <li className="ct-skill-map-legend-item">
        <span className="ct-skill-pill rare" aria-hidden="true" />
        rara
      </li>
      <li className="ct-skill-map-legend-item">
        <span className="ct-skill-pill unknown" aria-hidden="true" />
        fora do mapa
      </li>
    </ul>
  );
}

function Group({ variant, label, hint, items }) {
  if (!items || items.length === 0) return null;
  // Skills "covered" (que batem com o mercado) sao o ponto critico positivo
  // do mapa — ganham drop-shadow cyan no dot pra puxar o olho.
  const isCovered = variant === "covered";
  return (
    <div className="ct-skill-map-group">
      <div className="ct-skill-map-group-head">
        <span
          className={"ct-skill-map-dot " + variant}
          aria-hidden="true"
          style={
            isCovered
              ? { filter: "drop-shadow(0 0 6px var(--accent-cyan-glow))" }
              : undefined
          }
        />
        <span className="ct-skill-map-group-label">{label}</span>
        <span className="ct-skill-map-group-count">{items.length}</span>
      </div>
      <p className="ct-skill-map-group-hint">{hint}</p>
      <div className="ct-skill-map-chips">
        {items.map((s, i) => (
          <span
            key={s + i}
            className={"ct-skill-pill " + variant}
            title={hint}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
