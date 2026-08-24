import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistShow, SetlistSong } from "@/lib/api";
import type { TheWarningShowData } from "@/lib/the-warning-show";

// Se mockea @/lib/the-warning-show (mismo patrón que /artists/the-warning
// con @/lib/the-warning-fan-map / @/lib/the-warning-shows), no @/lib/api
// directamente: la resolución del artista por slug y las llamadas a
// getArtistShow/getShowSetlist con su id ya están cubiertas en
// the-warning-show.test.ts, sin cambios. Esta página solo debe delegar en
// ella (con el showId de la URL, sin pasarle ningún artistId) y renderizar
// lo que devuelve.
const { getTheWarningShowData } = vi.hoisted(() => ({
  getTheWarningShowData: vi.fn(),
}));

vi.mock("@/lib/the-warning-show", () => ({ getTheWarningShowData }));

// El mock expone show.city (no sólo artist/venue) porque ShowDetail es
// quien arma el breadcrumb The Warning / Historial de shows / <ciudad> /
// <fecha> a partir de esos mismos datos del show (ver show-detail.test.tsx
// para la cobertura del breadcrumb en sí); esta page test sólo verifica que
// le llegan completos, sin requests adicionales.
vi.mock("@/components/artists/show-detail", () => ({
  ShowDetail: ({ artist, show }: { artist: Artist; show: ArtistShow }) => (
    <div data-testid="show-detail">
      {artist.name} — {show.venue} — {show.city?.name ?? "sin ciudad"}
    </div>
  ),
}));

vi.mock("@/components/artists/setlist", () => ({
  Setlist: ({ songs }: { songs: SetlistSong[] }) => (
    <div data-testid="setlist">{songs.length} songs</div>
  ),
}));

const { default: TheWarningShowPage } = await import("./page");

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

async function renderPage(showId: string, data: TheWarningShowData) {
  getTheWarningShowData.mockResolvedValue(data);
  render(await TheWarningShowPage({ params: Promise.resolve({ showId }) }));
}

describe("TheWarningShowPage", () => {
  beforeEach(() => {
    getTheWarningShowData.mockReset();
  });

  it("resolves the artist by slug (not by a hardcoded id) using the showId from the URL", async () => {
    await renderPage("show-1", {
      status: "ok",
      artist: makeArtist(),
      show: makeShow(),
      setlist: { showId: "show-1", songs: [] },
    });

    expect(getTheWarningShowData).toHaveBeenCalledWith("show-1");
  });

  it("shows an error message when the data could not be loaded", async () => {
    await renderPage("show-1", { status: "error" });

    expect(
      screen.getByText(/no pudimos cargar el show/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("show-detail")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when the data could not be loaded", async () => {
    await renderPage("show-1", { status: "error" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows a not-found state when The Warning doesn't exist", async () => {
    await renderPage("show-1", { status: "artist-not-found" });

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("show-detail")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when The Warning is not found", async () => {
    await renderPage("show-1", { status: "artist-not-found" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows a friendly not-found state when the show doesn't exist", async () => {
    await renderPage("missing-show", { status: "show-not-found" });

    expect(screen.getByText(/no se encontró el show/i)).toBeInTheDocument();
    expect(screen.queryByTestId("show-detail")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when the show doesn't exist", async () => {
    await renderPage("missing-show", { status: "show-not-found" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("renders the show detail and the setlist on success", async () => {
    const artist = makeArtist();
    const show = makeShow();
    const setlist = {
      showId: show.id,
      songs: [{ id: "song-1", position: 1, title: "Choke" }],
    };

    await renderPage(show.id, { status: "ok", artist, show, setlist });

    expect(screen.getByTestId("show-detail")).toHaveTextContent(
      "The Warning — Foro Sol",
    );
    expect(screen.getByTestId("setlist")).toHaveTextContent("1 songs");
  });

  it("passes the show's city to ShowDetail so it can build the breadcrumb, without an extra request", async () => {
    const artist = makeArtist();
    const show = makeShow({
      city: {
        id: "city-1",
        name: "Monterrey",
        latitude: 25.6866,
        longitude: -100.3161,
        country: { id: "country-1", name: "Mexico", code: "MX" },
      },
    });
    const setlist = { showId: show.id, songs: [] };

    await renderPage(show.id, { status: "ok", artist, show, setlist });

    expect(screen.getByTestId("show-detail")).toHaveTextContent("Monterrey");
    expect(getTheWarningShowData).toHaveBeenCalledTimes(1);
  });
});
