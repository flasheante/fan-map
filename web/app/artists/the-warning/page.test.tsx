import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan, ArtistShow, ArtistStats } from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";
import type { TheWarningShowsData } from "@/lib/the-warning-shows";
import type { TheWarningStatsData } from "@/lib/the-warning-stats";

// Se mockean los mismos módulos que ya usa /map, la resolución de shows y la
// de stats (@/lib/the-warning-fan-map, @/lib/the-warning-shows y
// @/lib/the-warning-stats), no @/lib/api directamente para esa lógica: la
// resolución del artista por slug dentro de esas funciones y las llamadas a
// getArtistFans/getArtistShows/getArtistStats con su id ya están cubiertas en
// sus propios tests, sin cambios. Esta página sí llama a getArtists() de
// @/lib/api directamente (una sola vez) para compartir el resultado entre
// las tres, así que ese único límite adicional se mockea acá.
const { getTheWarningMapData } = vi.hoisted(() => ({
  getTheWarningMapData: vi.fn(),
}));
const { getTheWarningShowsData } = vi.hoisted(() => ({
  getTheWarningShowsData: vi.fn(),
}));
const { getTheWarningStatsData } = vi.hoisted(() => ({
  getTheWarningStatsData: vi.fn(),
}));
const { getArtists } = vi.hoisted(() => ({
  getArtists: vi.fn(),
}));

vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));
vi.mock("@/lib/the-warning-shows", () => ({ getTheWarningShowsData }));
vi.mock("@/lib/the-warning-stats", () => ({ getTheWarningStatsData }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getArtists };
});

vi.mock("@/components/map/fan-map-loader", () => ({
  FanMapLoader: ({ fans }: { fans: ArtistFan[] }) => (
    <div data-testid="fan-map-loader">{fans.length} fans on map</div>
  ),
}));

vi.mock("@/components/artists/shows-list", () => ({
  ShowsList: ({ shows }: { shows: ArtistShow[] }) => (
    <div data-testid="shows-list">{shows.length} shows</div>
  ),
}));

vi.mock("@/components/artists/artist-stats", () => ({
  ArtistStatsSummary: ({ stats }: { stats: ArtistStats }) => (
    <div data-testid="artist-stats-summary">
      {stats.fans} fans · {stats.countries} countries · {stats.cities} cities ·{" "}
      {stats.shows} shows · {stats.songs} songs
    </div>
  ),
}));

const { default: TheWarningArtistPage } = await import("./page");

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

function makeFan(id: string): ArtistFan {
  return {
    id,
    displayName: `Fan ${id}`,
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
  };
}

