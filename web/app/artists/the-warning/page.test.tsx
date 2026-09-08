import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  Artist,
  ArtistFan,
  ArtistShow,
  ArtistStats,
  ArtistTopSong,
} from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";
import type { TheWarningShowsData } from "@/lib/the-warning-shows";
import type { TheWarningStatsData } from "@/lib/the-warning-stats";
import type { TheWarningTopSongsData } from "@/lib/the-warning-top-songs";

// Se mockean los mismos módulos que ya usa /map, la resolución de shows, la
// de stats y la de top songs (@/lib/the-warning-fan-map,
// @/lib/the-warning-shows, @/lib/the-warning-stats y
// @/lib/the-warning-top-songs), no @/lib/api directamente para esa lógica: la
// resolución del artista por slug dentro de esas funciones y las llamadas a
// getArtistFans/getArtistShows/getArtistStats/getArtistTopSongs con su id ya
// están cubiertas en sus propios tests, sin cambios. Esta página sí llama a
// getArtists() de @/lib/api directamente (una sola vez) para compartir el
// resultado entre las cuatro, así que ese único límite adicional se mockea
// acá.
const { getTheWarningMapData } = vi.hoisted(() => ({
  getTheWarningMapData: vi.fn(),
}));
const { getTheWarningShowsData } = vi.hoisted(() => ({
  getTheWarningShowsData: vi.fn(),
}));
const { getTheWarningStatsData } = vi.hoisted(() => ({
  getTheWarningStatsData: vi.fn(),
}));
const { getTheWarningTopSongsData } = vi.hoisted(() => ({
  getTheWarningTopSongsData: vi.fn(),
}));
const { getArtists } = vi.hoisted(() => ({
  getArtists: vi.fn(),
}));
// JoinOrProfileLink (el CTA "Join the FanMap"/"Profile" del header) usa
// useAuth() — se mockea acá igual que en join-flow.test.tsx, nunca se
// prueba la lógica de auth-provider en sí misma desde acá.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));
vi.mock("@/lib/the-warning-shows", () => ({ getTheWarningShowsData }));
vi.mock("@/lib/the-warning-stats", () => ({ getTheWarningStatsData }));
vi.mock("@/lib/the-warning-top-songs", () => ({ getTheWarningTopSongsData }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getArtists };
});
vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));

