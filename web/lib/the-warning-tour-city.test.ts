import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistShow, City } from "./api";

const { getArtists, getArtistShows } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistShows: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistShows }));

const { getTheWarningTourCityData } = await import("./the-warning-tour-city");
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

describe("getTheWarningTourCityData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistShows.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningTourCityData(mendoza.id);

    expect(result).toEqual({ status: "error" });
    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list (without hardcoding its id)", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningTourCityData(mendoza.id);

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("returns an error status when fetching shows fails", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningTourCityData(mendoza.id);

    expect(result).toEqual({ status: "error" });
    expect(getArtistShows).toHaveBeenCalledWith(artist.id);
  });

  it("returns city-not-found when no show matches the given cityId", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([makeShow({ city: buenosAires })]);

    const result = await getTheWarningTourCityData("city-unknown");

    expect(result).toEqual({ status: "city-not-found" });
  });

  it("returns city-not-found when the artist has no shows at all", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([]);

    const result = await getTheWarningTourCityData(mendoza.id);

    expect(result).toEqual({ status: "city-not-found" });
  });

  it("returns ok with the artist, city and its shows when the city has one show", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const show = makeShow({ id: "show-a", city: mendoza });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([show]);

    const result = await getTheWarningTourCityData(mendoza.id);

    expect(result).toEqual({
      status: "ok",
      artist,
      city: {
        id: mendoza.id,
        name: mendoza.name,
        country: { name: mendoza.country.name, code: mendoza.country.code },
      },
      shows: [show],
    });
  });

  it("returns ok with every show for a city with multiple shows, filtering out other cities", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const showA = makeShow({ id: "show-a", city: mendoza });
    const showB = makeShow({ id: "show-b", city: mendoza });
    const showC = makeShow({ id: "show-c", city: buenosAires });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([showA, showB, showC]);

    const result = await getTheWarningTourCityData(mendoza.id);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.shows).toEqual([showA, showB]);
  });

  it("uses the cityId received, not the first city returned by the API", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const showMendoza = makeShow({ id: "show-a", city: mendoza });
    const showBuenosAires = makeShow({ id: "show-b", city: buenosAires });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([showMendoza, showBuenosAires]);

    const result = await getTheWarningTourCityData(buenosAires.id);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.city.id).toBe(buenosAires.id);
    expect(result.shows).toEqual([showBuenosAires]);
  });
});
