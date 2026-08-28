import { City, Country, Show } from '@prisma/client';
import { getTheWarningTourStats, TourShow } from './the-warning-tour-stats';

// Fixtures reuse the exact shape ShowsService already composes from Prisma
// (Show & { city: City & { country: Country } }, see shows.service.ts) —
// same country/city IDs as the seeded catalog (prisma/seed.ts) aren't
// required here since this is a pure function over plain data, but the
// *shape* matches so callers can pass what findAllByArtist() returns
// straight through.

const mexico: Country = { id: 'country-mx', name: 'México', code: 'MX' };
const argentina: Country = { id: 'country-ar', name: 'Argentina', code: 'AR' };
const unitedStates: Country = {
  id: 'country-us',
  name: 'Estados Unidos',
  code: 'US',
};
const brazil: Country = { id: 'country-br', name: 'Brasil', code: 'BR' };

function makeCity(overrides: Partial<City> & { country: Country }): TourShow['city'] {
  const { country, ...cityOverrides } = overrides;
  return {
    id: 'city-1',
    name: 'Mexico City',
    countryId: country.id,
    latitude: null,
    longitude: null,
    ...cityOverrides,
    country,
  };
}

const mexicoCity = makeCity({
  id: 'city-mexico-city',
  name: 'Mexico City',
  country: mexico,
});
const monterrey = makeCity({
  id: 'city-monterrey',
  name: 'Monterrey',
  country: mexico,
});
const losAngeles = makeCity({
  id: 'city-los-angeles',
  name: 'Los Angeles',
  country: unitedStates,
});
const buenosAires = makeCity({
  id: 'city-buenos-aires',
  name: 'Buenos Aires',
  country: argentina,
});
const saoPaulo = makeCity({
  id: 'city-sao-paulo',
  name: 'São Paulo',
  country: brazil,
});

