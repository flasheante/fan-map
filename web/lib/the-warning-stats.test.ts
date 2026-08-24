import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistStats } from "./api";

const { getArtists, getArtistStats } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistStats: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistStats }));

const { getTheWarningStatsData } = await import("./the-warning-stats");
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

function makeStats(overrides: Partial<ArtistStats> = {}): ArtistStats {
  return {
    fans: 3,
    countries: 2,
    cities: 2,
    shows: 4,
    songs: 10,
    ...overrides,
  };
}

describe("getTheWarningStatsData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistStats.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningStatsData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistStats).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningStatsData();

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistStats).not.toHaveBeenCalled();
  });

  it("returns an error status when fetching stats fails", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistStats.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningStatsData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistStats).toHaveBeenCalledWith(artist.id);
  });

  it("returns ok with the artist and stats on success", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const stats = makeStats();
    getArtists.mockResolvedValue([artist]);
    getArtistStats.mockResolvedValue(stats);

    const result = await getTheWarningStatsData();

    expect(result).toEqual({ status: "ok", artist, stats });
  });

  it("returns ok with all-zero stats when the artist has no data", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const stats = makeStats({ fans: 0, countries: 0, cities: 0, shows: 0, songs: 0 });
    getArtists.mockResolvedValue([artist]);
    getArtistStats.mockResolvedValue(stats);

    const result = await getTheWarningStatsData();

    expect(result).toEqual({ status: "ok", artist, stats });
  });

  // Página /artists/the-warning: comparte un único GET /artists entre
  // getTheWarningMapData, getTheWarningShowsData y getTheWarningStatsData en
  // lugar de que cada una lo pida por separado (ver
  // app/artists/the-warning/page.tsx).
  describe("when an artists list is provided", () => {
    it("uses it instead of calling getArtists", async () => {
      const artist = makeArtist({ slug: THE_WARNING_SLUG });
      const stats = makeStats();
      getArtistStats.mockResolvedValue(stats);

      const result = await getTheWarningStatsData([artist]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistStats).toHaveBeenCalledWith(artist.id);
      expect(result).toEqual({ status: "ok", artist, stats });
    });

    it("returns artist-not-found from the given list without calling getArtists", async () => {
      const result = await getTheWarningStatsData([
        makeArtist({ slug: "other-band" }),
      ]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistStats).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "artist-not-found" });
    });
  });
});