// Etapa G: el cuerpo del mapa ya no es FanMapLoader ni un <ShowsList>
// aparte — es TourExplorer (el mismo que /artists/the-warning/tour y la
// vista "tour" de /map), así que se mockea igual que en esos otros tests
// (tour-explorer.test.tsx, app/map/page.test.tsx) para aislar esta página
// de su implementación interna.
vi.mock("@/components/artists/tour-explorer", () => ({
  TourExplorer: ({ artist, shows }: { artist: Artist; shows: ArtistShow[] }) => (
    <div data-testid="tour-explorer">
      {artist.name} / {shows.length} shows
    </div>
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

vi.mock("@/components/artists/top-songs", () => ({
  TopSongs: ({ topSongs }: { topSongs: ArtistTopSong[] }) => (
    <div data-testid="top-songs">{topSongs.length} top songs</div>
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

function makeTopSongs(): ArtistTopSong[] {
  return [
    { title: "S!CK", timesPlayed: 42 },
    { title: "MORE", timesPlayed: 38 },
  ];
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
const defaultTopSongsData: TheWarningTopSongsData = {
  status: "ok",
  artist: makeArtist(),
  topSongs: [],
};

async function renderPage(
  mapData: TheWarningMapData,
  showsData: TheWarningShowsData = defaultShowsData,
  statsData: TheWarningStatsData = defaultStatsData,
  topSongsData: TheWarningTopSongsData = defaultTopSongsData,
  artists: Artist[] = [makeArtist()],
) {
  getArtists.mockResolvedValue(artists);
  getTheWarningMapData.mockResolvedValue(mapData);
  getTheWarningShowsData.mockResolvedValue(showsData);
  getTheWarningStatsData.mockResolvedValue(statsData);
  getTheWarningTopSongsData.mockResolvedValue(topSongsData);
  render(await TheWarningArtistPage());
}

describe("TheWarningArtistPage", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getTheWarningMapData.mockReset();
    getTheWarningShowsData.mockReset();
    getTheWarningStatsData.mockReset();
    getTheWarningTopSongsData.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue({ status: "unauthenticated", user: null, logout: vi.fn() });
  });

  it("fetches GET /artists once and shares it with getTheWarningMapData, getTheWarningShowsData, getTheWarningStatsData and getTheWarningTopSongsData (not a hardcoded id)", async () => {
    const artists = [makeArtist()];
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "ok", artist: makeArtist(), shows: [] },
      { status: "ok", artist: makeArtist(), stats: makeStats() },
      { status: "ok", artist: makeArtist(), topSongs: makeTopSongs() },
      artists,
    );

    expect(getArtists).toHaveBeenCalledTimes(1);
    expect(getTheWarningMapData).toHaveBeenCalledWith(artists);
    expect(getTheWarningShowsData).toHaveBeenCalledWith(artists);
    expect(getTheWarningStatsData).toHaveBeenCalledWith(artists);
    expect(getTheWarningTopSongsData).toHaveBeenCalledWith(artists);
  });

  it("loads the map, the shows, the stats and the top songs in parallel once the artists are resolved", async () => {
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
    getTheWarningTopSongsData.mockImplementation(async () => {
      order.push("top-songs-start");
      await Promise.resolve();
      order.push("top-songs-end");
      return { status: "ok", artist: makeArtist(), topSongs: [] };
    });

    render(await TheWarningArtistPage());

    expect(order).toEqual([
      "map-start",
      "shows-start",
      "stats-start",
      "top-songs-start",
      "map-end",
      "shows-end",
      "stats-end",
      "top-songs-end",
    ]);
  });

  it("shows an error message when GET /artists fails, without calling getTheWarningMapData, getTheWarningShowsData, getTheWarningStatsData or getTheWarningTopSongsData", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    render(await TheWarningArtistPage());

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(getTheWarningMapData).not.toHaveBeenCalled();
    expect(getTheWarningShowsData).not.toHaveBeenCalled();
    expect(getTheWarningStatsData).not.toHaveBeenCalled();
    expect(getTheWarningTopSongsData).not.toHaveBeenCalled();
  });

  it("shows an error message when the map data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("top-songs")).not.toBeInTheDocument();
  });

  it("shows an error message when the shows data could not be loaded", async () => {
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "error" },
    );

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("top-songs")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("top-songs")).not.toBeInTheDocument();
  });

  it("shows an error message when the top songs data could not be loaded", async () => {
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      defaultShowsData,
      defaultStatsData,
      { status: "error" },
    );

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("top-songs")).not.toBeInTheDocument();
  });

  it("shows a not-found state when The Warning doesn't exist", async () => {
    await renderPage(
      { status: "artist-not-found" },
      { status: "artist-not-found" },
      { status: "artist-not-found" },
      { status: "artist-not-found" },
    );

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("artist-stats-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("top-songs")).not.toBeInTheDocument();
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

    expect(screen.getByAltText("Foto de The Warning")).toHaveAttribute(
      "src",
      "https://example.com/the-warning.jpg",
    );
  });

  it("doesn't render an avatar image when imageUrl is null", async () => {
    await renderPage({
      status: "ok",
      artist: makeArtist({ imageUrl: null }),
      fans: [],
    });

    expect(screen.queryByAltText("Foto de The Warning")).not.toBeInTheDocument();
  });

  it("shows the count of visible fans", async () => {
    const fans = [makeFan("fan-1"), makeFan("fan-2")];
    await renderPage({ status: "ok", artist: makeArtist(), fans });

    expect(screen.getByText(/2 fans en el mapa/i)).toBeInTheDocument();
  });

  it("shows the tour explorer (Historial) as the default map, with the loaded shows", async () => {
    const shows = [makeShow("show-1"), makeShow("show-2")];
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "ok", artist: makeArtist({ name: "The Warning" }), shows },
    );

    expect(screen.getByTestId("tour-explorer")).toHaveTextContent(
      "The Warning / 2 shows",
    );
  });

  it("does not render the Fan Map as the primary view", async () => {
    const fans = [makeFan("fan-1")];
    await renderPage({ status: "ok", artist: makeArtist(), fans });

    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
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

  it("shows the top songs with the loaded top songs, reusing the same resolved artist", async () => {
    const topSongs = makeTopSongs();
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      defaultShowsData,
      defaultStatsData,
      { status: "ok", artist: makeArtist(), topSongs },
    );

    expect(screen.getByTestId("top-songs")).toHaveTextContent("2 top songs");
  });

  it("shows the top songs empty state when the artist has no songs", async () => {
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      defaultShowsData,
      defaultStatsData,
      { status: "ok", artist: makeArtist(), topSongs: [] },
    );

    expect(screen.getByTestId("top-songs")).toHaveTextContent("0 top songs");
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
    expect(screen.getByTestId("tour-explorer")).toBeInTheDocument();
  });

  it("renders a working CTA linking to /join when not authenticated", async () => {
    await renderPage({ status: "ok", artist: makeArtist(), fans: [] });

    const cta = screen.getByRole("link", { name: /join the fanmap/i });
    expect(cta).toHaveAttribute("href", "/join");
  });

  // Pedido: logueado, el CTA cambia de "Join the FanMap" a "Profile".
  it("renders a CTA linking to /profile instead of /join when authenticated", async () => {
    useAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "fan@example.com" },
      logout: vi.fn(),
    });

    await renderPage({ status: "ok", artist: makeArtist(), fans: [] });

    const cta = screen.getByRole("link", { name: /^profile$/i });
    expect(cta).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: /join the fanmap/i })).not.toBeInTheDocument();
  });

  it("renders a working CTA linking to the show history", async () => {
    await renderPage({ status: "ok", artist: makeArtist(), fans: [] });

    const cta = screen.getByRole("link", {
      name: /historial de shows/i,
    });
    expect(cta).toHaveAttribute(
      "href",
      "/artists/the-warning/tour",
    );
  });

  // Etapa G, requisito 5: aunque el mapa que se ve por defecto acá sea el
  // Historial (TourExplorer), tiene que haber una forma directa de llegar
  // al Fan Map sin pasar por /join. Va a /map?view=fans, no a /map (que
  // caería en Historial), y el nombre accesible "Fan Map" (con espacio) no
  // matchea el CTA existente "Join the FanMap" (sin espacio).
  it("renders a working CTA linking to the Fan Map", async () => {
    await renderPage({ status: "ok", artist: makeArtist(), fans: [] });

    const cta = screen.getByRole("link", { name: /fan map/i });
    expect(cta).toHaveAttribute("href", "/map?view=fans");
  });
});