let showSeq = 0;
function makeShow(
  overrides: Partial<Omit<Show, 'city'>> & { city: TourShow['city'] },
): TourShow {
  showSeq += 1;
  return {
    id: `show-${showSeq}`,
    artistId: 'artist-the-warning',
    cityId: overrides.city.id,
    date: new Date('2022-01-01T00:00:00.000Z'),
    venue: 'Some Venue',
    externalId: null,
    createdAt: new Date('2022-01-01T00:00:00.000Z'),
    updatedAt: new Date('2022-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('getTheWarningTourStats', () => {
  // Caso 1 — array vacío: no debe lanzar, y todo lo que no sea un conteo
  // (0) debe ser null / [] — ver el objeto "vacío" documentado en el PR.
  describe('with an empty array', () => {
    it('returns zeroed counts, null highlights and empty collections', () => {
      const result = getTheWarningTourStats([]);

      expect(result).toEqual({
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
      });
    });
  });

  // Caso 2 — un solo show: todo (país/ciudad/año más activo, first/last)
  // debe resolver a ese único show.
  describe('with a single show', () => {
    const show = makeShow({
      city: mexicoCity,
      date: new Date('2022-06-10T00:00:00.000Z'),
      venue: 'Foro Sol',
    });

    it('derives every stat from that one show', () => {
      const result = getTheWarningTourStats([show]);

      expect(result.totalShows).toBe(1);
      expect(result.totalCountries).toBe(1);
      expect(result.totalCities).toBe(1);
      expect(result.totalVenues).toBe(1);
      expect(result.firstShow).toBe(show);
      expect(result.lastShow).toBe(show);
      expect(result.mostActiveCountry).toEqual({
        name: 'México',
        code: 'MX',
        count: 1,
      });
      expect(result.mostActiveCity).toEqual({
        city: 'Mexico City',
        country: 'México',
        count: 1,
      });
      expect(result.mostActiveYear).toEqual({ year: 2022, count: 1 });
      expect(result.showsByYear).toEqual([{ year: 2022, count: 1 }]);
      expect(result.citiesRanking).toEqual([
        { city: 'Mexico City', country: 'México', count: 1 },
      ]);
    });
  });

  // Caso 3 — múltiples shows con países/ciudades/venues repetidos y años
  // distintos: cubre los conteos "reales" (dedup por id, no por texto).
  describe('with multiple shows', () => {
    const showsInOrder = [
      makeShow({
        city: mexicoCity,
        date: new Date('2022-03-01T00:00:00.000Z'),
        venue: 'Foro Sol',
      }),
      makeShow({
        city: mexicoCity,
        date: new Date('2023-04-01T00:00:00.000Z'),
        venue: 'Foro Sol', // mismo venue que el anterior: no debe duplicar el conteo
      }),
      makeShow({
        city: monterrey,
        date: new Date('2023-05-01T00:00:00.000Z'),
        venue: 'Arena Monterrey',
      }),
      makeShow({
        city: losAngeles,
        date: new Date('2024-06-01T00:00:00.000Z'),
        venue: 'The Wiltern',
      }),
    ];

    it('counts totals correctly', () => {
      const result = getTheWarningTourStats(showsInOrder);

      expect(result.totalShows).toBe(4);
      expect(result.totalCountries).toBe(2); // México, Estados Unidos
      expect(result.totalCities).toBe(3); // Mexico City, Monterrey, Los Angeles
      expect(result.totalVenues).toBe(3); // Foro Sol cuenta una sola vez
    });

    it('picks the most active country/city/year', () => {
      const result = getTheWarningTourStats(showsInOrder);

      expect(result.mostActiveCountry).toEqual({
        name: 'México',
        code: 'MX',
        count: 3,
      });
      expect(result.mostActiveCity).toEqual({
        city: 'Mexico City',
        country: 'México',
        count: 2,
      });
      expect(result.mostActiveYear).toEqual({ year: 2023, count: 2 });
    });
  });

  // Caso 4 — fechas desordenadas: firstShow/lastShow deben depender de la
  // fecha real, no de la posición en el array de entrada.
  describe('with shows given out of chronological order', () => {
    const earliest = makeShow({
      city: mexicoCity,
      date: new Date('2022-01-15T00:00:00.000Z'),
    });
    const middle = makeShow({
      city: monterrey,
      date: new Date('2023-06-01T00:00:00.000Z'),
    });
    const latest = makeShow({
      city: losAngeles,
      date: new Date('2024-11-20T00:00:00.000Z'),
    });

    it('finds firstShow and lastShow by date, regardless of input order', () => {
      const shuffled = [middle, latest, earliest];

      const result = getTheWarningTourStats(shuffled);

      expect(result.firstShow).toBe(earliest);
      expect(result.lastShow).toBe(latest);
    });
  });

  // Caso 5 — distribución por año: showsByYear debe tener los conteos
  // correctos y quedar ordenado cronológicamente sin importar el orden de
  // entrada.
  describe('showsByYear', () => {
    it('groups by year and sorts chronologically ascending', () => {
      const shows = [
        makeShow({ city: mexicoCity, date: new Date('2024-02-01T00:00:00.000Z') }),
        makeShow({ city: monterrey, date: new Date('2022-05-01T00:00:00.000Z') }),
        makeShow({ city: mexicoCity, date: new Date('2023-03-01T00:00:00.000Z') }),
        makeShow({ city: losAngeles, date: new Date('2023-09-01T00:00:00.000Z') }),
        makeShow({ city: losAngeles, date: new Date('2024-08-01T00:00:00.000Z') }),
      ];

      const result = getTheWarningTourStats(shows);

      expect(result.showsByYear).toEqual([
        { year: 2022, count: 1 },
        { year: 2023, count: 2 },
        { year: 2024, count: 2 },
      ]);
    });

    // El año se deriva de la fecha en UTC (Show.date se guarda en UTC, ver
    // parseEventDate en setlist-fm-sync.service.ts): un show a las 00:00 UTC
    // del 31 de diciembre no debe "correrse" a otro año si quien corre los
    // tests está en una timezone con offset negativo.
    it('derives the year in UTC, not in the local timezone', () => {
      const newYearsEve = makeShow({
        city: mexicoCity,
        date: new Date('2022-12-31T23:00:00.000Z'),
      });

      const result = getTheWarningTourStats([newYearsEve]);

      expect(result.showsByYear).toEqual([{ year: 2022, count: 1 }]);
    });
  });

  // Caso 6 — ranking de ciudades: orden desc por conteo, país asociado
  // conservado, sin duplicar por nombre repetido en países distintos.
  describe('citiesRanking', () => {
    it('sorts cities by show count descending and keeps their country', () => {
      const shows = [
        makeShow({ city: mexicoCity }),
        makeShow({ city: mexicoCity }),
        makeShow({ city: monterrey }),
        makeShow({ city: losAngeles }),
        makeShow({ city: losAngeles }),
        makeShow({ city: losAngeles }),
      ];

      const result = getTheWarningTourStats(shows);

      expect(result.citiesRanking).toEqual([
        { city: 'Los Angeles', country: 'Estados Unidos', count: 3 },
        { city: 'Mexico City', country: 'México', count: 2 },
        { city: 'Monterrey', country: 'México', count: 1 },
      ]);
    });

    // Dos ciudades con el mismo nombre pero de países (ids) distintos deben
    // seguir siendo dos entradas separadas del ranking, no una sola.
    it('does not merge same-named cities from different countries', () => {
      const santiagoChile = makeCity({
        id: 'city-santiago-cl',
        name: 'Santiago',
        country: { id: 'country-cl', name: 'Chile', code: 'CL' },
      });
      const santiagoMexico = makeCity({
        id: 'city-santiago-mx',
        name: 'Santiago',
        country: mexico,
      });
      const shows = [
        makeShow({ city: santiagoChile }),
        makeShow({ city: santiagoMexico }),
      ];

      const result = getTheWarningTourStats(shows);

      expect(result.totalCities).toBe(2);
      expect(result.citiesRanking).toHaveLength(2);
    });
  });

  // Caso 7 — empates: regla documentada y determinista.
  //   1) mayor cantidad de shows
  //   2) en empate, orden alfabético (por nombre de país/ciudad; para el
  //      año, que no tiene alfabeto, el año más temprano gana — es el
  //      análogo numérico de "primero en el alfabeto").
  describe('deterministic tie-breaks', () => {
    it('breaks a country tie alphabetically by name', () => {
      const shows = [
        makeShow({
          city: makeCity({ id: 'city-br-1', name: 'São Paulo', country: brazil }),
        }),
        makeShow({
          city: makeCity({ id: 'city-br-1', name: 'São Paulo', country: brazil }),
        }),
        makeShow({
          city: makeCity({ id: 'city-ar-1', name: 'Buenos Aires', country: argentina }),
        }),
        makeShow({
          city: makeCity({ id: 'city-ar-1', name: 'Buenos Aires', country: argentina }),
        }),
      ];

      const result = getTheWarningTourStats(shows);

      // Argentina y Brasil empatan en 2 shows cada uno; "Argentina" va
      // primero alfabéticamente.
      expect(result.mostActiveCountry).toEqual({
        name: 'Argentina',
        code: 'AR',
        count: 2,
      });
    });

    it('breaks a city tie alphabetically by city name', () => {
      const shows = [
        makeShow({ city: buenosAires }),
        makeShow({ city: buenosAires }),
        makeShow({ city: saoPaulo }),
        makeShow({ city: saoPaulo }),
      ];

      const result = getTheWarningTourStats(shows);

      expect(result.citiesRanking).toEqual([
        { city: 'Buenos Aires', country: 'Argentina', count: 2 },
        { city: 'São Paulo', country: 'Brasil', count: 2 },
      ]);
      expect(result.mostActiveCity).toEqual({
        city: 'Buenos Aires',
        country: 'Argentina',
        count: 2,
      });
    });

    it('breaks a year tie by picking the earliest year', () => {
      const shows = [
        makeShow({ city: mexicoCity, date: new Date('2023-01-01T00:00:00.000Z') }),
        makeShow({ city: mexicoCity, date: new Date('2023-02-01T00:00:00.000Z') }),
        makeShow({ city: mexicoCity, date: new Date('2022-01-01T00:00:00.000Z') }),
        makeShow({ city: mexicoCity, date: new Date('2022-02-01T00:00:00.000Z') }),
      ];

      const result = getTheWarningTourStats(shows);

      expect(result.mostActiveYear).toEqual({ year: 2022, count: 2 });
    });
  });

  // Caso 8 — no mutación: ni el array ni los shows/city/country originales
  // deben modificarse. Se congelan (Object.freeze) para que cualquier
  // intento de mutación (in-place sort, reasignación de props) tire un
  // TypeError en vez de pasar en silencio.
  describe('immutability', () => {
    it('does not mutate the input array or the show objects it contains', () => {
      const frozenCountry = Object.freeze({ ...mexico });
      const frozenCity = Object.freeze({
        ...mexicoCity,
        country: frozenCountry,
      });
      const shows = [
        Object.freeze(
          makeShow({
            city: frozenCity,
            date: new Date('2023-01-01T00:00:00.000Z'),
          }),
        ),
        Object.freeze(
          makeShow({
            city: frozenCity,
            date: new Date('2022-01-01T00:00:00.000Z'),
          }),
        ),
      ];
      const frozenShows = Object.freeze([...shows]);
      const snapshot = JSON.parse(JSON.stringify(frozenShows));

      expect(() => getTheWarningTourStats(frozenShows)).not.toThrow();
      expect(JSON.parse(JSON.stringify(frozenShows))).toEqual(snapshot);
    });
  });
});
