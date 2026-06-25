// Concursos publicos (BR) — feature unica do mercado nacional. Lista vagas
// no setor público brasileiro filtradas por estado, nível e área. SEM viés
// de venda de curso: apresentação limpa, foco no candidato.
//
// Server component: roda no Node, faz scraping via lib/concursos. Filtros
// via form GET nativo — re-render server-side, sem JS pesado no client.
//
// Auth obrigatorio (protected paths em lib/auth-protected-paths.js).

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { fetchConcursos } from "@/lib/concursos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concursos públicos — CareerTwin AI" };

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const NIVEIS = [
  { value: "fundamental", label: "Fundamental" },
  { value: "medio", label: "Médio" },
  { value: "superior", label: "Superior" },
];

function fmtSalario(min, max) {
  if (min == null && max == null) return null;
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  if (min != null && max != null && min !== max) {
    return `${formatter.format(min)} – ${formatter.format(max)}`;
  }
  const v = max ?? min;
  return `Até ${formatter.format(v)}`;
}

function fmtPrazo(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function PageHeader() {
  return (
    <header className="ct-page-header">
      <div className="ct-page-header-icon" aria-hidden="true">
        {/* Balança da justiça — símbolo do setor público / concursos */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v18M5 7h14M5 7l-2 6a4 4 0 008 0l-2-6M19 7l-2 6a4 4 0 008 0l-2-6M8 21h8" />
        </svg>
      </div>
      <div className="ct-page-header-content">
        <div className="ct-page-header-eyebrow">CONCURSOS · MERCADO PÚBLICO BR</div>
        <h1 className="ct-page-header-title">Concursos públicos abertos</h1>
        <p className="ct-page-header-sub">
          Vagas no setor público brasileiro filtradas por estado, nível e área.
          Dados agregados de <a href="https://www.pciconcursos.com.br" rel="noopener noreferrer" target="_blank" style={{ color: "inherit", textDecoration: "underline" }}>pciconcursos.com.br</a>. Sempre confira o edital oficial antes de se inscrever.
        </p>
      </div>
    </header>
  );
}

function FiltersForm({ uf, nivel, area }) {
  // Form GET nativo: cada submit re-renderiza a página com os novos params
  // na query string. Sem client JS, sem state. Acessivel por default.
  const hasActive = Boolean(uf || nivel || area);
  const activeBorder = `1px solid var(--accent-cyan)`;
  const idleBorder = `1px solid var(--border)`;
  return (
    <form
      method="get"
      action="/concursos"
      className="app-glass"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "flex-end",
        padding: "16px 20px",
        borderRadius: "var(--radius-lg)",
        marginBottom: 18,
        boxShadow: hasActive ? "0 0 0 1px var(--accent-cyan), 0 6px 24px -10px var(--accent-cyan-glow)" : undefined,
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
        Estado
        <select
          name="uf"
          defaultValue={uf || ""}
          style={{
            background: "var(--surface)",
            border: uf ? activeBorder : idleBorder,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
            color: "var(--text)",
            minWidth: 110,
            outlineColor: "var(--accent-cyan)",
            boxShadow: uf ? "0 0 12px -4px var(--accent-cyan-glow)" : undefined,
          }}
        >
          <option value="">Todos</option>
          {UFS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
        Nível
        <select
          name="nivel"
          defaultValue={nivel || ""}
          style={{
            background: "var(--surface)",
            border: nivel ? activeBorder : idleBorder,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
            color: "var(--text)",
            minWidth: 140,
            outlineColor: "var(--accent-cyan)",
            boxShadow: nivel ? "0 0 12px -4px var(--accent-cyan-glow)" : undefined,
          }}
        >
          <option value="">Todos</option>
          {NIVEIS.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-soft)", flex: "1 1 200px" }}>
        Área (cargo ou órgão)
        <input
          type="text"
          name="area"
          defaultValue={area || ""}
          placeholder="ex.: enfermeiro, TJ, INSS"
          maxLength={120}
          style={{
            background: "var(--surface)",
            border: area ? activeBorder : idleBorder,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
            color: "var(--text)",
            outlineColor: "var(--accent-cyan)",
            boxShadow: area ? "0 0 12px -4px var(--accent-cyan-glow)" : undefined,
          }}
        />
      </label>

      <button
        type="submit"
        style={{
          background: "linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-cyan-deep, var(--primary)) 100%)",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          padding: "9px 18px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 16px -6px var(--accent-cyan-glow)",
        }}
      >
        Filtrar
      </button>

      {(uf || nivel || area) && (
        <Link
          href="/concursos"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-soft)",
            textDecoration: "underline",
            padding: "9px 0",
          }}
        >
          Limpar filtros
        </Link>
      )}
    </form>
  );
}

