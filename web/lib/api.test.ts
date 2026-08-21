import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFanProfile,
  getArtistFans,
  getArtistShow,
  getArtistShows,
  getArtists,
  getCities,
  getCountries,
  getShowSetlist,
} from "./api";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("getArtists", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists and returns the parsed list", async () => {
    const artists = [
      {
        id: "artist-1",
        name: "The Warning",
        slug: "the-warning",
        imageUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(artists));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtists();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(artists);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArtists()).rejects.toThrow(/500/);
  });
});

describe("getArtistFans", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists/:artistId/fans?onMap=true and returns artist + fans", async () => {
    const body = {
      artist: {
        id: "artist-1",
        name: "The Warning",
        slug: "the-warning",
        imageUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      fans: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtistFans("artist-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists\/artist-1\/fans\?onMap=true$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(body);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArtistFans("missing-id")).rejects.toThrow(/404/);
  });
});

describe("getArtistShows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists/:artistId/shows and returns the parsed list", async () => {
    const shows = [
      {
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
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(shows));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtistShows("artist-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists\/artist-1\/shows$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(shows);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArtistShows("missing-id")).rejects.toThrow(/404/);
  });
});

describe("getArtistShow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists/:artistId/shows/:showId and returns the parsed show", async () => {
    const show = {
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
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(show));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtistShow("artist-1", "show-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists\/artist-1\/shows\/show-1$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(show);
  });

  it("throws an error carrying the HTTP status when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArtistShow("artist-1", "missing-show")).rejects.toThrow(/404/);

    let caught: unknown;
    try {
      await getArtistShow("artist-1", "missing-show");
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ status: 404 });
  });
});

describe("getShowSetlist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists/:artistId/shows/:showId/setlist and returns the parsed setlist", async () => {
    const setlist = {
      showId: "show-1",
      songs: [{ id: "song-1", position: 1, title: "Choke" }],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(setlist));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getShowSetlist("artist-1", "show-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists\/artist-1\/shows\/show-1\/setlist$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(setlist);
  });

  it("throws an error carrying the HTTP status when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await getShowSetlist("artist-1", "missing-show");
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ status: 404 });
  });
});

describe("getCountries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /countries and returns the parsed list", async () => {
    const countries = [
      { id: "country-1", name: "Mexico", code: "MX" },
      { id: "country-2", name: "Spain", code: "ES" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(countries));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCountries();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/countries$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(countries);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCountries()).rejects.toThrow(/500/);
  });
});

describe("getCities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /countries/:countryId/cities and returns the parsed list", async () => {
    const cities = [
      { id: "city-1", name: "Monterrey", countryId: "country-1" },
      { id: "city-2", name: "Ciudad de México", countryId: "country-1" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(cities));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCities("country-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/countries\/country-1\/cities$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(cities);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCities("missing")).rejects.toThrow(/404/);
  });
});

describe("createFanProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input = {
    email: "fan@example.com",
    displayName: "Fan One",
    cityId: "city-1",
    showOnMap: true,
    artistIds: ["artist-1"],
  };

  it("posts to /fan-profiles with the given payload and returns the created profile", async () => {
    const created = {
      id: "profile-1",
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
      artists: [
        { id: "artist-1", name: "The Warning", slug: "the-warning", imageUrl: null },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(created));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createFanProfile(input);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/fan-profiles$/),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      }),
    );
    expect(result).toEqual(created);
  });

  it("throws with the API error message when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { statusCode: 409, message: "Email fan@example.com is already in use" },
        false,
        409,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(/already in use/);
  });

  it("joins array error messages returned by validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { statusCode: 400, message: ["email must be an email", "displayName should not be empty"] },
        false,
        400,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(
      /email must be an email, displayName should not be empty/,
    );
  });

  it("falls back to a generic error when the API doesn't return a message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(/500/);
  });
});
