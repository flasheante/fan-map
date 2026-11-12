import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan } from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";

const { getTheWarningMapData } = vi.hoisted(() => ({
  getTheWarningMapData: vi.fn(),
}));

vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));

// MapExplorer tiene su propia cobertura (ver map-explorer.test.tsx); acá
// sólo interesa que la página server-side resuelve los fans y se los pasa
// tal cual.
vi.mock("@/components/map/map-explorer", () => ({
  MapExplorer: ({ artist, fans }: { artist: Artist; fans: ArtistFan[] }) => (
    <div data-testid="map-explorer">
      {artist.name} / {fans.length} fans
    </div>
  ),
}));

const { default: MapPage, revalidate } = await import("./page");

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  setlistsSyncedAt: null,
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
      country: { id: "country-mx", name: "Mexico", code: "MX" },
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

  it("is ISR with a 5 minute revalidate", () => {
    expect(revalidate).toBe(300);
  });

  it("renders MapExplorer with the resolved artist and fans", async () => {
    await renderPage({
      status: "ok",
      artist,
      fans: [makeFan("fan-1"), makeFan("fan-2")],
    });

    expect(screen.getByTestId("map-explorer")).toHaveTextContent(
      "The Warning / 2 fans",
    );
    expect(getTheWarningMapData).toHaveBeenCalledTimes(1);
  });

  it("throws (so ISR keeps serving the last good page) when the fans could not be loaded", async () => {
    await expect(renderPage({ status: "error" })).rejects.toThrow(
      /no se pudo cargar el fan map/i,
    );
  });

  it("shows a not-found message and a way back when the artist is missing", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
    expect(screen.queryByTestId("map-explorer")).not.toBeInTheDocument();
  });
});
