import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistShow } from "./api";

const { getArtists, getArtistShows } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistShows: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistShows }));

const { getTheWarningShowsData } = await import("./the-warning-shows");
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

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: "show-1",
    date: "2026-06-01T00:00:00.000Z",
    venue: "Foro Sol",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-1",
      name: "Monterrey",
      latitude: 25.6866,
      longitude: -100.3161,
      country: { id: "country-1", name: "Mexico", code: "MX" },
    },
    ...overrides,
  };
}

describe("getTheWarningShowsData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistShows.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningShowsData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningShowsData();

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("returns an error status when fetching shows fails", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningShowsData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistShows).toHaveBeenCalledWith(artist.id);
  });

  it("returns ok with the artist and shows on success", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const shows = [makeShow()];
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue(shows);

    const result = await getTheWarningShowsData();

    expect(result).toEqual({ status: "ok", artist, shows });
  });

  it("returns ok with an empty shows array when the artist has no shows", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShows.mockResolvedValue([]);

    const result = await getTheWarningShowsData();

    expect(result).toEqual({ status: "ok", artist, shows: [] });
  });

  // Página /artists/the-warning: comparte un único GET /artists entre
  // getTheWarningMapData y getTheWarningShowsData en lugar de que cada una
  // lo pida por separado (ver app/artists/the-warning/page.tsx).
  describe("when an artists list is provided", () => {
    it("uses it instead of calling getArtists", async () => {
      const artist = makeArtist({ slug: THE_WARNING_SLUG });
      const shows = [makeShow()];
      getArtistShows.mockResolvedValue(shows);

      const result = await getTheWarningShowsData([artist]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistShows).toHaveBeenCalledWith(artist.id);
      expect(result).toEqual({ status: "ok", artist, shows });
    });

    it("returns artist-not-found from the given list without calling getArtists", async () => {
      const result = await getTheWarningShowsData([
        makeArtist({ slug: "other-band" }),
      ]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistShows).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "artist-not-found" });
    });
  });
});
