import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Artist, ArtistShow } from "@/lib/api";
import type { TourCityInfo } from "@/lib/the-warning-tour-city";
import type { TourCity } from "@/lib/the-warning-tour-map";
import { TourCityHistory } from "./tour-city-history";

// Mismo mock que tour/page.test.tsx: TourMapLoader carga Leaflet vía
// next/dynamic (ssr: false), así que en el componente sólo se verifica que
// recibe el/los TourCity correctos, no el mapa en sí (ver tour-map.test.tsx
// para esa cobertura).
vi.mock("@/components/artists/tour-map-loader", () => ({
  TourMapLoader: ({ cities }: { cities: TourCity[] }) => (
    <div data-testid="tour-city-map">
      {cities.map((city) => `${city.name} (${city.shows.length})`).join(", ")}
    </div>
  ),
}));

const MENDOZA_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const SHOW_A_ID = "b1e1a1a1-1111-4111-8111-111111111111";
const SHOW_B_ID = "b2e2a2a2-2222-4222-8222-222222222222";

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

function makeCity(overrides: Partial<TourCityInfo> = {}): TourCityInfo {
  return {
    id: MENDOZA_ID,
    name: "Mendoza",
    country: { name: "Argentina", code: "AR" },
    ...overrides,
  };
}

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: SHOW_A_ID,
    date: "2024-03-15T00:00:00.000Z",
    venue: "Demo Venue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: MENDOZA_ID,
      name: "Mendoza",
      latitude: -32.8895,
      longitude: -68.8458,
      country: { id: "country-ar", name: "Argentina", code: "AR" },
    },
    ...overrides,
  };
}

