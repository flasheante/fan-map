import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArtistShow } from "@/lib/api";
import type { TourStats as TourStatsData } from "@/lib/the-warning-tour-stats";
import { TourStatsRankings, TourStatsSummary } from "./tour-stats";

const SHOW_FIRST_ID = "b1e1a1a1-1111-4111-8111-111111111111";
const SHOW_LAST_ID = "b2e2a2a2-2222-4222-8222-222222222222";
const MONTERREY_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const MENDOZA_ID = "9c858901-8a57-4791-81fe-4c455b099bc9";
const BUENOS_AIRES_ID = "d4f4a4a4-4444-4444-8444-444444444444";
const MEXICO_COUNTRY_ID = "c3e3a3a3-3333-4333-8333-333333333333";

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: SHOW_FIRST_ID,
    date: "2018-03-12T00:00:00.000Z",
    venue: "Arena Monterrey",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: MONTERREY_ID,
      name: "Monterrey",
      latitude: 25.6866,
      longitude: -100.3161,
      country: { id: MEXICO_COUNTRY_ID, name: "Mexico", code: "MX" },
    },
    ...overrides,
  };
}

const EMPTY_STATS: TourStatsData = {
  totalShows: 0,
  totalCities: 0,
  totalCountries: 0,
  totalVenues: 0,
  firstShow: null,
  lastShow: null,
  topCountry: null,
  topCity: null,
  topYear: null,
  showsByYear: [],
  citiesRanking: [],
};

function makeStats(overrides: Partial<TourStatsData> = {}): TourStatsData {
  return {
    // Números elegidos para que ninguno sea substring de otro (evita falsos
    // positivos/ambigüedades con getByText por coincidencia parcial).
    totalShows: 45,
    totalCities: 12,
    totalCountries: 3,
    totalVenues: 7,
    firstShow: makeShow({
      id: SHOW_FIRST_ID,
      date: "2018-03-12T00:00:00.000Z",
    }),
    lastShow: makeShow({
      id: SHOW_LAST_ID,
      date: "2026-08-15T00:00:00.000Z",
      city: {
        id: MENDOZA_ID,
        name: "Mendoza",
        latitude: -32.8895,
        longitude: -68.8458,
        country: { id: "country-ar", name: "Argentina", code: "AR" },
      },
    }),
    topCountry: {
      id: MEXICO_COUNTRY_ID,
      name: "Mexico",
      code: "MX",
      showCount: 9,
    },
    topCity: {
      // Distinta de la ciudad del firstShow (Monterrey) y del lastShow
      // (Mendoza) para que los tests puedan distinguir sin ambigüedad qué
      // texto pertenece a cada fila.
      id: BUENOS_AIRES_ID,
      name: "Buenos Aires",
      country: { id: "country-ar", name: "Argentina", code: "AR" },
      showCount: 6,
    },
    topYear: { year: 2022, showCount: 8 },
    showsByYear: [
      { year: 2018, showCount: 2 },
      { year: 2022, showCount: 8 },
      { year: 2026, showCount: 1 },
    ],
    citiesRanking: [
      {
        id: BUENOS_AIRES_ID,
        name: "Buenos Aires",
        country: { id: "country-ar", name: "Argentina", code: "AR" },
        showCount: 6,
      },
      {
        id: MONTERREY_ID,
        name: "Monterrey",
        country: { id: MEXICO_COUNTRY_ID, name: "Mexico", code: "MX" },
        showCount: 4,
      },
    ],
    ...overrides,
  };
}

