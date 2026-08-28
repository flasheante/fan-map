import { City, Country, Show } from '@prisma/client';

// Same composition ShowsService already builds from Prisma (see
// shows.service.ts: `Show & { city: City & { country: Country } }`) — reused
// here as its own type alias, not imported, so this module has zero runtime
// dependency on Prisma/NestJS: only the Prisma-generated model *types* are
// used, purely for shape, never `@prisma/client`'s PrismaClient itself.
export type TourShow = Show & { city: City & { country: Country } };

export interface YearCount {
  year: number;
  count: number;
}

export interface CityRankingEntry {
  city: string;
  country: string;
  count: number;
}

export interface CountryRankingEntry {
  name: string;
  code: string;
  count: number;
}

export interface TheWarningTourStats {
  totalShows: number;
  totalCountries: number;
  totalCities: number;
  totalVenues: number;
  firstShow: TourShow | null;
  lastShow: TourShow | null;
  mostActiveCountry: CountryRankingEntry | null;
  mostActiveCity: CityRankingEntry | null;
  mostActiveYear: YearCount | null;
  showsByYear: YearCount[];
  citiesRanking: CityRankingEntry[];
}

const EMPTY_STATS: TheWarningTourStats = {
  totalShows: 0,
  totalCountries: 0,
  totalCities: 0,
  totalVenues: 0,
  firstShow: null,
  lastShow: null,
  mostActiveCountry: null,
  mostActiveCity: null,
  mostActiveYear: null,
  showsByYear: [],
  citiesRanking: [],
};

// Desempate determinista y documentado (ver the-warning-tour-stats.spec.ts,
// "deterministic tie-breaks"): 1) mayor conteo, 2) en empate, orden
// ascendente por `key` (alfabético para nombres de país/ciudad; numérico
// para el año, que es el análogo de "alfabético" cuando no hay letras).
function byCountDescThenKeyAsc<T extends { count: number }>(
  key: (item: T) => string | number,
) {
  return (a: T, b: T): number => {
    if (b.count !== a.count) return b.count - a.count;
    const [ka, kb] = [key(a), key(b)];
    if (typeof ka === 'number' && typeof kb === 'number') return ka - kb;
    return String(ka).localeCompare(String(kb));
  };
}

// Estadísticas agregadas del historial de shows de The Warning. Función
// pura: no hace fetch, no toca Prisma/NestJS, no muta su entrada — sólo
// deriva datos de la colección de shows que ya tenemos disponible (el mismo
// shape que devuelve ShowsService.findAllByArtist, ver TourShow arriba).
//
// País y ciudad se agrupan por id (country.id / city.id), nunca por texto:
// dos ciudades con el mismo nombre pero id distinto (p.ej. "Santiago" en
// Chile y en México, ambas en el catálogo sembrado) cuentan por separado.
// El año se deriva de la fecha en UTC (Show.date se persiste en UTC, ver
// parseEventDate en setlist-fm-sync.service.ts) para no depender de la
// timezone donde corre el proceso. "Venue" se cuenta por texto (no hay un
// catálogo de Venue en el dominio todavía): un venue null o vacío no suma.
export function getTheWarningTourStats(
  shows: readonly TourShow[],
): TheWarningTourStats {
  if (shows.length === 0) {
    return EMPTY_STATS;
  }

  const byDateAsc = [...shows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const firstShow = byDateAsc[0];
  const lastShow = byDateAsc[byDateAsc.length - 1];

  const countryCounts = new Map<string, CountryRankingEntry>();
  const cityCounts = new Map<string, CityRankingEntry>();
  const yearCounts = new Map<number, number>();
  const venues = new Set<string>();

  for (const show of shows) {
    const { country } = show.city;

    const countryEntry = countryCounts.get(country.id);
    if (countryEntry) {
      countryEntry.count += 1;
    } else {
      countryCounts.set(country.id, {
        name: country.name,
        code: country.code,
        count: 1,
      });
    }

    const cityEntry = cityCounts.get(show.city.id);
    if (cityEntry) {
      cityEntry.count += 1;
    } else {
      cityCounts.set(show.city.id, {
        city: show.city.name,
        country: country.name,
        count: 1,
      });
    }

    const year = show.date.getUTCFullYear();
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);

    const venue = show.venue?.trim();
    if (venue) venues.add(venue);
  }

  const countriesRanking = [...countryCounts.values()].sort(
    byCountDescThenKeyAsc((c) => c.name),
  );
  const citiesRanking = [...cityCounts.values()].sort(
    byCountDescThenKeyAsc((c) => c.city),
  );
  const showsByYear = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
  const [mostActiveYear] = [...showsByYear].sort(
    byCountDescThenKeyAsc((y) => y.year),
  );

  return {
    totalShows: shows.length,
    totalCountries: countryCounts.size,
    totalCities: cityCounts.size,
    totalVenues: venues.size,
    firstShow,
    lastShow,
    mostActiveCountry: countriesRanking[0],
    mostActiveCity: citiesRanking[0],
    mostActiveYear,
    showsByYear,
    citiesRanking,
  };
}
