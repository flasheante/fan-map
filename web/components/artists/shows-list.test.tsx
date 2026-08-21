import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArtistShow } from "@/lib/api";
import { ShowsList } from "./shows-list";

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

describe("ShowsList", () => {
  it("shows the date, venue, city and country for each show", () => {
    render(<ShowsList shows={[makeShow()]} />);

    expect(screen.getByText(/1 de junio de 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/foro sol/i)).toBeInTheDocument();
    expect(screen.getByText(/monterrey/i)).toBeInTheDocument();
    expect(screen.getByText(/mexico/i)).toBeInTheDocument();
  });

  it("renders one item per show", () => {
    const shows = [
      makeShow({ id: "show-1", venue: "Foro Sol" }),
      makeShow({ id: "show-2", venue: "Auditorio Nacional" }),
    ];

    render(<ShowsList shows={shows} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/auditorio nacional/i)).toBeInTheDocument();
  });

  it("links each show to its detail page", () => {
    render(<ShowsList shows={[makeShow({ id: "show-1" })]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/artists/the-warning/shows/show-1",
    );
  });

  it("shows a placeholder when the venue is missing", () => {
    render(<ShowsList shows={[makeShow({ venue: null })]} />);

    expect(screen.getByText(/venue a confirmar/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no shows", () => {
    render(<ShowsList shows={[]} />);

    expect(screen.getByText(/todavía no hay shows/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