function ConcursoCard({ c }) {
  const salario = fmtSalario(c.salarioMin, c.salarioMax);
  const prazo = fmtPrazo(c.inscricoesAte);

  return (
    <article
      className="ct-job-card app-glass ct-glass-hover"
      style={{
        // 2-coluna sem logo (concurso não tem brand logo padronizado).
        gridTemplateColumns: "1fr auto",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      <div className="ct-job-info">
        <div className="ct-job-top">
          <h3 className="ct-job-role" style={{ fontSize: 16 }}>
            {c.cargo}
          </h3>
          {c.nivel && (
            <span className="ct-job-chip" style={{ background: "color-mix(in srgb, var(--accent-cyan) 14%, transparent)", color: "var(--accent-cyan)", border: "1px solid color-mix(in srgb, var(--accent-cyan) 35%, transparent)" }}>
              {c.nivel}
            </span>
          )}
          {c.uf && (
            <span className="ct-job-chip">
              {c.uf}
            </span>
          )}
        </div>
        <div className="ct-job-company" style={{ marginTop: 4 }}>
          {c.orgao}
        </div>
        <div className="ct-job-meta" style={{ marginTop: 8 }}>
          {c.vagas != null && (
            <span className="ct-job-chip">
              {c.vagas.toLocaleString("pt-BR")} vaga{c.vagas === 1 ? "" : "s"}
            </span>
          )}
          {salario && (
            <span className="ct-job-chip">
              {salario}
            </span>
          )}
          {prazo && (
            <span className="ct-job-chip">
              Inscrições até {prazo}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Ver edital
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>
    </article>
  );
}

export default async function ConcursosPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // searchParams pode ser undefined em alguns runtime quirks; defensivo.
  const sp = searchParams || {};
  const ufRaw = String(sp.uf || "").trim().toUpperCase();
  const uf = /^[A-Z]{2}$/.test(ufRaw) ? ufRaw : undefined;

  const nivelRaw = String(sp.nivel || "").trim().toLowerCase();
  const nivel = ["fundamental", "medio", "superior"].includes(nivelRaw)
    ? nivelRaw
    : undefined;

  const areaRaw = String(sp.area || "").trim();
  const area = areaRaw ? areaRaw.slice(0, 120) : undefined;

  // Provider já é defensivo: erros → []. Não há try/catch necessário aqui.
  const items = await fetchConcursos({ uf, nivel, area, limit: 30 });

  return (
    <main id="main-content" className="app-container site-section-mesh">
      <style>{`
        .ct-glass-hover:hover {
          transform: scale(1.01);
          box-shadow: 0 8px 32px -10px var(--accent-cyan-glow), 0 0 0 1px color-mix(in srgb, var(--accent-cyan) 45%, transparent);
        }
      `}</style>
      <PageHeader />

      <FiltersForm uf={uf} nivel={nivel} area={areaRaw} />

      <div className="ct-section-divider" style={{ margin: "20px 0" }} />

      <section className="ct-page-section">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            {items.length > 0
              ? `${items.length} concurso${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}`
              : "Resultados"}
          </h2>
          {items.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Atualizado periodicamente · cache de 1h
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="ct-empty-state-v2">
            <div className="ct-empty-state-v2-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <h3 className="ct-empty-state-v2-title">
              {uf || nivel || area
                ? "Nenhum concurso bate com seus filtros"
                : "Nenhum concurso retornado agora"}
            </h3>
            <p className="ct-empty-state-v2-desc">
              {uf || nivel || area
                ? "Tente afrouxar os filtros — ou apenas remover o estado pra ver concursos nacionais."
                : "A fonte pode estar momentaneamente indisponível. Tente novamente em alguns minutos."}
            </p>
            {(uf || nivel || area) && (
              <Link
                href="/concursos"
                style={{
                  marginTop: 6,
                  background: "var(--primary)",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Limpar filtros
              </Link>
            )}
          </div>
        ) : (
          <div className="ct-jobs-list">
            {items.map((c) => (
              <ConcursoCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
