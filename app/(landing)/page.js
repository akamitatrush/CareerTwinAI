import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SiteHero from "@/components/site/SiteHero";
import SiteFeatures from "@/components/site/SiteFeatures";
import SiteHowItWorks from "@/components/site/SiteHowItWorks";
import SiteSocialProof from "@/components/site/SiteSocialProof";
import SitePricing from "@/components/site/SitePricing";
import SiteFaq from "@/components/site/SiteFaq";

// Landing premium servida em / (raiz, via route group `(landing)`). Ordem das
// sections deliberada:
//   Hero       — captura atencao com promessa + CTA principal
//   Features   — porque o produto eh diferente (cards de diferencial)
//   How it works — converte interesse em entendimento (3 steps)
//   Social proof — credibilidade (stats reais, time Tera, stack)
//   Pricing    — converte entendimento em decisao (3 tiers, Pro destacado)
//   FAQ        — derruba ultimas objeções
//   Footer     — navegacao + legal
//
// User logado vendo / eh redirecionado pra /meu-gemeo (server-side via auth()).
// IDOR-safe: a sessao vem do servidor, nao de cookie/header manipulavel cliente.
// Modo experimentar anonimo continua acessivel em /experimentar (sem login).
//
// Smooth scroll global aplicado via CSS inline no html (necessario porque
// nao podemos editar globals.css). Tag <style jsx> nao funciona em Server
// Component — usamos <style> normal com escopo global.

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/meu-gemeo");
  }

  return (
    <>
      {/* Habilita scroll suave so na landing. Limita o escopo via :has em browsers
          modernos; fallback aceitavel pra usar global em browsers velhos. */}
      <style>{`
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
        }
      `}</style>
      <SiteHero />
      <SiteFeatures />
      <SiteHowItWorks />
      <SiteSocialProof />
      <SitePricing />
      <SiteFaq />
    </>
  );
}
