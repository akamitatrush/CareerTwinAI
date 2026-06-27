// /estagios — vagas de estagio (BR) pra estudante universitario (18-25).
// Expande TAM: 15M estudantes universitarios brasileiros.
//
// Server component: roda no Node, chama lib/estagios direto. Filtros via form
// GET nativo — re-render server-side, sem JS pesado no client. Acessivel por
// default (form keyboard navigable, labels, focus).
//
// Auth obrigatorio (PROTECTED_PREFIXES em lib/auth-protected-paths.js cobre
// /estagios). Defense-in-depth: re-check auth() aqui mesmo se middleware falhar.
//
// Usa classes existentes do design system: ct-page-header, ct-job-card,
// ct-empty-state-v2, ct-section-divider. NAO criamos classe nova.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { fetchEstagios } from "@/lib/estagios";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estágios — CareerTwin AI" };

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

// Mesma lista da rota — manter em sync se adicionar area.
const AREAS = [
  { value: "ti", label: "TI / Dados" },
  { value: "marketing", label: "Marketing" },
  { value: "vendas", label: "Vendas" },
  { value: "financas", label: "Finanças" },
  { value: "rh", label: "RH" },
  { value: "juridico", label: "Jurídico" },
  { value: "engenharia", label: "Engenharia" },
  { value: "saude", label: "Saúde" },
  { value: "design", label: "Design / UX" },
];

const MODALIDADES = [
  { value: "", label: "Todas" },
  { value: "presencial", label: "Presencial" },
  { value: "hibrido", label: "Híbrido" },
  { value: "remoto", label: "Remoto" },
];

function fmtBolsa(b) {
  if (b == null || !Number.isFinite(b) || b <= 0) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(b);
}

function PageHeader({ total }) {
  return (
    <header className="ct-page-header">
      <div className="ct-page-header-icon" aria-hidden="true">
        {/* Mochila/livros — simbolo de estudante */}
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
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path d="M9 7h6M9 11h6" />
        </svg>
      </div>
      <div className="ct-page-header-content">
        <div className="ct-page-header-eyebrow">MERCADO · ESTÁGIOS</div>
        <h1 className="ct-page-header-title">Estágios abertos</h1>
        <p className="ct-page-header-sub">
          Oportunidades pra começar agora. Filtros por UF, área e modalidade.
        </p>
        {total > 0 && (
          <div className="ct-page-header-meta">
            <span>{total} estágio{total === 1 ? "" : "s"} disponíveis</span>
          </div>
        )}
      </div>
    </header>
  );
}

function DicaBanner() {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 16px",
        background: "var(--primary-soft)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--primary)",
        borderRadius: "var(--radius-md)",
        marginBottom: 16,
        fontSize: 13.5,
        color: "var(--text-soft)",
        lineHeight: 1.55,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16 }}>💡</span>
      <span>
        <strong style={{ color: "var(--text)" }}>Dica:</strong>{" "}
        Estágio + LinkedIn ativo = 3x mais callbacks. Veja{" "}
        <Link href="/conta" style={{ color: "var(--primary)", fontWeight: 600 }}>
          /conta
        </Link>{" "}
        pra otimizar seu perfil.
      </span>
    </div>
  );
}

