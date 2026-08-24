import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistTopSong } from "./api";

const { getArtists, getArtistTopSongs } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistTopSongs: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistTopSongs }));

const { getTheWarningTopSongsData } = await import("./the-warning-top-songs");
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

function makeTopSongs(): ArtistTopSong[] {
  return [
    { title: "S!CK", timesPlayed: 42 },
    { title: "MORE", timesPlayed: 38 },
  ];
}

describe("getTheWarningTopSongsData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistTopSongs.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningTopSongsData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistTopSongs).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningTopSongsData();

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistTopSongs).not.toHaveBeenCalled();
  });

  it("returns an error status when fetching top songs fails", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistTopSongs.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningTopSongsData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistTopSongs).toHaveBeenCalledWith(artist.id);
  });

  it("returns ok with the artist and top songs on success", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const topSongs = makeTopSongs();
    getArtists.mockResolvedValue([artist]);
    getArtistTopSongs.mockResolvedValue(topSongs);

    const result = await getTheWarningTopSongsData();

    expect(result).toEqual({ status: "ok", artist, topSongs });
  });

  it("returns ok with an empty list when the artist has no songs", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistTopSongs.mockResolvedValue([]);

    const result = await getTheWarningTopSongsData();

    expect(result).toEqual({ status: "ok", artist, topSongs: [] });
  });

  // Página /artists/the-warning: comparte un único GET /artists entre
  // getTheWarningMapData, getTheWarningShowsData, getTheWarningStatsData y
  // getTheWarningTopSongsData en lugar de que cada una lo pida por separado
  // (ver app/artists/the-warning/page.tsx).
  describe("when an artists list is provided", () => {
    it("uses it instead of calling getArtists", async () => {
      const artist = makeArtist({ slug: THE_WARNING_SLUG });
      const topSongs = makeTopSongs();
      getArtistTopSongs.mockResolvedValue(topSongs);

      const result = await getTheWarningTopSongsData([artist]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistTopSongs).toHaveBeenCalledWith(artist.id);
      expect(result).toEqual({ status: "ok", artist, topSongs });
    });

    it("returns artist-not-found from the given list without calling getArtists", async () => {
      const result = await getTheWarningTopSongsData([
        makeArtist({ slug: "other-band" }),
      ]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistTopSongs).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "artist-not-found" });
    });
  });
});
