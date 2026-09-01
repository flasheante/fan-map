import { describe, expect, it } from "vitest";
import type { ArtistShow, City, Country } from "./api";
import {
  filterTourShows,
  getAvailableCities,
  getAvailableCountries,
  getAvailableYears,
  type TourFilters,
} from "./tour-filters";

const argentina: Country = { id: "country-ar", name: "Argentina", code: "AR" };
const mexico: Country = { id: "country-mx", name: "México", code: "MX" };

const mendoza: City = {
  id: "city-mendoza",
  name: "Mendoza",
  latitude: -32.8895,
  longitude: -68.8458,
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
    venue: "Pepsi Center",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: mendoza,
    ...overrides,
  };
}

describe("filterTourShows", () => {
  it("returns every show unchanged when no filters are given", () => {
    const shows = [makeShow({ id: "show-1" }), makeShow({ id: "show-2" })];

    expect(filterTourShows(shows, {})).toEqual(shows);
  });

  it("returns every show unchanged when all filter fields are undefined", () => {
    const shows = [makeShow({ id: "show-1" })];
    const filters: TourFilters = {
      search: undefined,
      year: undefined,
      countryId: undefined,
      cityId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    };

    expect(filterTourShows(shows, filters)).toEqual(shows);
  });

  it("does not mutate the original shows array", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: monterrey }),
    ];
    const original = [...shows];

    filterTourShows(shows, { cityId: mendoza.id });

    expect(shows).toEqual(original);
  });

  describe("year", () => {
    it("keeps only shows in the given year (derived in UTC)", () => {
      const shows = [
        makeShow({ id: "show-2023", date: "2023-06-01T00:00:00.000Z" }),
        makeShow({ id: "show-2024", date: "2024-06-01T00:00:00.000Z" }),
      ];

      const result = filterTourShows(shows, { year: 2024 });

      expect(result.map((show) => show.id)).toEqual(["show-2024"]);
    });

    it("derives the year in UTC, not in the local timezone", () => {
      const newYearsEve = makeShow({
        id: "show-1",
        date: "2022-12-31T23:00:00.000Z",
      });

      expect(filterTourShows([newYearsEve], { year: 2022 })).toEqual([newYearsEve]);
      expect(filterTourShows([newYearsEve], { year: 2023 })).toEqual([]);
    });
  });

  describe("countryId", () => {
    it("keeps only shows whose city belongs to the given country", () => {
      const shows = [
        makeShow({ id: "show-ar", city: mendoza }),
        makeShow({ id: "show-mx", city: monterrey }),
      ];

      const result = filterTourShows(shows, { countryId: mexico.id });

      expect(result.map((show) => show.id)).toEqual(["show-mx"]);
    });
  });

  describe("cityId", () => {
    it("keeps only shows in the given city", () => {
      const shows = [
        makeShow({ id: "show-mendoza", city: mendoza }),
        makeShow({ id: "show-monterrey", city: monterrey }),
      ];

      const result = filterTourShows(shows, { cityId: monterrey.id });

      expect(result.map((show) => show.id)).toEqual(["show-monterrey"]);
    });
  });

  describe("dateFrom / dateTo", () => {
    const early = makeShow({ id: "show-early", date: "2020-01-01T00:00:00.000Z" });
    const middle = makeShow({ id: "show-mid", date: "2023-06-15T00:00:00.000Z" });
    const late = makeShow({ id: "show-late", date: "2026-08-15T00:00:00.000Z" });
    const shows = [early, middle, late];

    it("keeps only shows on or after dateFrom", () => {
      const result = filterTourShows(shows, { dateFrom: "2023-01-01" });
      expect(result.map((show) => show.id)).toEqual(["show-mid", "show-late"]);
    });

    it("keeps only shows on or before dateTo", () => {
      const result = filterTourShows(shows, { dateTo: "2023-12-31" });
      expect(result.map((show) => show.id)).toEqual(["show-early", "show-mid"]);
    });

    it("combines dateFrom and dateTo into an inclusive range", () => {
      const result = filterTourShows(shows, {
        dateFrom: "2023-01-01",
        dateTo: "2023-12-31",
      });
      expect(result.map((show) => show.id)).toEqual(["show-mid"]);
    });

    it("includes a show that falls exactly on dateFrom", () => {
      const result = filterTourShows([middle], { dateFrom: "2023-06-15" });
      expect(result).toEqual([middle]);
    });
  });

  describe("search", () => {
    it("matches by city name", () => {
      const shows = [
        makeShow({ id: "show-mendoza", city: mendoza }),
        makeShow({ id: "show-monterrey", city: monterrey }),
      ];

      expect(
        filterTourShows(shows, { search: "Monterrey" }).map((s) => s.id),
      ).toEqual(["show-monterrey"]);
    });

    it("matches by country name", () => {
      const shows = [
        makeShow({ id: "show-mendoza", city: mendoza }),
        makeShow({ id: "show-monterrey", city: monterrey }),
      ];

      expect(
        filterTourShows(shows, { search: "México" }).map((s) => s.id),
      ).toEqual(["show-monterrey"]);
    });

    it("matches by venue", () => {
      const shows = [
        makeShow({ id: "show-1", venue: "Pepsi Center" }),
        makeShow({ id: "show-2", venue: "Foro Sol" }),
      ];

      expect(
        filterTourShows(shows, { search: "Pepsi Center" }).map((s) => s.id),
      ).toEqual(["show-1"]);
    });

    it("matches by year as text", () => {
      const shows = [
        makeShow({ id: "show-2023", date: "2023-06-01T00:00:00.000Z" }),
        makeShow({ id: "show-2024", date: "2024-06-01T00:00:00.000Z" }),
      ];

      expect(
        filterTourShows(shows, { search: "2024" }).map((s) => s.id),
      ).toEqual(["show-2024"]);
    });

    it("is case-insensitive", () => {
      const shows = [makeShow({ id: "show-1", city: monterrey })];

      expect(filterTourShows(shows, { search: "monterrey" })).toEqual(shows);
      expect(filterTourShows(shows, { search: "MONTERREY" })).toEqual(shows);
    });

    it("is tolerant to surrounding whitespace", () => {
      const shows = [makeShow({ id: "show-1", city: monterrey })];

      expect(filterTourShows(shows, { search: "  Monterrey  " })).toEqual(shows);
    });

    it("is tolerant to accents on both sides (query and data)", () => {
      const shows = [makeShow({ id: "show-1", city: monterrey })]; // country name "México"

      expect(filterTourShows(shows, { search: "Mexico" })).toEqual(shows);
      expect(filterTourShows(shows, { search: "México" })).toEqual(shows);
    });

    it("treats an empty or blank search as no filter", () => {
      const shows = [makeShow({ id: "show-1" }), makeShow({ id: "show-2" })];

      expect(filterTourShows(shows, { search: "" })).toEqual(shows);
      expect(filterTourShows(shows, { search: "   " })).toEqual(shows);
    });

    it("returns no shows when nothing matches", () => {
      const shows = [makeShow({ id: "show-1", city: mendoza })];

      expect(filterTourShows(shows, { search: "Nonexistent" })).toEqual([]);
    });

    it("does not require the venue to search by city", () => {
      const shows = [makeShow({ id: "show-1", city: mendoza, venue: null })];

      expect(filterTourShows(shows, { search: "Mendoza" })).toEqual(shows);
    });
  });

  describe("combined filters", () => {
    it("applies every provided filter with AND semantics", () => {
      const shows = [
        makeShow({ id: "show-mty-2024", city: monterrey, date: "2024-05-01T00:00:00.000Z" }),
        makeShow({ id: "show-mty-2023", city: monterrey, date: "2023-05-01T00:00:00.000Z" }),
        makeShow({ id: "show-mza-2024", city: mendoza, date: "2024-05-01T00:00:00.000Z" }),
      ];

      const result = filterTourShows(shows, {
        countryId: mexico.id,
        year: 2024,
      });

      expect(result.map((show) => show.id)).toEqual(["show-mty-2024"]);
    });

    it("combines text search with structured filters", () => {
      const shows = [
        makeShow({ id: "show-1", city: monterrey, venue: "Pepsi Center" }),
        makeShow({ id: "show-2", city: monterrey, venue: "Foro Sol" }),
      ];

      const result = filterTourShows(shows, {
        search: "Pepsi",
        countryId: mexico.id,
      });

      expect(result.map((show) => show.id)).toEqual(["show-1"]);
    });

    it("returns an empty array when combined filters match nothing", () => {
      const shows = [makeShow({ id: "show-1", city: mendoza })];

      const result = filterTourShows(shows, {
        countryId: mendoza.country.id,
        cityId: monterrey.id,
      });

      expect(result).toEqual([]);
    });
  });
});

