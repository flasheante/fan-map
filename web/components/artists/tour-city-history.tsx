import type { ReactNode } from "react";
import type { Artist, ArtistShow } from "@/lib/api";
import { formatShowDate } from "@/lib/format-show-date";
import type { TourCityInfo } from "@/lib/the-warning-tour-city";
import { getTourCityDateRange, groupShowsByCity } from "@/lib/the-warning-tour-map";
import { ShowsList } from "./shows-list";
import { TheWarningLogo } from "./the-warning-logo";
import { TourBreadcrumbs } from "./tour-breadcrumbs";
import { TourMapLoader } from "./tour-map-loader";

interface TourCityHistoryProps {
  artist: Artist;
  city: TourCityInfo;
  shows: ArtistShow[];
}

// Mismo placeholder que ShowsList/TourMap para un venue sin cargar, pero acá
// además se hace trim: a diferencia de esos dos (que sólo cubren venue
// null con `??`), el resumen de Primer/Último show también debe cubrir
// "" o whitespace-only, que ShowsList no necesita distinguir porque nunca
// los mostraba en un formato compacto de una sola línea como éste.
function venueLabel(venue: string | null): string {
  const trimmed = venue?.trim();
  return trimmed ? trimmed : "Venue a confirmar";
}

// Mismo bloque label + valor que StatRow en tour-stats.tsx: se repite acá
// en vez de extraerlo a un componente compartido porque son sólo dos usos y
// aún no justifica una nueva pieza reutilizable.
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-warning text-xs font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

// Historial de shows de una ciudad del Tour Map. Reutiliza ShowsList (misma
// lista que /artists/the-warning) para fecha, venue, link al detalle del
// show y estado vacío: esta página sólo agrega el encabezado con la ciudad,
// el país, la cantidad de shows, el primer/último show y un mapa centrado
// en la ciudad. El breadcrumb (The Warning → Historial de shows → ciudad)
// reemplaza al antiguo BackToTourMapLink: cubre el mismo link de vuelta al
// Tour Map y además el de vuelta a The Warning.
export function TourCityHistory({ artist, city, shows }: TourCityHistoryProps) {
  // Reutiliza getTourCityDateRange (the-warning-tour-map.ts, ya usado por el
  // popup del Tour Map): ordena una copia de `shows` por fecha asc sin
  // mutar el array recibido, así el resultado no depende del orden en que
  // llegan (aunque hoy siempre llegan ordenados desde el backend).
  const { firstShow, lastShow } = getTourCityDateRange(shows);

  // Reutiliza groupShowsByCity (mismo agrupador que el Tour Map general)
  // para armar el TourCity que necesita TourMapLoader: como `shows` ya
  // viene filtrado a esta única ciudad (ver getTheWarningTourCityData),
  // devuelve como mucho un elemento. Si la ciudad todavía no tiene
  // latitude/longitude (no geocodificada), groupShowsByCity la descarta y
  // el mapa simplemente no se renderiza.
  const mapCities = groupShowsByCity(shows);

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4">
        <div className="flex flex-col gap-2">
          <TourBreadcrumbs
            level="city"
            artistName={artist.name}
            cityName={city.name}
          />
          <h1>
            <TheWarningLogo height={24} />
          </h1>
          <p className="text-sm text-zinc-400">
            {city.name}, {city.country.name}
          </p>
          <p className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
            {shows.length} {shows.length === 1 ? "show" : "shows"}
          </p>
        </div>
        {firstShow && lastShow && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label="Primer show">
              {formatShowDate(firstShow.date)} · {venueLabel(firstShow.venue)}
            </InfoRow>
            <InfoRow label="Último show">
              {formatShowDate(lastShow.date)} · {venueLabel(lastShow.venue)}
            </InfoRow>
          </div>
        )}
      </header>
      {mapCities.length > 0 && (
        <div className="h-64 w-full border-b border-zinc-800 sm:h-80">
          <TourMapLoader cities={mapCities} />
        </div>
      )}
      <ShowsList shows={shows} />
    </>
  );
}
