// Suspense boundary do grupo (app). Renderiza enquanto a rota autenticada
// resolve (auth() + queries Prisma). Mantem layout visual estavel — evita
// CLS (cumulative layout shift) entre placeholder e conteudo final.

export default function Loading() {
  return (
    <main className="app-container" id="main-content" aria-busy="true">
      <div className="ct-loading-skeleton">
        <div className="ct-skel-card" />
        <div className="ct-skel-card" />
        <div className="ct-skel-card" />
      </div>
    </main>
  );
}
