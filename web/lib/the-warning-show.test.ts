import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Artist, ArtistShow, ShowSetlist } from "./api";

const { getArtists, getArtistShow, getShowSetlist } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  getArtistShow: vi.fn(),
  getShowSetlist: vi.fn(),
}));

vi.mock("./api", () => ({ getArtists, getArtistShow, getShowSetlist }));

const { getTheWarningShowData } = await import("./the-warning-show");
const { THE_WARNING_SLUG } = await import("./the-warning-fan-map");

function makeArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: "artist-1",
    name: "The Warning",
    slug: "the-warning",
    imageUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    setlistsSyncedAt: null,
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

function makeSetlist(overrides: Partial<ShowSetlist> = {}): ShowSetlist {
  return {
    showId: "show-1",
    songs: [{ id: "song-1", position: 1, title: "Choke" }],
    ...overrides,
  };
}

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

describe("getTheWarningShowData", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getArtistShow.mockReset();
    getShowSetlist.mockReset();
  });

  it("returns an error status when fetching artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    const result = await getTheWarningShowData("show-1");

    expect(result).toEqual({ status: "error" });
    expect(getArtistShow).not.toHaveBeenCalled();
  });

  it("returns artist-not-found when the-warning is not in the list", async () => {
    getArtists.mockResolvedValue([makeArtist({ slug: "other-band" })]);

    const result = await getTheWarningShowData("show-1");

    expect(result).toEqual({ status: "artist-not-found" });
    expect(getArtistShow).not.toHaveBeenCalled();
  });

  it("returns show-not-found when the show doesn't exist (404)", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShow.mockRejectedValue(httpError("Failed to fetch show: 404", 404));
    getShowSetlist.mockResolvedValue(makeSetlist());

    const result = await getTheWarningShowData("show-1");

    expect(result).toEqual({ status: "show-not-found" });
  });

  it("returns an error status when fetching the show fails for a reason other than 404", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    getArtists.mockResolvedValue([artist]);
    getArtistShow.mockRejectedValue(new Error("network error"));
    getShowSetlist.mockResolvedValue(makeSetlist());

    const result = await getTheWarningShowData("show-1");

    expect(result).toEqual({ status: "error" });
  });

  it("returns ok with the artist, show and setlist on success", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const show = makeShow();
    const setlist = makeSetlist();
    getArtists.mockResolvedValue([artist]);
    getArtistShow.mockResolvedValue(show);
    getShowSetlist.mockResolvedValue(setlist);

    const result = await getTheWarningShowData(show.id);

    expect(getArtistShow).toHaveBeenCalledWith(artist.id, show.id);
    expect(getShowSetlist).toHaveBeenCalledWith(artist.id, show.id);
    expect(result).toEqual({ status: "ok", artist, show, setlist });
  });

  it("returns ok with an empty songs array when the setlist has no songs yet", async () => {
    const artist = makeArtist({ slug: THE_WARNING_SLUG });
    const show = makeShow();
    const setlist = makeSetlist({ songs: [] });
    getArtists.mockResolvedValue([artist]);
    getArtistShow.mockResolvedValue(show);
    getShowSetlist.mockResolvedValue(setlist);

    const result = await getTheWarningShowData(show.id);

    expect(result).toEqual({ status: "ok", artist, show, setlist });
  });
});
