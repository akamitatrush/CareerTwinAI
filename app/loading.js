// Suspense boundary do segmento raiz (paginas publicas). Renderiza durante
// navegacao client-side enquanto a proxima rota carrega.

export default function Loading() {
  return (
    <main className="app-container" style={{ paddingTop: 80 }} aria-busy="true">
      <div className="ct-loading-skeleton">
        <div className="ct-skel-card" />
        <div className="ct-skel-card" />
      </div>
    </main>
  );
}
