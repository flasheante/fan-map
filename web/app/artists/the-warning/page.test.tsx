import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan } from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";

// Se mockea el mismo módulo que ya usa /map (@/lib/the-warning-fan-map), no
// @/lib/api directamente: la resolución del artista por slug y la llamada a
// getArtistFans con su id ya están cubiertas en lib/the-warning-fan-map.test.ts
// contra esa función, sin cambios. Esta página solo debe delegar en ella
// (sin pasarle ningún id) y renderizar lo que devuelve, así que testear ese
// límite evita duplicar la lógica de búsqueda del artista.
const { getTheWarningMapData } = vi.hoisted(() => ({
  getTheWarningMapData: vi.fn(),
}));

vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));

vi.mock("@/components/map/fan-map-loader", () => ({
  FanMapLoader: ({ fans }: { fans: ArtistFan[] }) => (
    <div data-testid="fan-map-loader">{fans.length} fans on map</div>
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

async function renderPage(data: TheWarningMapData) {
  getTheWarningMapData.mockResolvedValue(data);
  render(await TheWarningArtistPage());
}

describe("TheWarningArtistPage", () => {
  beforeEach(() => {
    getTheWarningMapData.mockReset();
  });

  it("resolves the artist by slug (not by a hardcoded id) by delegating to getTheWarningMapData", async () => {
    await renderPage({ status: "ok", artist: makeArtist(), fans: [] });

    expect(getTheWarningMapData).toHaveBeenCalledWith();
  });

  it("shows an error message when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no pudimos cargar la página del artista/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
  });

  it("shows a not-found state when The Warning doesn't exist", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
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
