import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArtistStats } from "@/lib/api";
import { ArtistStatsSummary } from "./artist-stats";

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

describe("ArtistStatsSummary", () => {
  it("shows the fans, countries, cities, shows and songs counts with their labels", () => {
    render(
      <ArtistStatsSummary
        stats={makeStats({ fans: 3, countries: 2, cities: 2, shows: 4, songs: 10 })}
      />,
    );

    expect(screen.getByText("Fans")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Países")).toBeInTheDocument();
    expect(screen.getByText("Ciudades")).toBeInTheDocument();
    expect(screen.getAllByText("2")).toHaveLength(2);
    expect(screen.getByText("Shows")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Canciones")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows zero values as 0, not blank or a placeholder", () => {
    render(
      <ArtistStatsSummary
        stats={makeStats({ fans: 0, countries: 0, cities: 0, shows: 0, songs: 0 })}
      />,
    );

    expect(screen.getAllByText("0")).toHaveLength(5);
  });
});
