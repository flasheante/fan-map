import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFanProfile,
  getArtistFans,
  getArtistShow,
  getArtistShows,
  getArtistStats,
  getArtistTopSongs,
  getArtists,
  getCities,
  getCountries,
  getCurrentUser,
  getMyFanProfile,
  getShowSetlist,
  googleLoginUrl,
  logout,
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

describe("getArtistStats", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists/:artistId/stats and returns the parsed stats", async () => {
    const stats = { fans: 3, countries: 2, cities: 2, shows: 4, songs: 10 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(stats));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtistStats("artist-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists\/artist-1\/stats$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(stats);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArtistStats("missing-id")).rejects.toThrow(/404/);
  });
});

describe("getArtistTopSongs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /artists/:artistId/stats/songs and returns the parsed list", async () => {
    const topSongs = [
      { title: "S!CK", timesPlayed: 42 },
      { title: "MORE", timesPlayed: 38 },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(topSongs));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtistTopSongs("artist-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/artists\/artist-1\/stats\/songs$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual(topSongs);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArtistTopSongs("missing-id")).rejects.toThrow(/404/);
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

  // Etapa 3: ya no lleva email — el User se resuelve server-side de la
  // cookie de sesión (ver SessionAuthGuard/request.user.id en la API).
  const input = {
    displayName: "Fan One",
    cityId: "city-1",
    showOnMap: true,
    artistIds: ["artist-1"],
  };

  it("posts to /fan-profiles with the given payload (no email), sending session credentials", async () => {
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
        credentials: "include",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      }),
    );
    expect(result).toEqual(created);
  });

  it("does not send an email field, even if present on the input object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await createFanProfile({ ...input, email: "sneaky@example.com" } as never);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody).not.toHaveProperty("email");
  });

  it("throws with the API error message when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { statusCode: 409, message: "User already has a fan profile" },
        false,
        409,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(/already has a fan profile/);
  });

  it("joins array error messages returned by validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { statusCode: 400, message: ["cityId must be a UUID", "displayName should not be empty"] },
        false,
        400,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(
      /cityId must be a UUID, displayName should not be empty/,
    );
  });

  it("falls back to a generic error when the API doesn't return a message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(/500/);
  });

  it("throws when the response is 401 (no valid session)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ statusCode: 401, message: "Unauthorized" }, false, 401),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFanProfile(input)).rejects.toThrow(/Unauthorized/);
  });
});

describe("getCurrentUser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /auth/me with credentials and returns the current user when the response is 200", async () => {
    const user = { id: "user-1", email: "fan@example.com" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(user));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/me$/),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
    expect(result).toEqual(user);
  });

  it("returns null when the response is 401 (no session)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("throws for a real API error, without silencing it as unauthenticated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).rejects.toThrow(/500/);
  });
});

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /auth/logout with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/logout$/),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).rejects.toThrow(/500/);
  });
});

describe("googleLoginUrl", () => {
  it("points at GET /auth/google on the API origin", () => {
    expect(googleLoginUrl()).toMatch(/\/auth\/google$/);
  });
});

describe("getMyFanProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches GET /fan-profiles/me with credentials and returns the profile when the response is 200", async () => {
    const profile = {
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
      artists: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(profile));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyFanProfile();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/fan-profiles\/me$/),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
    expect(result).toEqual(profile);
  });

  it("returns null when the response is 404 (authenticated but no fan profile yet)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyFanProfile();

    expect(result).toBeNull();
  });

  it("returns null when the response is 401 (no session)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyFanProfile();

    expect(result).toBeNull();
  });

  it("throws for a real API error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMyFanProfile()).rejects.toThrow(/500/);
  });
});
