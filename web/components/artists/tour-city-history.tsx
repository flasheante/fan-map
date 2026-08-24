import type { Artist, ArtistShow } from "@/lib/api";
import type { TourCityInfo } from "@/lib/the-warning-tour-city";
import { ShowsList } from "./shows-list";
import { TourBreadcrumbs } from "./tour-breadcrumbs";

interface TourCityHistoryProps {
  artist: Artist;
  city: TourCityInfo;
  shows: ArtistShow[];
}

// Historial de shows de una ciudad del Tour Map. Reutiliza ShowsList (misma
// lista que /artists/the-warning) para fecha, venue, link al detalle del
// show y estado vacío: esta página sólo agrega el encabezado con la ciudad,
// el país y la cantidad de shows. El breadcrumb (The Warning → Historial de
// shows → ciudad) reemplaza al antiguo BackToTourMapLink: cubre el mismo
// link de vuelta al Tour Map y además el de vuelta a The Warning.
export function TourCityHistory({ artist, city, shows }: TourCityHistoryProps) {
  return (
    <>
      <header className="flex flex-col gap-2 border-b px-4 py-4">
        <TourBreadcrumbs
          level="city"
          artistName={artist.name}
          cityName={city.name}
        />
        <h1 className="text-lg font-semibold">{artist.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {city.name}, {city.country.name}
        </p>
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {shows.length} {shows.length === 1 ? "show" : "shows"}
        </p>
      </header>
      <ShowsList shows={shows} />
    </>
  );
}
