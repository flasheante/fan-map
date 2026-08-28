import { describe, expect, it } from "vitest";
import type { ArtistShow, City, Country } from "./api";
import { calculateTourStats, getTheWarningTourStatsData } from "./the-warning-tour-stats";

const argentina: Country = { id: "country-ar", name: "Argentina", code: "AR" };
const mexico: Country = { id: "country-mx", name: "Mexico", code: "MX" };
const chile: Country = { id: "country-cl", name: "Chile", code: "CL" };

const mendoza: City = {
  id: "city-mendoza",
  name: "Mendoza",
  latitude: -32.8895,
  longitude: -68.8458,
  country: argentina,
};

const buenosAires: City = {
  id: "city-ba",
  name: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  country: argentina,
};

const monterrey: City = {
  id: "city-mty",
  name: "Monterrey",
  latitude: 25.6866,
  longitude: -100.3161,
  country: mexico,
};

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: "show-1",
    date: "2024-03-15T00:00:00.000Z",
    venue: "Demo Venue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: mendoza,
    ...overrides,
  };
}

describe("calculateTourStats", () => {
  it("returns zeroed counts and null fields for an empty list", () => {
    expect(calculateTourStats([])).toEqual({
      totalShows: 0,
      totalCities: 0,
      totalCountries: 0,
      totalVenues: 0,
      firstShow: null,
      lastShow: null,
      topCountry: null,
      topCity: null,
      topYear: null,
      showsByYear: [],
      citiesRanking: [],
    });
  });

  it("computes every stat for a single show", () => {
    const show = makeShow({ id: "show-1", city: mendoza, venue: "Arena Malvinas" });

    expect(calculateTourStats([show])).toEqual({
      totalShows: 1,
      totalCities: 1,
      totalCountries: 1,
      totalVenues: 1,
      firstShow: show,
      lastShow: show,
      topCountry: { id: argentina.id, name: argentina.name, code: argentina.code, showCount: 1 },
      topCity: { id: mendoza.id, name: mendoza.name, country: argentina, showCount: 1 },
      topYear: { year: 2024, showCount: 1 },
      showsByYear: [{ year: 2024, showCount: 1 }],
      citiesRanking: [{ id: mendoza.id, name: mendoza.name, country: argentina, showCount: 1 }],
    });
  });

  it("counts every show across multiple cities and countries", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: buenosAires }),
      makeShow({ id: "show-3", city: monterrey }),
    ];

    expect(calculateTourStats(shows).totalShows).toBe(3);
  });

  it("counts repeated cities (same city.id) only once", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: mendoza }),
      makeShow({ id: "show-3", city: buenosAires }),
    ];

    expect(calculateTourStats(shows).totalCities).toBe(2);
  });

  it("counts repeated countries (same city.country.id) only once", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: buenosAires }),
      makeShow({ id: "show-3", city: monterrey }),
    ];

    expect(calculateTourStats(shows).totalCountries).toBe(2);
  });

  describe("totalVenues", () => {
    it("counts distinct venue names only once", () => {
      const shows = [
        makeShow({ id: "show-1", venue: "Arena Monterrey" }),
        makeShow({ id: "show-2", venue: "Arena Monterrey" }), // repetido
        makeShow({ id: "show-3", venue: "Foro Sol" }),
      ];

      expect(calculateTourStats(shows).totalVenues).toBe(2);
    });

    it("does not count a null or blank venue", () => {
      const shows = [
        makeShow({ id: "show-1", venue: null }),
        makeShow({ id: "show-2", venue: "   " }),
        makeShow({ id: "show-3", venue: "Foro Sol" }),
      ];

      expect(calculateTourStats(shows).totalVenues).toBe(1);
    });
  });

  it("finds the first show by date, regardless of array order", () => {
    const earliest = makeShow({ id: "show-early", date: "2018-03-12T00:00:00.000Z", city: monterrey });
    const middle = makeShow({ id: "show-mid", date: "2022-06-01T00:00:00.000Z", city: mendoza });
    const latest = makeShow({ id: "show-late", date: "2026-08-15T00:00:00.000Z", city: buenosAires });

    const result = calculateTourStats([middle, latest, earliest]);

    expect(result.firstShow).toEqual(earliest);
  });

  it("finds the last show by date, regardless of array order", () => {
    const earliest = makeShow({ id: "show-early", date: "2018-03-12T00:00:00.000Z", city: monterrey });
    const middle = makeShow({ id: "show-mid", date: "2022-06-01T00:00:00.000Z", city: mendoza });
    const latest = makeShow({ id: "show-late", date: "2026-08-15T00:00:00.000Z", city: buenosAires });

    const result = calculateTourStats([middle, latest, earliest]);

    expect(result.lastShow).toEqual(latest);
  });

  it("finds the country with the most shows", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }), // Argentina
      makeShow({ id: "show-2", city: buenosAires }), // Argentina
      makeShow({ id: "show-3", city: monterrey }), // Mexico
    ];

    const result = calculateTourStats(shows);

    expect(result.topCountry).toEqual({
      id: argentina.id,
      name: argentina.name,
      code: argentina.code,
      showCount: 2,
    });
  });

  it("finds the city with the most shows", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: mendoza }),
      makeShow({ id: "show-3", city: buenosAires }),
    ];

    const result = calculateTourStats(shows);

    expect(result.topCity).toEqual({
      id: mendoza.id,
      name: mendoza.name,
      country: argentina,
      showCount: 2,
    });
  });

  it("breaks a country show-count tie alphabetically by name", () => {
    const shows = [
      makeShow({ id: "show-1", city: monterrey }), // Mexico
      makeShow({ id: "show-2", city: mendoza }), // Argentina
    ];

    const result = calculateTourStats(shows);

    // "Argentina" < "Mexico" alfabéticamente, aunque Mexico aparezca primero en el array.
    expect(result.topCountry).toEqual({
      id: argentina.id,
      name: argentina.name,
      code: argentina.code,
      showCount: 1,
    });
  });

  it("breaks a city show-count tie alphabetically by name", () => {
    const shows = [
      makeShow({ id: "show-1", city: monterrey }), // Monterrey
      makeShow({ id: "show-2", city: buenosAires }), // Buenos Aires
    ];

    const result = calculateTourStats(shows);

    // "Buenos Aires" < "Monterrey" alfabéticamente, aunque Monterrey aparezca primero.
    expect(result.topCity).toEqual({
      id: buenosAires.id,
      name: buenosAires.name,
      country: argentina,
      showCount: 1,
    });
  });

  it("treats cities with the same name but different city.id as distinct", () => {
    const springfieldA: City = { ...mendoza, id: "city-a", name: "Springfield" };
    const springfieldB: City = { ...buenosAires, id: "city-b", name: "Springfield" };
    const shows = [
      makeShow({ id: "show-1", city: springfieldA }),
      makeShow({ id: "show-2", city: springfieldB }),
    ];

    const result = calculateTourStats(shows);

    expect(result.totalCities).toBe(2);
  });

  describe("showsByYear", () => {
    it("groups by year and sorts chronologically ascending regardless of input order", () => {
      const shows = [
        makeShow({ id: "show-1", date: "2024-02-01T00:00:00.000Z" }),
        makeShow({ id: "show-2", date: "2022-05-01T00:00:00.000Z" }),
        makeShow({ id: "show-3", date: "2023-03-01T00:00:00.000Z" }),
        makeShow({ id: "show-4", date: "2023-09-01T00:00:00.000Z" }),
      ];

      const result = calculateTourStats(shows);

      expect(result.showsByYear).toEqual([
        { year: 2022, showCount: 1 },
        { year: 2023, showCount: 2 },
        { year: 2024, showCount: 1 },
      ]);
    });

    // show.date llega como medianoche UTC (ver tour-stats.tsx / dateFormatter):
    // el año se deriva en UTC para no correrse de año según la timezone del
    // navegador/proceso que ejecuta el cálculo.
    it("derives the year in UTC, not in the local timezone", () => {
      const newYearsEve = makeShow({
        id: "show-1",
        date: "2022-12-31T23:00:00.000Z",
      });

      const result = calculateTourStats([newYearsEve]);

      expect(result.showsByYear).toEqual([{ year: 2022, showCount: 1 }]);
    });
  });

  describe("topYear", () => {
    it("picks the year with the most shows", () => {
      const shows = [
        makeShow({ id: "show-1", date: "2022-01-01T00:00:00.000Z" }),
        makeShow({ id: "show-2", date: "2023-01-01T00:00:00.000Z" }),
        makeShow({ id: "show-3", date: "2023-06-01T00:00:00.000Z" }),
      ];

      expect(calculateTourStats(shows).topYear).toEqual({
        year: 2023,
        showCount: 2,
      });
    });

    // El año no tiene alfabeto: el desempate análogo a "orden alfabético"
    // es el año más temprano.
    it("breaks a year show-count tie by picking the earliest year", () => {
      const shows = [
        makeShow({ id: "show-1", date: "2023-01-01T00:00:00.000Z" }),
        makeShow({ id: "show-2", date: "2023-02-01T00:00:00.000Z" }),
        makeShow({ id: "show-3", date: "2022-01-01T00:00:00.000Z" }),
        makeShow({ id: "show-4", date: "2022-02-01T00:00:00.000Z" }),
      ];

      expect(calculateTourStats(shows).topYear).toEqual({
        year: 2022,
        showCount: 2,
      });
    });
  });

  describe("citiesRanking", () => {
    it("sorts cities by show count descending, keeping their country", () => {
      const shows = [
        makeShow({ id: "show-1", city: mendoza }),
        makeShow({ id: "show-2", city: mendoza }),
        makeShow({ id: "show-3", city: buenosAires }),
      ];

      const result = calculateTourStats(shows);

      expect(result.citiesRanking).toEqual([
        { id: mendoza.id, name: mendoza.name, country: argentina, showCount: 2 },
        { id: buenosAires.id, name: buenosAires.name, country: argentina, showCount: 1 },
      ]);
    });

    it("breaks a tie alphabetically by city name", () => {
      const shows = [
        makeShow({ id: "show-1", city: monterrey }),
        makeShow({ id: "show-2", city: buenosAires }),
      ];

      const result = calculateTourStats(shows);

      expect(result.citiesRanking).toEqual([
        { id: buenosAires.id, name: buenosAires.name, country: argentina, showCount: 1 },
        { id: monterrey.id, name: monterrey.name, country: mexico, showCount: 1 },
      ]);
    });

    it("does not merge same-named cities from different countries", () => {
      const santiagoChile: City = { ...mendoza, id: "city-santiago-cl", name: "Santiago", country: chile };
      const santiagoMexico: City = { ...mendoza, id: "city-santiago-mx", name: "Santiago", country: mexico };
      const shows = [
        makeShow({ id: "show-1", city: santiagoChile }),
        makeShow({ id: "show-2", city: santiagoMexico }),
      ];

      const result = calculateTourStats(shows);

      expect(result.citiesRanking).toHaveLength(2);
      expect(result.totalCities).toBe(2);
    });

    it("is exactly [topCity] when there is only one city", () => {
      const shows = [makeShow({ id: "show-1", city: mendoza })];

      const result = calculateTourStats(shows);

      expect(result.citiesRanking).toEqual([result.topCity]);
    });
  });

  it("does not mutate the original shows array", () => {
    const shows = [
      makeShow({ id: "show-late", date: "2026-08-15T00:00:00.000Z" }),
      makeShow({ id: "show-early", date: "2018-03-12T00:00:00.000Z" }),
    ];
    const original = [...shows];

    calculateTourStats(shows);

    expect(shows).toEqual(original);
    expect(shows.map((show) => show.id)).toEqual(["show-late", "show-early"]);
  });
});

describe("getTheWarningTourStatsData", () => {
  it("returns the same stats calculateTourStats would compute for the given shows", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: buenosAires }),
    ];

    expect(getTheWarningTourStatsData(shows)).toEqual(calculateTourStats(shows));
  });

  it("returns zeroed stats for an empty list", () => {
    expect(getTheWarningTourStatsData([])).toEqual(calculateTourStats([]));
  });
});
