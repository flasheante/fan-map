import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistFan } from "./api";

const { getArtists, getArtistFans } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistFans: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistFans }));

const { findArtistBySlug, getTheWarningMapData, THE_WARNING_SLUG } =
  await import("./the-warning-fan-map");

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

function makeFan(overrides: Partial<ArtistFan> = {}): ArtistFan {
  return {
    id: "fan-1",
    displayName: "Fan One",
    showOnMap: true,
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

describe("findArtistBySlug", () => {
  it("returns the artist whose slug matches", () => {
    const theWarning = makeArtist({ id: "a1", slug: "the-warning" });
    const other = makeArtist({ id: "a2", slug: "other-band", name: "Other" });

    expect(findArtistBySlug([other, theWarning], "the-warning")).toBe(
      theWarning,
    );
  });

  it("returns undefined when no artist matches", () => {
    const other = makeArtist({ id: "a2", slug: "other-band" });

    expect(findArtistBySlug([other], "the-warning")).toBeUndefined();
  });
});

describe("getTheWarningMapData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistFans.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningMapData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistFans).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningMapData();

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistFans).not.toHaveBeenCalled();
  });

  it("returns an error status when fetching fans fails", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistFans.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningMapData();

    expect(result).toEqual({ status: "error" });
    expect(getArtistFans).toHaveBeenCalledWith(artist.id);
  });

  it("returns ok with the artist and fans on success", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const fans = [makeFan()];
    getArtists.mockResolvedValue([artist]);
    getArtistFans.mockResolvedValue({ artist, fans });

    const result = await getTheWarningMapData();

    expect(result).toEqual({ status: "ok", artist, fans });
  });

  it("returns ok with an empty fans array when the artist has no visible fans", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistFans.mockResolvedValue({ artist, fans: [] });

    const result = await getTheWarningMapData();

    expect(result).toEqual({ status: "ok", artist, fans: [] });
  });

  // Página /artists/the-warning: comparte un único GET /artists entre
  // getTheWarningMapData y getTheWarningShowsData en lugar de que cada una
  // lo pida por separado (ver app/artists/the-warning/page.tsx).
  describe("when an artists list is provided", () => {
    it("uses it instead of calling getArtists", async () => {
      const artist = makeArtist({ slug: THE_WARNING_SLUG });
      const fans = [makeFan()];
      getArtistFans.mockResolvedValue({ artist, fans });

      const result = await getTheWarningMapData([artist]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistFans).toHaveBeenCalledWith(artist.id);
      expect(result).toEqual({ status: "ok", artist, fans });
    });

    it("returns artist-not-found from the given list without calling getArtists", async () => {
      const result = await getTheWarningMapData([
        makeArtist({ slug: "other-band" }),
      ]);

      expect(getArtists).not.toHaveBeenCalled();
      expect(getArtistFans).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "artist-not-found" });
    });
  });
});