function FiltersForm({ uf, area, modalidade, query }) {
  // Form GET nativo — submit re-renderiza com novos params na URL.
  const hasActive = Boolean(uf || area || modalidade || query);
  const activeBorder = `1px solid var(--accent-cyan)`;
  const idleBorder = `1px solid var(--border)`;
  return (
    <form
      method="get"
      action="/estagios"
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
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-soft)",
        }}
      >
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
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-soft)",
          flex: "1 1 240px",
        }}
      >
        Área
        <input
          type="text"
          name="area"
          defaultValue={area || ""}
          placeholder="ex.: ti, marketing, finanças"
          maxLength={60}
          list="estagios-areas"
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
        <datalist id="estagios-areas">
          {AREAS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </datalist>
      </label>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-soft)",
          flex: "1 1 200px",
        }}
      >
        Busca livre
        <input
          type="text"
          name="query"
          defaultValue={query || ""}
          placeholder="ex.: frontend, vendas, jurídico"
          maxLength={120}
          style={{
            background: "var(--surface)",
            border: query ? activeBorder : idleBorder,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
            color: "var(--text)",
            outlineColor: "var(--accent-cyan)",
            boxShadow: query ? "0 0 12px -4px var(--accent-cyan-glow)" : undefined,
          }}
        />
      </label>

      <fieldset
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          border: 0,
          padding: 0,
          margin: 0,
        }}
      >
        <legend
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-soft)",
            marginBottom: 2,
          }}
        >
          Modalidade
        </legend>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingBottom: 4 }}>
          {MODALIDADES.map((m) => (
            <label
              key={m.value || "todas"}
              style={{
                display: "inline-flex",
                gap: 5,
                alignItems: "center",
                fontSize: 13,
                cursor: "pointer",
                color: "var(--text)",
              }}
            >
              <input
                type="radio"
                name="modalidade"
                value={m.value}
                defaultChecked={(modalidade || "") === m.value}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        style={{
          background: "linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-cyan-deep, var(--primary)) 100%)",
          color: "var(--accent-on-cyan, #08313F)",
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

      {(uf || area || modalidade || query) && (
        <Link
          href="/estagios"
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

function EstagioCard({ e }) {
  const bolsa = fmtBolsa(e.bolsa);
  return (
    <article
      className="ct-job-card app-glass ct-glass-hover"
      style={{
        // 2-coluna sem logo (estagio raramente tem brand logo).
        gridTemplateColumns: "1fr auto",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      <div className="ct-job-info">
        <div className="ct-job-top">
          <h3 className="ct-job-role" style={{ fontSize: 16 }}>
            {e.title}
          </h3>
          {e.modalidade && (
            <span
              className="ct-job-chip"
              style={{ background: "color-mix(in srgb, var(--accent-cyan) 14%, transparent)", color: "var(--accent-cyan)", border: "1px solid color-mix(in srgb, var(--accent-cyan) 35%, transparent)" }}
            >
              {e.modalidade}
            </span>
          )}
          {e.uf && <span className="ct-job-chip">{e.uf}</span>}
        </div>
        <div className="ct-job-company" style={{ marginTop: 4 }}>
          {e.company}
        </div>
        <div className="ct-job-meta" style={{ marginTop: 8 }}>
          {e.location && <span className="ct-job-chip">{e.location}</span>}
          {bolsa && <span className="ct-job-chip">Bolsa {bolsa}</span>}
          {e.area && (
            <span className="ct-job-chip" style={{ textTransform: "uppercase" }}>
              {e.area}
            </span>
          )}
          {e.source === "fixtures" && (
            <span
              className="ct-job-chip"
              style={{
                background: "var(--surface-2)",
                fontStyle: "italic",
              }}
              title="Vaga ilustrativa — configure ADZUNA_APP_ID/JOOBLE_API_KEY pra dados reais"
            >
              Ilustrativo
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        {e.url && e.source !== "fixtures" ? (
          <a
            href={e.url}
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
            Ver vaga
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        ) : (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontStyle: "italic",
              padding: "8px 14px",
            }}
          >
            Sem link
          </span>
        )}
      </div>
    </article>
  );
}

export default async function EstagiosPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // searchParams pode ser undefined em alguns runtime quirks; defensivo.
  const sp = searchParams || {};
  const ufRaw = String(sp.uf || "").trim().toUpperCase();
  const uf = /^[A-Z]{2}$/.test(ufRaw) ? ufRaw : undefined;

  const areaRaw = String(sp.area || "").trim().toLowerCase();
  // Aceita area mesmo que nao esteja no whitelist — provider filtra por
  // substring; UI exibe oque o user digitou (UX: nao zera o input).
  const area = areaRaw ? areaRaw.slice(0, 60) : undefined;

  const queryRaw = String(sp.query || "").trim();
  const query = queryRaw ? queryRaw.slice(0, 120) : undefined;

  const modalidadeRaw = String(sp.modalidade || "").trim().toLowerCase();
  const VALID_MODALIDADES = ["presencial", "hibrido", "remoto"];
  const modalidade = VALID_MODALIDADES.includes(modalidadeRaw) ? modalidadeRaw : undefined;

  // Provider e defensivo: erros -> []. Sem try/catch necessario aqui.
  let items = await fetchEstagios({ query, uf, area, limit: 30 });

  // Modalidade nao e filtro de provider (modalidade depende de detecao
  // pos-fetch). Filtramos aqui apos buscar.
  if (modalidade) {
    items = items.filter((e) => {
      const m = (e.modalidade || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return m === modalidade;
    });
  }

  return (
    <main id="main-content" className="app-container site-section-mesh">
      <style>{`
        .ct-glass-hover:hover {
          transform: scale(1.01);
          box-shadow: 0 8px 32px -10px var(--accent-cyan-glow), 0 0 0 1px color-mix(in srgb, var(--accent-cyan) 45%, transparent);
        }
      `}</style>
      <PageHeader total={items.length} />

      <DicaBanner />

      <FiltersForm uf={uf} area={areaRaw} modalidade={modalidade} query={queryRaw} />

      <div className="ct-section-divider" style={{ margin: "20px 0" }} />

      <section className="ct-page-section">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-strong)",
              margin: 0,
            }}
          >
            {items.length > 0
              ? `${items.length} estágio${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}`
              : "Resultados"}
          </h2>
          {items.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Atualizado periodicamente · cache de 30min
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="ct-empty-state-v2">
            <div className="ct-empty-state-v2-icon" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <h3 className="ct-empty-state-v2-title">
              {uf || area || modalidade || query
                ? "Nenhum estágio bate com seus filtros"
                : "Nenhum estágio retornado agora"}
            </h3>
            <p className="ct-empty-state-v2-desc">
              {uf || area || modalidade || query
                ? "Tente afrouxar os filtros — ou remova a UF pra ver estágios em todo o Brasil."
                : "Estágios são publicados em batch (geralmente segundas). Cache de 30min pode atrasar até lá. Tente novamente em alguns minutos."}
            </p>
            {(uf || area || modalidade || query) && (
              <Link
                href="/estagios"
                style={{
                  marginTop: 6,
                  background: "var(--primary)",
                  color: "var(--on-primary, #fff)",
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
            {items.map((e) => (
              <EstagioCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
