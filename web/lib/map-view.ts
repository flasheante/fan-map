// Vista de /map: qué mapa se muestra (Historial de shows o Fan Map). Lógica
// pura y testeable, sin nada de next/navigation acá (ver map-explorer.tsx,
// el único consumidor, que sí usa useSearchParams/usePathname).
export type MapView = "tour" | "fans";

const VIEW_PARAM = "view";
const FANS_VIEW = "fans";

// La URL es la fuente de verdad: sin `view` o con un valor desconocido
// (ej. "banana") se degrada a "tour", nunca se rompe. Es el mismo criterio
// "ausente/ inválido no se cuela" que parseTourFiltersFromSearchParams en
// tour-filters-url.ts.
export function parseMapView(searchParams: URLSearchParams): MapView {
  return searchParams.get(VIEW_PARAM) === FANS_VIEW ? "fans" : "tour";
}

// Arma el href de un botón del selector de vista: conserva TODOS los demás
// query params ya presentes (en particular los filtros de Tour, ver
// TourFilters en tour-filters.ts) y sólo agrega o quita `view`. Nunca muta
// `searchParams` (mismo criterio de pureza que filterTourShows).
//
// "tour" nunca se serializa explícito (?view=tour): ausencia de `view` ya
// resuelve a "tour" vía parseMapView, así el botón activo por defecto no
// ensucia la URL con un param redundante.
export function buildMapViewHref(
  pathname: string,
  searchParams: URLSearchParams,
  view: MapView,
): string {
  const params = new URLSearchParams(searchParams);

  if (view === "fans") {
    params.set(VIEW_PARAM, FANS_VIEW);
  } else {
    params.delete(VIEW_PARAM);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