// Catálogos para los selectores del panel de filtros (ver
// components/artists/tour-filters.tsx): siempre se derivan de la colección
// completa de shows (allShows), nunca de los ya filtrados, para que
// cambiar de filtro no le esconda al usuario opciones todavía disponibles
// (ver TourFiltersPanel: "no quedar atrapado en una combinación imposible").
describe("getAvailableYears", () => {
  it("returns an empty array for no shows", () => {
    expect(getAvailableYears([])).toEqual([]);
  });

  it("returns the distinct years sorted ascending, regardless of input order", () => {
    const shows = [
      makeShow({ id: "show-1", date: "2024-02-01T00:00:00.000Z" }),
      makeShow({ id: "show-2", date: "2022-05-01T00:00:00.000Z" }),
      makeShow({ id: "show-3", date: "2024-09-01T00:00:00.000Z" }), // mismo año que show-1
    ];

    expect(getAvailableYears(shows)).toEqual([2022, 2024]);
  });

  it("derives the year in UTC, not in the local timezone", () => {
    const newYearsEve = makeShow({ id: "show-1", date: "2022-12-31T23:00:00.000Z" });

    expect(getAvailableYears([newYearsEve])).toEqual([2022]);
  });
});

describe("getAvailableCountries", () => {
  it("returns an empty array for no shows", () => {
    expect(getAvailableCountries([])).toEqual([]);
  });

  it("returns each country once (by country.id), sorted by name", () => {
    const shows = [
      makeShow({ id: "show-1", city: monterrey }), // México
      makeShow({ id: "show-2", city: mendoza }), // Argentina
      makeShow({ id: "show-3", city: monterrey }), // México, repetido
    ];

    expect(getAvailableCountries(shows)).toEqual([argentina, mexico]);
  });
});

