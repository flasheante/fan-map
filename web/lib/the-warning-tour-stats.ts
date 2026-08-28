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

export interface YearCount {
  year: number;
  showCount: number;
}

export interface TourStats {
  totalShows: number;
  totalCities: number;
  totalCountries: number;
  totalVenues: number;
  firstShow: ArtistShow | null;
  lastShow: ArtistShow | null;
  topCountry: TopCountry | null;
  topCity: TopCity | null;
  topYear: YearCount | null;
  showsByYear: YearCount[];
  citiesRanking: TopCity[];
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

// Desempate determinista y documentado (ver
// the-warning-tour-stats.test.ts): 1) mayor showCount, 2) en empate, orden
// ascendente por `key` — alfabético para nombres de país/ciudad, numérico
// para el año (que no tiene alfabeto: el más temprano es su análogo).
function byShowCountThenKey<T extends { showCount: number }>(
  key: (item: T) => string | number,
) {
  return (a: T, b: T): number => {
    if (b.showCount !== a.showCount) return b.showCount - a.showCount;
    const [ka, kb] = [key(a), key(b)];
    if (typeof ka === "number" && typeof kb === "number") return ka - kb;
    return String(ka).localeCompare(String(kb));
  };
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

  return Array.from(byId.values()).sort(byShowCountThenKey((c) => c.name))[0];
}

// Ranking completo de ciudades por show count desc (ver
// the-warning-tour-stats.test.ts, describe "citiesRanking"): topCity es
// simplemente su primer elemento. Se agrupa por city.id, no por nombre: dos
// ciudades homónimas de países distintos (p.ej. "Santiago" en Chile y en
// México, ambas en el catálogo sembrado de la API) cuentan por separado.
function findCitiesRanking(shows: ArtistShow[]): TopCity[] {
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

  return Array.from(byId.values()).sort(byShowCountThenKey((c) => c.name));
}

// Cuenta venues distintos por texto (trim, ignora null/vacío): el dominio
// todavía no tiene un catálogo de Venue propio (ver Show.venue en
// prisma/schema.prisma), así que es un best-effort sobre el nombre tal cual
// llega de setlist.fm.
function findTotalVenues(shows: ArtistShow[]): number {
  const venues = new Set<string>();
  for (const show of shows) {
    const venue = show.venue?.trim();
    if (venue) venues.add(venue);
  }
  return venues.size;
}

// show.date llega como medianoche UTC (ver tour-stats.tsx / dateFormatter,
// mismo criterio ahí): el año se deriva en UTC para no correrse de año
// según la timezone del navegador/proceso que hace el cálculo.
function findShowsByYear(shows: ArtistShow[]): YearCount[] {
  const byYear = new Map<number, number>();
  for (const show of shows) {
    const year = new Date(show.date).getUTCFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
  }

  return Array.from(byYear.entries())
    .map(([year, showCount]) => ({ year, showCount }))
    .sort((a, b) => a.year - b.year);
}

function findTopYear(showsByYear: YearCount[]): YearCount | null {
  if (showsByYear.length === 0) return null;
  return [...showsByYear].sort(byShowCountThenKey((y) => y.year))[0];
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
  const citiesRanking = findCitiesRanking(shows);
  const showsByYear = findShowsByYear(shows);

  return {
    totalShows: shows.length,
    totalCities: cityIds.size,
    totalCountries: countryIds.size,
    totalVenues: findTotalVenues(shows),
    firstShow,
    lastShow,
    topCountry: findTopCountry(shows),
    topCity: citiesRanking[0] ?? null,
    topYear: findTopYear(showsByYear),
    showsByYear,
    citiesRanking,
  };
}

// Punto de entrada que usa la página (ver tour/page.tsx): recibe los shows
// ya resueltos (no hace ningún fetch) para mantener el mismo patrón de
// nombres que el resto de web/lib (getTheWarningXxxData), aunque acá no hay
// estados de error/artist-not-found porque no depende de la red.
export function getTheWarningTourStatsData(shows: ArtistShow[]): TourStats {
  return calculateTourStats(shows);
}
