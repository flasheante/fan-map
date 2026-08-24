import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistShow, City } from "./api";

const { getArtists, getArtistShows } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistShows: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistShows }));

const { getTheWarningTourMapData, groupShowsByCity, getTourCityDateRange } =
  await import("./the-warning-tour-map");
const { THE_WARNING_SLUG } = await import("./the-warning-fan-map");

function makeArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: "artist-1",
    name: "The Warning",
    slug: "the-warning",
    imageUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const mendoza: City = {
  id: "city-mendoza",
  name: "Mendoza",
  latitude: -32.8895,
  longitude: -68.8458,
  country: { id: "country-ar", name: "Argentina", code: "AR" },
};

const buenosAires: City = {
  id: "city-ba",
  name: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  country: { id: "country-ar", name: "Argentina", code: "AR" },
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

describe("groupShowsByCity", () => {
  it("returns an empty array when there are no shows", () => {
    expect(groupShowsByCity([])).toEqual([]);
  });

  it("groups multiple shows in the same city (by city.id) into a single entry", () => {
    const showA = makeShow({ id: "show-a", city: mendoza });
    const showB = makeShow({ id: "show-b", city: mendoza });

    const cities = groupShowsByCity([showA, showB]);

    expect(cities).toHaveLength(1);
    expect(cities[0]).toEqual({
      id: "city-mendoza",
      name: "Mendoza",
      latitude: -32.8895,
      longitude: -68.8458,
      country: { name: "Argentina", code: "AR" },
      shows: [showA, showB],
    });
  });

  it("keeps different cities as separate entries", () => {
    const showMendoza = makeShow({ id: "show-a", city: mendoza });
    const showBuenosAires = makeShow({ id: "show-b", city: buenosAires });

    const cities = groupShowsByCity([showMendoza, showBuenosAires]);

    expect(cities).toHaveLength(2);
    expect(cities.map((city) => city.name).sort()).toEqual([
      "Buenos Aires",
      "Mendoza",
    ]);
  });

  it("does not merge different cities that share the same name (groups by city.id, not name)", () => {
    const cityA: City = { ...mendoza, id: "city-a", name: "Springfield" };
    const cityB: City = { ...buenosAires, id: "city-b", name: "Springfield" };
    const showA = makeShow({ id: "show-a", city: cityA });
    const showB = makeShow({ id: "show-b", city: cityB });

    const cities = groupShowsByCity([showA, showB]);

    expect(cities).toHaveLength(2);
    expect(cities.map((city) => city.id).sort()).toEqual(["city-a", "city-b"]);
  });

  it("excludes cities without latitude/longitude", () => {
    const cityWithoutCoords: City = {
      ...mendoza,
      id: "city-no-coords",
      latitude: null as unknown as number,
      longitude: null as unknown as number,
    };
    const show = makeShow({ city: cityWithoutCoords });

    expect(groupShowsByCity([show])).toEqual([]);
  });

  it("keeps cities with coordinates while excluding those without, from the same list", () => {
    const cityWithoutCoords: City = {
      ...buenosAires,
      id: "city-no-coords",
      latitude: undefined as unknown as number,
      longitude: undefined as unknown as number,
    };
    const showWithCoords = makeShow({ id: "show-a", city: mendoza });
    const showWithoutCoords = makeShow({ id: "show-b", city: cityWithoutCoords });

    const cities = groupShowsByCity([showWithCoords, showWithoutCoords]);

    expect(cities).toHaveLength(1);
    expect(cities[0].id).toBe("city-mendoza");
  });
});

describe("getTourCityDateRange", () => {
  it("returns null firstShow/lastShow for a city without shows", () => {
    expect(getTourCityDateRange([])).toEqual({
      firstShow: null,
      lastShow: null,
    });
  });

  it("returns the same show as firstShow and lastShow for a city with one show", () => {
    const show = makeShow({ id: "show-a", date: "2026-08-15T00:00:00.000Z" });

    expect(getTourCityDateRange([show])).toEqual({
      firstShow: show,
      lastShow: show,
    });
  });

  it("returns the earlier show as firstShow and the later as lastShow for two shows", () => {
    const earlier = makeShow({ id: "show-a", date: "2024-03-15T00:00:00.000Z" });
    const later = makeShow({ id: "show-b", date: "2026-08-20T00:00:00.000Z" });

    expect(getTourCityDateRange([earlier, later])).toEqual({
      firstShow: earlier,
      lastShow: later,
    });
  });

  it("sorts multiple shows chronologically even when given out of order", () => {
    const middle = makeShow({ id: "show-mid", date: "2025-01-10T00:00:00.000Z" });
    const latest = makeShow({ id: "show-latest", date: "2026-08-20T00:00:00.000Z" });
    const earliest = makeShow({ id: "show-earliest", date: "2024-03-15T00:00:00.000Z" });

    const result = getTourCityDateRange([middle, latest, earliest]);

    expect(result.firstShow).toEqual(earliest);
    expect(result.lastShow).toEqual(latest);
  });

  it("does not mutate the original array", () => {
    const latest = makeShow({ id: "show-latest", date: "2026-08-20T00:00:00.000Z" });
    const earliest = makeShow({ id: "show-earliest", date: "2024-03-15T00:00:00.000Z" });
    const shows = [latest, earliest];
    const original = [...shows];

    getTourCityDateRange(shows);

    expect(shows).toEqual(original);
  });
});

describe("getTheWarningTourMapData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistShows.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningTourMapData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningTourMapData();

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("returns an error status when fetching shows fails", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningTourMapData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistShows).toHaveBeenCalledWith(artist.id);
  });

  it("returns ok with the artist and shows grouped by city on success", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const showA = makeShow({ id: "show-a", city: mendoza });
    const showB = makeShow({ id: "show-b", city: mendoza });
    const showC = makeShow({ id: "show-c", city: buenosAires });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([showA, showB, showC]);

    const result = await getTheWarningTourMapData();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.artist).toEqual(artist);
    expect(result.cities).toHaveLength(2);
    const mendozaCity = result.cities.find((city) => city.id === "city-mendoza");
    expect(mendozaCity?.shows).toEqual([showA, showB]);
  });

  // La página /artists/the-warning/tour necesita los shows sin agrupar
  // (ver the-warning-tour-stats.ts) para calcular estadísticas sin volver a
  // pedir GET /artists/:artistId/shows: el resultado "ok" expone la misma
  // colección que ya se usó para construir `cities`.
  it("includes the raw, ungrouped shows list alongside the grouped cities", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const showA = makeShow({ id: "show-a", city: mendoza });
    const showB = makeShow({ id: "show-b", city: buenosAires });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([showA, showB]);

    const result = await getTheWarningTourMapData();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.shows).toEqual([showA, showB]);
  });

  it("returns ok with an empty cities array when the artist has no shows", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([]);

    const result = await getTheWarningTourMapData();

    expect(result).toEqual({ status: "ok", artist, cities: [], shows: [] });
  });

  it("returns ok with an empty cities array when no show has a city with coordinates", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const cityWithoutCoords: City = {
      ...mendoza,
      latitude: null as unknown as number,
      longitude: null as unknown as number,
    };
    getArtists.mockResolvedValue([artist]);
    const showWithoutCoords = makeShow({ city: cityWithoutCoords });
    getArtistShows.mockResolvedValue([showWithoutCoords]);

    const result = await getTheWarningTourMapData();

    // Las estadísticas deben poder contar este show aunque su ciudad no
    // tenga coordenadas y por eso quede fuera de `cities` (ver
    // groupShowsByCity), así que `shows` sigue incluyéndolo.
    expect(result).toEqual({
      status: "ok",
      artist,
      cities: [],
      shows: [showWithoutCoords],
    });
  });

  // Página /artists/the-warning/tour: comparte un único GET /artists con el
  // resto de páginas de The Warning en lugar de pedirlo por separado.
  describe("when an artists list is provided", () => {
    it("uses it instead of calling getArtists", async () => {
      const artist = makeArtist({ slug: THE_WARNING_SLUG });
      const show = makeShow({ city: mendoza });
      getArtistShows.mockResolvedValue([show]);

      const result = await getTheWarningTourMapData([artist]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistShows).toHaveBeenCalledWith(artist.id);
      expect(result).toEqual({
        status: "ok",
        artist,
        cities: [
          {
            id: mendoza.id,
            name: mendoza.name,
            latitude: mendoza.latitude,
            longitude: mendoza.longitude,
            country: { name: mendoza.country.name, code: mendoza.country.code },
            shows: [show],
          },
        ],
        shows: [show],
      });
    });

    it("returns artist-not-found from the given list without calling getArtists", async () => {
      const result = await getTheWarningTourMapData([
        makeArtist({ slug: "other-band" }),
      ]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistShows).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "artist-not-found" });
    });
  });
});
