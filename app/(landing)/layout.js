import SiteNav from "@/components/site/SiteNav";
import SiteCursorGlow from "@/components/site/SiteCursorGlow";
import SiteFooter from "@/components/site/SiteFooter";

// Landing tem o proprio layout — sem AppShell, sem sidebar, sem topbar.
// Forca tema dark via data-theme inline no container (sem brigar com o root
// que aceita preferencia do usuario via localStorage). O CSS escopa cores
// pelo --site-* tokens, entao o tema visual da landing nao depende do toggle
// global. Isso evita FOUC e mantem o look premium consistente.
// `force-dynamic` herdado do root pra compat com middleware CSP.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "CareerTwin AI — Copiloto de carreira brasileiro, auditável",
  description:
    "Diagnóstico de carreira em ~10s. Score auditável, vagas reais com aderência, microações com fonte. LGPD by-design. Sem caixa-preta, sem alucinação.",
  openGraph: {
    title: "CareerTwin AI — Copiloto de carreira brasileiro",
    description:
      "Diagnóstico auditável, vagas reais, microações com fonte. Sem caixa-preta.",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "CareerTwin AI",
    description:
      "Copiloto de carreira brasileiro, auditável. Sem caixa-preta.",
  },
};

export default function SiteLayout({ children }) {
  return (
    <div
      data-site-root
      style={{
        background: "#0A0A0E",
        color: "#FAFAFC",
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      <SiteCursorGlow />
      <SiteNav />
      <main style={{ position: "relative", zIndex: 2 }}>{children}</main>
      <SiteFooter />
    </div>
  );
}