describe("getAvailableCities", () => {
  it("returns an empty array for no shows", () => {
    expect(getAvailableCities([])).toEqual([]);
  });

  it("returns each city once (by city.id), with its country name for display", () => {
    const shows = [
      makeShow({ id: "show-1", city: mendoza }),
      makeShow({ id: "show-2", city: mendoza }), // repetido
      makeShow({ id: "show-3", city: monterrey }),
    ];

    const cities = getAvailableCities(shows);

    expect(cities).toEqual([
      { id: mendoza.id, name: mendoza.name, countryId: argentina.id, countryName: argentina.name },
      { id: monterrey.id, name: monterrey.name, countryId: mexico.id, countryName: mexico.name },
    ]);
  });

  it("keeps same-named cities from different countries as distinct entries", () => {
    const santiagoChile: City = {
      ...mendoza,
      id: "city-santiago-cl",
      name: "Santiago",
      country: { id: "country-cl", name: "Chile", code: "CL" },
    };
    const santiagoMexico: City = {
      ...mendoza,
      id: "city-santiago-mx",
      name: "Santiago",
      country: mexico,
    };
    const shows = [
      makeShow({ id: "show-1", city: santiagoChile }),
      makeShow({ id: "show-2", city: santiagoMexico }),
    ];

    const cities = getAvailableCities(shows);

    expect(cities).toHaveLength(2);
    expect(cities.map((c) => c.id).sort()).toEqual(["city-santiago-cl", "city-santiago-mx"]);
    expect(cities.every((c) => c.name === "Santiago")).toBe(true);
    expect(cities.map((c) => c.countryName).sort()).toEqual(["Chile", "México"]);
  });

  it("sorts by city name, then by country name to break ties", () => {
    const santiagoChile: City = {
      ...mendoza,
      id: "city-santiago-cl",
      name: "Santiago",
      country: { id: "country-cl", name: "Chile", code: "CL" },
    };
    const santiagoMexico: City = {
      ...mendoza,
      id: "city-santiago-mx",
      name: "Santiago",
      country: mexico,
    };
    const shows = [
      makeShow({ id: "show-1", city: monterrey }),
      makeShow({ id: "show-2", city: santiagoMexico }),
      makeShow({ id: "show-3", city: santiagoChile }),
    ];

    const cities = getAvailableCities(shows);

    expect(cities.map((c) => `${c.name}, ${c.countryName}`)).toEqual([
      "Monterrey, México",
      "Santiago, Chile",
      "Santiago, México",
    ]);
  });
});