function makeShow(id: string): ArtistShow {
  return {
    id,
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

const defaultShowsData: TheWarningShowsData = {
  status: "ok",
  artist: makeArtist(),
  shows: [],
};
const defaultStatsData: TheWarningStatsData = {
  status: "ok",
  artist: makeArtist(),
  stats: makeStats(),
};

async function renderPage(
  mapData: TheWarningMapData,
  showsData: TheWarningShowsData = defaultShowsData,
  statsData: TheWarningStatsData = defaultStatsData,
  artists: Artist[] = [makeArtist()],
) {
  getArtists.mockResolvedValue(artists);
  getTheWarningMapData.mockResolvedValue(mapData);
  getTheWarningShowsData.mockResolvedValue(showsData);
  getTheWarningStatsData.mockResolvedValue(statsData);
  render(await TheWarningArtistPage());
}

describe("TheWarningArtistPage", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getTheWarningMapData.mockReset();
    getTheWarningShowsData.mockReset();
    getTheWarningStatsData.mockReset();
  });

  it("fetches GET /artists once and shares it with getTheWarningMapData, getTheWarningShowsData and getTheWarningStatsData (not a hardcoded id)", async () => {
    const artists = [makeArtist()];
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "ok", artist: makeArtist(), shows: [] },
      { status: "ok", artist: makeArtist(), stats: makeStats() },
      artists,
    );

    expect(getArtists).toHaveBeenCalledTimes(1);
    expect(getTheWarningMapData).toHaveBeenCalledWith(artists);
    expect(getTheWarningShowsData).toHaveBeenCalledWith(artists);
    expect(getTheWarningStatsData).toHaveBeenCalledWith(artists);
  });

  it("loads the map, the shows and the stats in parallel once the artists are resolved", async () => {
    const artists = [makeArtist()];
    getArtists.mockResolvedValue(artists);
    const order: string[] = [];
    getTheWarningMapData.mockImplementation(async () => {
      order.push("map-start");
      await Promise.resolve();
      order.push("map-end");
      return { status: "ok", artist: makeArtist(), fans: [] };
    });
    getTheWarningShowsData.mockImplementation(async () => {
      order.push("shows-start");
      await Promise.resolve();
      order.push("shows-end");
      return { status: "ok", artist: makeArtist(), shows: [] };
    });
    getTheWarningStatsData.mockImplementation(async () => {
      order.push("stats-start");
      await Promise.resolve();
      order.push("stats-end");
      return { status: "ok", artist: makeArtist(), stats: makeStats() };
    });

    render(await TheWarningArtistPage());

    expect(order).toEqual([
      "map-start",
      "shows-start",
      "stats-start",
      "map-end",
      "shows-end",
      "stats-end",
    ]);
  });

  it("shows an error message when GET /artists fails, without calling getTheWarningMapData, getTheWarningShowsData or getTheWarningStatsData", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    render(await TheWarningArtistPage());

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(getTheWarningMapData).not.toHaveBeenCalled();
    expect(getTheWarningShowsData).not.toHaveBeenCalled();
    expect(getTheWarningStatsData).not.toHaveBeenCalled();
  });

  it("shows an error message when the map data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shows-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
  });

  it("shows an error message when the shows data could not be loaded", async () => {
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "error" },
    );

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shows-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
  });

  it("shows an error message when the stats data could not be loaded", async () => {
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      defaultShowsData,
      { status: "error" },
    );

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shows-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
  });

  it("shows a not-found state when The Warning doesn't exist", async () => {
    await renderPage(
      { status: "artist-not-found" },
      { status: "artist-not-found" },
      { status: "artist-not-found" },
    );

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shows-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
  });

  it("shows the artist name", async () => {
    await renderPage({
      status: "ok",
      artist: makeArtist({ name: "The Warning" }),
      fans: [],
    });

    expect(
      screen.getByRole("heading", { name: "The Warning" }),
    ).toBeInTheDocument();
  });

  it("shows the artist's imageUrl when present", async () => {
    await renderPage({
      status: "ok",
      artist: makeArtist({ imageUrl: "https://example.com/the-warning.jpg" }),
      fans: [],
    });

    expect(screen.getByAltText("The Warning")).toHaveAttribute(
      "src",
      "https://example.com/the-warning.jpg",
    );
  });

  it("doesn't render an image when imageUrl is null", async () => {
    await renderPage({
      status: "ok",
      artist: makeArtist({ imageUrl: null }),
      fans: [],
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the count of visible fans", async () => {
    const fans = [makeFan("fan-1"), makeFan("fan-2")];
    await renderPage({ status: "ok", artist: makeArtist(), fans });

    expect(screen.getByText(/2 fans en el mapa/i)).toBeInTheDocument();
  });

  it("shows the fan map with the loaded fans", async () => {
    const fans = [makeFan("fan-1")];
    await renderPage({ status: "ok", artist: makeArtist(), fans });

    expect(screen.getByTestId("fan-map-loader")).toHaveTextContent(
      "1 fans on map",
    );
  });

  it("shows the shows list with the loaded shows", async () => {
    const shows = [makeShow("show-1"), makeShow("show-2")];
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "ok", artist: makeArtist(), shows },
    );

    expect(screen.getByTestId("shows-list")).toHaveTextContent("2 shows");
  });

  it("shows the artist stats summary with the loaded stats", async () => {
    const stats = makeStats({ fans: 5, countries: 3, cities: 4, shows: 6, songs: 12 });
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      defaultShowsData,
      { status: "ok", artist: makeArtist(), stats },
    );

    expect(screen.getByTestId("artist-stats-summary")).toHaveTextContent(
      "5 fans · 3 countries · 4 cities · 6 shows · 12 songs",
    );
  });

  it("shows the artist stats summary with all-zero values when the artist has no data", async () => {
    const stats = makeStats({ fans: 0, countries: 0, cities: 0, shows: 0, songs: 0 });
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      defaultShowsData,
      { status: "ok", artist: makeArtist(), stats },
    );

    expect(screen.getByTestId("artist-stats-summary")).toHaveTextContent(
      "0 fans · 0 countries · 0 cities · 0 shows · 0 songs",
    );
  });

  it("shows a friendly empty state when there are no fans", async () => {
    await renderPage({
      status: "ok",
      artist: makeArtist({ name: "The Warning" }),
      fans: [],
    });

    expect(screen.getByText(/0 fans en el mapa/i)).toBeInTheDocument();
    expect(
      screen.getByText(/todavía no hay fans.*the warning.*mapa/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("fan-map-loader")).toBeInTheDocument();
  });

  it("renders a working CTA linking to /join", async () => {
    await renderPage({ status: "ok", artist: makeArtist(), fans: [] });

    const cta = screen.getByRole("link", { name: /join the fanmap/i });
    expect(cta).toHaveAttribute("href", "/join");
  });
});
