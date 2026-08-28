import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArtistShow } from "@/lib/api";
import type { TourStats as TourStatsData } from "@/lib/the-warning-tour-stats";
import { TourStats } from "./tour-stats";

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

describe("TourStats", () => {
  it("shows the total number of shows", () => {
    render(<TourStats stats={makeStats()} />);

    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("shows")).toBeInTheDocument();
  });

  it("shows the total number of cities", () => {
    render(<TourStats stats={makeStats()} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("ciudades")).toBeInTheDocument();
  });

  it("shows the total number of countries", () => {
    render(<TourStats stats={makeStats()} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("países")).toBeInTheDocument();
  });

  it("shows the total number of venues", () => {
    render(<TourStats stats={makeStats()} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("venues")).toBeInTheDocument();
  });

  it("shows the first show's date and city", () => {
    render(<TourStats stats={makeStats()} />);

    // Un único getByText sobre la línea completa: "Monterrey" solo también
    // aparece en la sección "Ciudades" (citiesRanking), así que buscarlo
    // suelto sería ambiguo.
    expect(
      screen.getByText(/12 de marzo de 2018 · Monterrey/i),
    ).toBeInTheDocument();
  });

  it("shows the last show's date and city", () => {
    render(<TourStats stats={makeStats()} />);

    expect(screen.getByText(/15 de agosto de 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/mendoza/i)).toBeInTheDocument();
  });

  it("shows the country with the most shows and its show count", () => {
    render(<TourStats stats={makeStats()} />);

    // Combinado en un solo getByText: "Mexico" solo también aparece en la
    // sección "Ciudades" (Monterrey es de Mexico), así que buscarlo suelto
    // sería ambiguo.
    expect(screen.getByText(/Mexico · 9 shows/i)).toBeInTheDocument();
  });

  it("shows the city with the most shows and its show count", () => {
    render(<TourStats stats={makeStats()} />);

    // Combinado en un solo getByText: "Buenos Aires" y "6 shows" por
    // separado también aparecen en la sección "Ciudades" (citiesRanking),
    // así que buscarlos sueltos sería ambiguo.
    expect(screen.getByText(/Buenos Aires · 6 shows/i)).toBeInTheDocument();
  });

  it("shows the year with the most shows and its show count", () => {
    render(<TourStats stats={makeStats()} />);

    // Combinado en un solo getByText: 2022 y "8 shows" por separado también
    // aparecen como fila de "Shows por año", así que buscarlos sueltos
    // sería ambiguo.
    expect(screen.getByText(/2022 · 8 shows/)).toBeInTheDocument();
  });

  it("shows the shows-by-year breakdown, chronologically", () => {
    render(<TourStats stats={makeStats()} />);

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
    render(<TourStats stats={makeStats()} />);

    const ranking = screen.getByTestId("cities-ranking");
    expect(ranking).toHaveTextContent("Buenos Aires");
    expect(ranking).toHaveTextContent("Argentina");
    expect(ranking).toHaveTextContent("Monterrey");
    expect(ranking).toHaveTextContent("Mexico");
  });

  it("links each city in the ranking to its tour history page", () => {
    render(<TourStats stats={makeStats()} />);

    expect(
      screen.getByRole("link", { name: /buenos aires/i }),
    ).toHaveAttribute("href", `/artists/the-warning/tour/${BUENOS_AIRES_ID}`);
    expect(
      screen.getByRole("link", { name: /monterrey/i }),
    ).toHaveAttribute("href", `/artists/the-warning/tour/${MONTERREY_ID}`);
  });

  it("renders a friendly empty state when there are no shows at all", () => {
    render(<TourStats stats={EMPTY_STATS} />);

    expect(screen.getAllByText(/0/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not crash and shows placeholders when only firstShow/lastShow are missing", () => {
    render(
      <TourStats
        stats={makeStats({ firstShow: null, lastShow: null })}
      />,
    );

    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not crash and shows placeholders when only topCountry/topCity/topYear are missing", () => {
    render(
      <TourStats
        stats={makeStats({ topCountry: null, topCity: null, topYear: null })}
      />,
    );

    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows a placeholder instead of empty lists when showsByYear/citiesRanking are empty", () => {
    render(
      <TourStats stats={makeStats({ showsByYear: [], citiesRanking: [] })} />,
    );

    expect(screen.queryByTestId("shows-by-year")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cities-ranking")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/todavía no hay shows/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not render internal UUIDs as visible text", () => {
    const { container } = render(<TourStats stats={makeStats()} />);

    expect(container.textContent).not.toContain(SHOW_FIRST_ID);
    expect(container.textContent).not.toContain(SHOW_LAST_ID);
    expect(container.textContent).not.toContain(MONTERREY_ID);
    expect(container.textContent).not.toContain(MENDOZA_ID);
    expect(container.textContent).not.toContain(BUENOS_AIRES_ID);
    expect(container.textContent).not.toContain(MEXICO_COUNTRY_ID);
  });
});