// TourStatsSummary y TourStatsRankings son las dos mitades del antiguo
// TourStats (ver tour-stats.tsx): la página del Tour Map las separa con el
// mapa en el medio, pero acá se testean por separado sobre el mismo
// TourStatsData de arriba.
describe("TourStatsSummary", () => {
  it("shows the total number of shows", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("shows")).toBeInTheDocument();
  });

  it("shows the total number of cities", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("ciudades")).toBeInTheDocument();
  });

  it("shows the total number of countries", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("países")).toBeInTheDocument();
  });

  it("shows the total number of venues", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("venues")).toBeInTheDocument();
  });

  it("shows the first show's date and city", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(
      screen.getByText(/12 de marzo de 2018 · Monterrey/i),
    ).toBeInTheDocument();
  });

  it("shows the last show's date and city", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText(/15 de agosto de 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/mendoza/i)).toBeInTheDocument();
  });

  it("shows the country with the most shows and its show count", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText(/Mexico · 9 shows/i)).toBeInTheDocument();
  });

  it("shows the city with the most shows and its show count", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    // Combinado en un solo getByText: "Buenos Aires" y "6 shows" por
    // separado también aparecen en TourStatsRankings (citiesRanking), así
    // que buscarlos sueltos acá sería ambiguo si se testeara junto a ese
    // componente.
    expect(screen.getByText(/Buenos Aires · 6 shows/i)).toBeInTheDocument();
  });

  it("shows the year with the most shows and its show count", () => {
    render(<TourStatsSummary stats={makeStats()} />);

    expect(screen.getByText(/2022 · 8 shows/)).toBeInTheDocument();
  });

  it("renders a friendly empty state when there are no shows at all", () => {
    render(<TourStatsSummary stats={EMPTY_STATS} />);

    expect(screen.getAllByText(/0/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not crash and shows placeholders when only firstShow/lastShow are missing", () => {
    render(
      <TourStatsSummary stats={makeStats({ firstShow: null, lastShow: null })} />,
    );

    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not crash and shows placeholders when only topCountry/topCity/topYear are missing", () => {
    render(
      <TourStatsSummary
        stats={makeStats({ topCountry: null, topCity: null, topYear: null })}
      />,
    );

    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not render internal UUIDs as visible text", () => {
    const { container } = render(<TourStatsSummary stats={makeStats()} />);

    expect(container.textContent).not.toContain(SHOW_FIRST_ID);
    expect(container.textContent).not.toContain(SHOW_LAST_ID);
    expect(container.textContent).not.toContain(MONTERREY_ID);
    expect(container.textContent).not.toContain(MENDOZA_ID);
  });
});

describe("TourStatsRankings", () => {
  it("shows the shows-by-year breakdown, chronologically", () => {
    render(<TourStatsRankings stats={makeStats()} />);

    const list = screen.getByTestId("shows-by-year");
    const years = Array.from(list.querySelectorAll("[data-testid='year-row']")).map(
      (row) => row.textContent,
    );

    expect(years).toHaveLength(3);
    expect(years[0]).toMatch(/2018/);
    expect(years[1]).toMatch(/2022/);
    expect(years[2]).toMatch(/2026/);
  });

  it("shows the cities ranking with city, country and show count", () => {
    render(<TourStatsRankings stats={makeStats()} />);

    const ranking = screen.getByTestId("cities-ranking");
    expect(ranking).toHaveTextContent("Buenos Aires");
    expect(ranking).toHaveTextContent("Argentina");
    expect(ranking).toHaveTextContent("Monterrey");
    expect(ranking).toHaveTextContent("Mexico");
  });

  it("links each city in the ranking to its tour history page", () => {
    render(<TourStatsRankings stats={makeStats()} />);

    expect(
      screen.getByRole("link", { name: /buenos aires/i }),
    ).toHaveAttribute("href", `/artists/the-warning/tour/${BUENOS_AIRES_ID}`);
    expect(
      screen.getByRole("link", { name: /monterrey/i }),
    ).toHaveAttribute("href", `/artists/the-warning/tour/${MONTERREY_ID}`);
  });

  it("renders a friendly empty state when there are no shows at all", () => {
    render(<TourStatsRankings stats={EMPTY_STATS} />);

    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows a placeholder instead of empty lists when showsByYear/citiesRanking are empty", () => {
    render(
      <TourStatsRankings
        stats={makeStats({ showsByYear: [], citiesRanking: [] })}
      />,
    );

    expect(screen.queryByTestId("shows-by-year")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cities-ranking")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not render internal UUIDs as visible text", () => {
    const { container } = render(<TourStatsRankings stats={makeStats()} />);

    expect(container.textContent).not.toContain(BUENOS_AIRES_ID);
    expect(container.textContent).not.toContain(MONTERREY_ID);
    expect(container.textContent).not.toContain(MEXICO_COUNTRY_ID);
  });
});