describe("TourCityHistory", () => {
  it("shows the city name and country", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow()]}
      />,
    );

    expect(screen.getAllByText(/mendoza/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/argentina/i).length).toBeGreaterThan(0);
  });

  it("shows the show count", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow({ id: SHOW_A_ID }), makeShow({ id: SHOW_B_ID })]}
      />,
    );

    expect(screen.getByText(/2 shows/i)).toBeInTheDocument();
  });

  it("uses the singular form for a single show", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow()]}
      />,
    );

    expect(screen.getByText(/1 show\b/i)).toBeInTheDocument();
  });

  it("shows the first show realized in the city", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_A_ID, date: "2024-03-15T00:00:00.000Z", venue: "Demo Venue" }),
          makeShow({ id: SHOW_B_ID, date: "2025-08-20T00:00:00.000Z", venue: "Demo Arena" }),
        ]}
      />,
    );

    expect(screen.getByText(/primer show/i)).toBeInTheDocument();
    expect(screen.getByText(/15 de marzo de 2024.*demo venue/i)).toBeInTheDocument();
  });

  it("shows the last show realized in the city", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_A_ID, date: "2024-03-15T00:00:00.000Z", venue: "Demo Venue" }),
          makeShow({ id: SHOW_B_ID, date: "2025-08-20T00:00:00.000Z", venue: "Demo Arena" }),
        ]}
      />,
    );

    expect(screen.getByText(/último show/i)).toBeInTheDocument();
    expect(screen.getByText(/20 de agosto de 2025.*demo arena/i)).toBeInTheDocument();
  });

  it("uses the earliest date as the first show regardless of the order shows arrive in", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_B_ID, date: "2025-08-20T00:00:00.000Z", venue: "Demo Arena" }),
          makeShow({ id: SHOW_A_ID, date: "2024-03-15T00:00:00.000Z", venue: "Demo Venue" }),
        ]}
      />,
    );

    expect(screen.getByText(/15 de marzo de 2024.*demo venue/i)).toBeInTheDocument();
    expect(screen.getByText(/20 de agosto de 2025.*demo arena/i)).toBeInTheDocument();
  });

  it("shows a placeholder venue when the first show has no venue", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_A_ID, date: "2024-03-15T00:00:00.000Z", venue: null }),
          makeShow({ id: SHOW_B_ID, date: "2025-08-20T00:00:00.000Z", venue: "Demo Arena" }),
        ]}
      />,
    );

    expect(
      screen.getByText(/15 de marzo de 2024.*venue a confirmar/i),
    ).toBeInTheDocument();
  });

  it("shows a placeholder venue when the last show has no venue", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_A_ID, date: "2024-03-15T00:00:00.000Z", venue: "Demo Venue" }),
          makeShow({ id: SHOW_B_ID, date: "2025-08-20T00:00:00.000Z", venue: null }),
        ]}
      />,
    );

    expect(
      screen.getByText(/20 de agosto de 2025.*venue a confirmar/i),
    ).toBeInTheDocument();
  });

  it("shows a placeholder venue when the only show's venue is blank (whitespace only)", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow({ date: "2024-03-15T00:00:00.000Z", venue: "   " })]}
      />,
    );

    expect(screen.getAllByText(/venue a confirmar/i).length).toBeGreaterThan(0);
  });

  it("does not show a first/last show summary when the city has no shows", () => {
    render(
      <TourCityHistory artist={makeArtist()} city={makeCity()} shows={[]} />,
    );

    expect(screen.queryByText(/primer show/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/último show/i)).not.toBeInTheDocument();
  });

  it("shows the date and venue of each show", () => {
    const { container } = render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow({ date: "2024-03-15T00:00:00.000Z", venue: "Demo Venue" })]}
      />,
    );

    // Se escopea al <ul> de ShowsList (el único de la página: el
    // breadcrumb usa <ol>) porque el mismo show, al ser el único, también
    // aparece resumido en "Primer show"/"Último show" (ver tests de esa
    // sección) — acá sólo interesa la fila de la lista.
    const list = within(container.querySelector("ul") as HTMLElement);
    expect(list.getByText(/15 de marzo de 2024/i)).toBeInTheDocument();
    expect(list.getByText(/demo venue/i)).toBeInTheDocument();
  });

  it("lists every show when the city has more than one", () => {
    const { container } = render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_A_ID, date: "2024-03-15T00:00:00.000Z", venue: "Demo Venue" }),
          makeShow({ id: SHOW_B_ID, date: "2025-08-20T00:00:00.000Z", venue: "Demo Arena" }),
        ]}
      />,
    );

    // Idem: se escopea al <ul> porque ambos shows (el primero y el último
    // cronológicamente) también aparecen resumidos en el header.
    const list = within(container.querySelector("ul") as HTMLElement);
    expect(list.getByText(/15 de marzo de 2024/i)).toBeInTheDocument();
    expect(list.getByText(/demo venue/i)).toBeInTheDocument();
    expect(list.getByText(/20 de agosto de 2025/i)).toBeInTheDocument();
    expect(list.getByText(/demo arena/i)).toBeInTheDocument();
  });

  it("links each show to its detail page", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[
          makeShow({ id: SHOW_A_ID }),
          makeShow({ id: SHOW_B_ID }),
        ]}
      />,
    );

    const showLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("/shows/"));
    expect(showLinks).toHaveLength(2);
    expect(showLinks[0]).toHaveAttribute(
      "href",
      `/artists/the-warning/shows/${SHOW_A_ID}`,
    );
    expect(showLinks[1]).toHaveAttribute(
      "href",
      `/artists/the-warning/shows/${SHOW_B_ID}`,
    );
  });

  it("shows an empty state when the city has no shows", () => {
    render(
      <TourCityHistory artist={makeArtist()} city={makeCity()} shows={[]} />,
    );

    expect(screen.getByText(/todavía no hay shows/i)).toBeInTheDocument();
    // Sin shows, ShowsList no debe listar ningún link de detalle de show
    // (los <li> del breadcrumb son un elemento distinto y sí siguen
    // presentes).
    const showLinks = screen
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("/shows/"));
    expect(showLinks).toHaveLength(0);
  });

  it("renders the tour breadcrumbs, linking back to the artist and the tour history", () => {
    render(
      <TourCityHistory artist={makeArtist()} city={makeCity()} shows={[]} />,
    );

    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "The Warning" }),
    ).toHaveAttribute("href", "/artists/the-warning");
    expect(
      screen.getByRole("link", { name: "Historial de shows" }),
    ).toHaveAttribute("href", "/artists/the-warning/tour");
    expect(screen.getByText("Mendoza")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders a map centered on the city, with every show grouped into it", () => {
    render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow({ id: SHOW_A_ID }), makeShow({ id: SHOW_B_ID })]}
      />,
    );

    expect(screen.getByTestId("tour-city-map")).toHaveTextContent("Mendoza (2)");
  });

  it("does not render a map when the city has no shows", () => {
    render(
      <TourCityHistory artist={makeArtist()} city={makeCity()} shows={[]} />,
    );

    expect(screen.queryByTestId("tour-city-map")).not.toBeInTheDocument();
  });

  it("does not render internal UUIDs as visible text", () => {
    const { container } = render(
      <TourCityHistory
        artist={makeArtist()}
        city={makeCity()}
        shows={[makeShow({ id: SHOW_A_ID })]}
      />,
    );

    expect(container.textContent).not.toContain(SHOW_A_ID);
    expect(container.textContent).not.toContain(MENDOZA_ID);
  });
});
