import { getArtistShows, getArtists, type Artist, type ArtistShow } from "./api";
import { findArtistBySlug, THE_WARNING_SLUG } from "./the-warning-fan-map";

// Una ciudad agrupada para el Tour Map: conserva sólo lo que el marcador y
// su popup necesitan (ver groupShowsByCity), no el shape completo de City.
export interface TourCity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: { name: string; code: string };
  shows: ArtistShow[];
}

export type TheWarningTourMapData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "ok"; artist: Artist; cities: TourCity[]; shows: ArtistShow[] };

// Agrupa los shows por city.id (no por nombre, ver slice): varios shows en
// la misma ciudad producen un único marcador con todos sus shows. Descarta
// las ciudades sin latitude/longitude: aunque el tipo City las declara
// number, en la base son nullable (ver prisma/schema.prisma) para ciudades
// todavía no geocodificadas.
export function groupShowsByCity(shows: ArtistShow[]): TourCity[] {
  const citiesById = new Map<string, TourCity>();

  for (const show of shows) {
    const { city } = show;
    if (typeof city.latitude !== "number" || typeof city.longitude !== "number") {
      continue;
    }

    const existing = citiesById.get(city.id);
    if (existing) {
      existing.shows.push(show);
      continue;
    }

    citiesById.set(city.id, {
      id: city.id,
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      country: { name: city.country.name, code: city.country.code },
      shows: [show],
    });
  }

  return Array.from(citiesById.values());
}

export interface TourCityDateRange {
  firstShow: ArtistShow | null;
  lastShow: ArtistShow | null;
}

// Analogía de findFirstAndLastShow en the-warning-tour-stats.ts, pero a
// nivel de una única ciudad (TourCity.shows) en lugar del historial
// completo del artista: el popup del Tour Map la usa para mostrar el rango
// de fechas y el último show de esa ciudad sin pedir nada al backend (ver
// tour-map.tsx). [...shows] copia el array antes de ordenar: no debe mutar
// la colección que le pasó el caller (ver el test "does not mutate the
// original array").
export function getTourCityDateRange(shows: ArtistShow[]): TourCityDateRange {
  if (shows.length === 0) {
    return { firstShow: null, lastShow: null };
  }

  const byDateAsc = [...shows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return { firstShow: byDateAsc[0], lastShow: byDateAsc[byDateAsc.length - 1] };
}

// Mismo flujo que getTheWarningShowsData: GET /artists, ubicar "the-warning"
// por slug (sin hardcodear su UUID, reutilizando THE_WARNING_SLUG /
// findArtistBySlug) y luego GET /artists/:artistId/shows, agrupando el
// resultado por ciudad con groupShowsByCity. El resultado "ok" también
// expone `shows` sin agrupar: tour/page.tsx lo reutiliza para calcular
// estadísticas (calculateTourStats, en the-warning-tour-stats.ts) sin un
// segundo GET /artists/:artistId/shows.
//
// `artists` es opcional: si se pasa (ver app/artists/the-warning/page.tsx),
// se usa tal cual en lugar de volver a pedirlo.
export async function getTheWarningTourMapData(
  artists?: Artist[],
): Promise<TheWarningTourMapData> {
  let resolvedArtists: Artist[];
  if (artists) {
    resolvedArtists = artists;
  } else {
    try {
      resolvedArtists = await getArtists();
    } catch {
      return { status: "error" };
    }
  }

  const artist = findArtistBySlug(resolvedArtists, THE_WARNING_SLUG);
  if (!artist) {
    return { status: "artist-not-found" };
  }

  try {
    const shows = await getArtistShows(artist.id);
    return { status: "ok", artist, cities: groupShowsByCity(shows), shows };
  } catch {
    return { status: "error" };
  }
}
