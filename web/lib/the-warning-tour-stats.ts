import type { ArtistShow, Country } from "./api";

// País/ciudad con más shows, junto con el conteo que los hizo ganar (ver
// calculateTourStats). topCountry ya *es* el país (id/name/code) más
// showCount; topCity conserva el Country completo de su ciudad, no la
// versión recortada {name, code} que usa TourCity (the-warning-tour-map.ts)
// para el mapa.
export interface TopCountry extends Country {
  showCount: number;
}

export interface TopCity {
  id: string;
  name: string;
  country: Country;
  showCount: number;
}

export interface TourStats {
  totalShows: number;
  totalCities: number;
  totalCountries: number;
  firstShow: ArtistShow | null;
  lastShow: ArtistShow | null;
  topCountry: TopCountry | null;
  topCity: TopCity | null;
}

function findFirstAndLastShow(shows: ArtistShow[]): {
  firstShow: ArtistShow | null;
  lastShow: ArtistShow | null;
} {
  if (shows.length === 0) {
    return { firstShow: null, lastShow: null };
  }

  // [...shows] copia el array antes de ordenar: calculateTourStats no debe
  // mutar la colección que le pasó el caller (ver
  // the-warning-tour-stats.test.ts, "does not mutate the original array").
  const byDateAsc = [...shows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return { firstShow: byDateAsc[0], lastShow: byDateAsc[byDateAsc.length - 1] };
}

// Desempate alfabético por nombre cuando dos entradas tienen el mismo
// showCount (ver calculateTourStats): showCount desc, nombre asc.
function byShowCountThenName<T extends { name: string; showCount: number }>(
  a: T,
  b: T,
): number {
  if (b.showCount !== a.showCount) return b.showCount - a.showCount;
  return a.name.localeCompare(b.name);
}

function findTopCountry(shows: ArtistShow[]): TopCountry | null {
  if (shows.length === 0) return null;

  const byId = new Map<string, TopCountry>();
  for (const show of shows) {
    const { country } = show.city;
    const existing = byId.get(country.id);
    if (existing) {
      existing.showCount += 1;
    } else {
      byId.set(country.id, { ...country, showCount: 1 });
    }
  }

  return Array.from(byId.values()).sort(byShowCountThenName)[0];
}

function findTopCity(shows: ArtistShow[]): TopCity | null {
  if (shows.length === 0) return null;

  const byId = new Map<string, TopCity>();
  for (const show of shows) {
    const { city } = show;
    const existing = byId.get(city.id);
    if (existing) {
      existing.showCount += 1;
    } else {
      byId.set(city.id, {
        id: city.id,
        name: city.name,
        country: city.country,
        showCount: 1,
      });
    }
  }

  return Array.from(byId.values()).sort(byShowCountThenName)[0];
}

// Función pura: no hace fetch, sólo deriva estadísticas de una colección de
// shows ya resuelta (ver getTheWarningTourStatsData / tour/page.tsx, que la
// alimenta con el mismo `shows` que devuelve getTheWarningTourMapData, sin
// un segundo GET /artists/:artistId/shows). Ciudades y países se cuentan
// por id (city.id / city.country.id), nunca por nombre: dos ciudades con el
// mismo nombre pero distinto id cuentan como dos.
export function calculateTourStats(shows: ArtistShow[]): TourStats {
  const cityIds = new Set(shows.map((show) => show.city.id));
  const countryIds = new Set(shows.map((show) => show.city.country.id));
  const { firstShow, lastShow } = findFirstAndLastShow(shows);

  return {
    totalShows: shows.length,
    totalCities: cityIds.size,
    totalCountries: countryIds.size,
    firstShow,
    lastShow,
    topCountry: findTopCountry(shows),
    topCity: findTopCity(shows),
  };
}

// Punto de entrada que usa la página (ver tour/page.tsx): recibe los shows
// ya resueltos (no hace ningún fetch) para mantener el mismo patrón de
// nombres que el resto de web/lib (getTheWarningXxxData), aunque acá no hay
// estados de error/artist-not-found porque no depende de la red.
export function getTheWarningTourStatsData(shows: ArtistShow[]): TourStats {
  return calculateTourStats(shows);
}
