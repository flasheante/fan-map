"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { Artist, ArtistFan, ArtistShow } from "@/lib/api";
import { BackToTheWarningLink } from "@/components/artists/back-link";
import { TheWarningLogo } from "@/components/artists/the-warning-logo";
import { TourExplorer } from "@/components/artists/tour-explorer";
import { buildMapViewHref, parseMapView } from "@/lib/map-view";
import { FanMapLoader } from "./fan-map-loader";
import { MapViewToggle } from "./map-view-toggle";

interface MapExplorerProps {
  artist: Artist;
  shows: ArtistShow[];
  fans: ArtistFan[];
}

// Cliente de /map: recibe ambos datasets ya resueltos por el Server
// Component (app/map/page.tsx, un único GET /artists compartido entre
// getTheWarningTourMapData y getTheWarningMapData) y decide qué mapa
// montar. La URL (`view`, ver lib/map-view.ts) es la única fuente de
// verdad: no hay useState para la vista activa, así nunca se desincroniza
// de la URL (mismo criterio que TourExplorer con sus filtros).
//
// Nunca se montan TourExplorer y FanMapLoader al mismo tiempo: cada uno
// carga su propia instancia de Leaflet vía next/dynamic(ssr:false), y acá
// sólo se renderiza uno u otro, nunca ambos, evitando dos mapas montados a
// la vez.
export function MapExplorer({ artist, shows, fans }: MapExplorerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = parseMapView(searchParams);
  const tourHref = buildMapViewHref(pathname, searchParams, "tour");
  const fansHref = buildMapViewHref(pathname, searchParams, "fans");

  return (
    <>
      <div className="border-b border-zinc-800 px-4 py-2">
        <BackToTheWarningLink />
      </div>

      <MapViewToggle activeView={view} tourHref={tourHref} fansHref={fansHref} />

      {view === "tour" ? (
        <TourExplorer artist={artist} shows={shows} />
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
            <h1 className="flex items-center gap-3">
              <TheWarningLogo height={28} />
              <span className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
                Fan Map
              </span>
            </h1>
            <p className="text-sm text-zinc-400">
              {fans.length} {fans.length === 1 ? "fan" : "fans"} en el mapa
            </p>
          </header>

          <div className="min-h-[60vh] flex-1">
            <FanMapLoader fans={fans} />
          </div>

          {fans.length === 0 && (
            <p className="border-t border-zinc-800 px-4 py-3 text-center text-sm text-zinc-400">
              Todavía no hay fans de {artist.name} en el mapa. ¡Sumate y sé el
              primero!
            </p>
          )}
        </>
      )}
    </>
  );
}
