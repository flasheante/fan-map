import type { Artist, ArtistFan } from "@/lib/api";
import { TheWarningLogo } from "@/components/artists/the-warning-logo";
import { FanMapLoader } from "./fan-map-loader";
import { FavoriteSongsRanking } from "./favorite-songs-ranking";

interface MapExplorerProps {
  artist: Artist;
  fans: ArtistFan[];
}

// Contenido de /map: el Fan Map con su contador y el ranking de canciones
// favoritas. La navegación entre secciones (Historial de shows / Fan Map /
// Perfil) la resuelve el header del sitio (components/site-header.tsx); acá
// ya no hay selector de vista propio. FanMapLoader carga Leaflet vía
// next/dynamic(ssr:false), así que el mapa en sí sólo se monta en el cliente.
export function MapExplorer({ artist, fans }: MapExplorerProps) {
  return (
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

      <div className="h-[70vh] min-h-80">
        <FanMapLoader fans={fans} />
      </div>

      {fans.length === 0 && (
        <p className="border-t border-zinc-800 px-4 py-3 text-center text-sm text-zinc-400">
          Todavía no hay fans de {artist.name} en el mapa. ¡Sumate y sé el
          primero!
        </p>
      )}

      <FavoriteSongsRanking />
    </>
  );
}
