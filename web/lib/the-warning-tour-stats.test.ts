import { describe, expect, it } from "vitest";
import type { ArtistShow, City, Country } from "./api";
import { calculateTourStats, getTheWarningTourStatsData } from "./the-warning-tour-stats";

const argentina: Country = { id: "country-ar", name: "Argentina", code: "AR" };
const mexico: Country = { id: "country-mx", name: "Mexico", code: "MX" };

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
      firstShow: null,
      lastShow: null,
      topCountry: null,
      topCity: null,
    });
  });

  it("computes every stat for a single show", () => {
    const show = makeShow({ id: "show-1", city: mendoza });

    expect(calculateTourStats([show])).toEqual({
      totalShows: 1,
      totalCities: 1,
      totalCountries: 1,
      firstShow: show,
      lastShow: show,
      topCountry: { id: argentina.id, name: argentina.name, code: argentina.code, showCount: 1 },
      topCity: { id: mendoza.id, name: mendoza.name, country: argentina, showCount: 1 },
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
