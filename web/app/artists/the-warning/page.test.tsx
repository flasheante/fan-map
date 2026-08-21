import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan, ArtistShow } from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";
import type { TheWarningShowsData } from "@/lib/the-warning-shows";

// Se mockean los mismos módulos que ya usa /map y la resolución de shows
// (@/lib/the-warning-fan-map y @/lib/the-warning-shows), no @/lib/api
// directamente para esa lógica: la resolución del artista por slug dentro de
// esas funciones y las llamadas a getArtistFans/getArtistShows con su id ya
// están cubiertas en sus propios tests, sin cambios. Esta página sí llama a
// getArtists() de @/lib/api directamente (una sola vez) para compartir el
// resultado entre ambas, así que ese único límite adicional se mockea acá.
const { getTheWarningMapData } = vi.hoisted(() => ({
  getTheWarningMapData: vi.fn(),
}));
const { getTheWarningShowsData } = vi.hoisted(() => ({
  getTheWarningShowsData: vi.fn(),
}));
const { getArtists } = vi.hoisted(() => ({
  getArtists: vi.fn(),
}));

vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));
vi.mock("@/lib/the-warning-shows", () => ({ getTheWarningShowsData }));
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

async function renderPage(
  mapData: TheWarningMapData,
  showsData: TheWarningShowsData = { status: "ok", artist: makeArtist(), shows: [] },
  artists: Artist[] = [makeArtist()],
) {
  getArtists.mockResolvedValue(artists);
  getTheWarningMapData.mockResolvedValue(mapData);
  getTheWarningShowsData.mockResolvedValue(showsData);
  render(await TheWarningArtistPage());
}

describe("TheWarningArtistPage", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getTheWarningMapData.mockReset();
    getTheWarningShowsData.mockReset();
  });

  it("fetches GET /artists once and shares it with getTheWarningMapData and getTheWarningShowsData (not a hardcoded id)", async () => {
    const artists = [makeArtist()];
    await renderPage(
      { status: "ok", artist: makeArtist(), fans: [] },
      { status: "ok", artist: makeArtist(), shows: [] },
      artists,
    );

    expect(getArtists).toHaveBeenCalledTimes(1);
    expect(getTheWarningMapData).toHaveBeenCalledWith(artists);
    expect(getTheWarningShowsData).toHaveBeenCalledWith(artists);
  });

  it("loads the map and the shows in parallel once the artists are resolved", async () => {
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

    render(await TheWarningArtistPage());

    expect(order).toEqual(["map-start", "shows-start", "map-end", "shows-end"]);
  });

  it("shows an error message when GET /artists fails, without calling getTheWarningMapData or getTheWarningShowsData", async () => {
    getArtists.mockRejectedValue(new Error("network error"));

    render(await TheWarningArtistPage());

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(getTheWarningMapData).not.toHaveBeenCalled();
    expect(getTheWarningShowsData).not.toHaveBeenCalled();
  });

  it("shows an error message when the map data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shows-list")).not.toBeInTheDocument();
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
  });

  it("shows a not-found state when The Warning doesn't exist", async () => {
    await renderPage({ status: "artist-not-found" }, { status: "artist-not-found" });

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shows-list")).not.toBeInTheDocument();
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
