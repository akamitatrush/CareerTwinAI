import "./globals.css";
import PostHogProvider from "@/components/PostHogProvider";
import ThemeToggle from "@/components/ThemeToggle";

// Forca renderizacao dinamica em todas as paginas. Necessario porque o
// middleware gera um nonce CSP novo a cada request — se a Vercel servir
// HTML cacheado, o nonce do header NAO bate com o do HTML, e o browser
// bloqueia TODOS os scripts inline (incluindo a hidratacao do Next).
// Resultado pratico: sem isso, paginas estaticas como `/` ficam sem JS
// em producao apos o primeiro request cacheado.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "CareerTwin AI — seu gêmeo de carreira",
  description:
    "Copiloto de empregabilidade: construa o gêmeo digital da sua carreira, veja sua aderência às vagas com o porquê de cada número.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Aplica o tema do localStorage SINCRONAMENTE antes do paint pra
            evitar flash-of-wrong-theme. Roda em try/catch porque pode falhar
            em iframes/SSR/Safari privado. Fallback: light (novo default). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('ct_theme') || 'light';
                  document.documentElement.setAttribute('data-theme', t);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeToggle />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
