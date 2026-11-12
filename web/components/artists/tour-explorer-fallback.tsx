// Fallback del <Suspense> que envuelve a TourExplorer en las páginas ISR de
// The Warning: TourExplorer lee la URL con useSearchParams(), que en una
// página estática sólo se resuelve en el cliente. Este placeholder es lo que
// queda en el HTML prerenderizado hasta que hidrata (el resto de la página
// —header, stats, top de canciones— sí sale renderizado).
export function TourExplorerFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-400">
      Cargando historial de shows...
    </div>
  );
}
