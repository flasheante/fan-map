import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan } from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";

const { getTheWarningMapData } = vi.hoisted(() => ({
  getTheWarningMapData: vi.fn(),
}));

vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));

vi.mock("@/components/map/fan-map-loader", () => ({
  FanMapLoader: ({ fans }: { fans: ArtistFan[] }) => (
    <div data-testid="fan-map-loader">{fans.length} fans on map</div>
  ),
}));

const { default: MapPage } = await import("./page");

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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
  render(await MapPage());
}

describe("MapPage", () => {
  beforeEach(() => {
    getTheWarningMapData.mockReset();
  });

  it("shows an error message when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no se pudo cargar el mapa/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows a not-found message when The Warning is not in the artists list", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(
      screen.getByText(/no se encontró el artista the warning/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when The Warning is not found", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("renders the fan count and the map when the data loads with fans", async () => {
    const fans = [makeFan("fan-1"), makeFan("fan-2")];
    await renderPage({ status: "ok", artist, fans });

    expect(screen.getByText(/2 fans en el mapa/i)).toBeInTheDocument();
    expect(screen.getByTestId("fan-map-loader")).toHaveTextContent(
      "2 fans on map",
    );
  });

  it("renders a singular fan count when there is exactly one fan", async () => {
    await renderPage({ status: "ok", artist, fans: [makeFan("fan-1")] });

    expect(screen.getByText(/1 fan en el mapa/i)).toBeInTheDocument();
  });

  it("renders a zero fan count and still mounts the map when the list is empty", async () => {
    await renderPage({ status: "ok", artist, fans: [] });

    expect(screen.getByText(/0 fans en el mapa/i)).toBeInTheDocument();
    expect(screen.getByTestId("fan-map-loader")).toBeInTheDocument();
  });

  it("offers a way back to the artist page on success", async () => {
    await renderPage({ status: "ok", artist, fans: [] });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("wraps the header on narrow viewports instead of overflowing", async () => {
    await renderPage({ status: "ok", artist, fans: [] });

    expect(screen.getByRole("heading").parentElement).toHaveClass(
      "flex-wrap",
    );
  });
});
