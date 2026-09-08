import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import type { CityOption, Country, FavoriteSongRankingEntry } from "@/lib/api";

const { getCountries, getCities, getFavoriteSongsRanking } = vi.hoisted(() => ({
  getCountries: vi.fn(),
  getCities: vi.fn(),
  getFavoriteSongsRanking: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ getCountries, getCities, getFavoriteSongsRanking }));

const { FavoriteSongsRanking } = await import("./favorite-songs-ranking");

const mexico: Country = { id: "country-mx", name: "Mexico", code: "MX" };
const argentina: Country = { id: "country-ar", name: "Argentina", code: "AR" };
const monterrey: CityOption = { id: "city-mty", name: "Monterrey", countryId: mexico.id };

const worldwideRanking: FavoriteSongRankingEntry[] = [
  { songId: "song-more", title: "MORE", albumTitle: "ERROR", count: 1284 },
  { songId: "song-choke", title: "Choke", albumTitle: "ERROR", count: 900 },
];

beforeEach(() => {
  getCountries.mockReset().mockResolvedValue([mexico, argentina]);
  getCities.mockReset().mockResolvedValue([monterrey]);
  getFavoriteSongsRanking.mockReset().mockResolvedValue(worldwideRanking);
});

describe("FavoriteSongsRanking", () => {
  it("loads the worldwide ranking by default", async () => {
    render(<FavoriteSongsRanking />);

    await waitFor(() => expect(getFavoriteSongsRanking).toHaveBeenCalledWith({}));
    expect(await screen.findByText(/1\. more — 1284 fans/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. choke — 900 fans/i)).toBeInTheDocument();
  });

  it("shows a loading state while the ranking is being fetched", () => {
    getFavoriteSongsRanking.mockReturnValue(new Promise(() => {}));

    render(<FavoriteSongsRanking />);

    expect(screen.getByText(/cargando ranking/i)).toBeInTheDocument();
  });

  it("shows an error message when the ranking fails to load", async () => {
    getFavoriteSongsRanking.mockRejectedValue(new Error("network error"));

    render(<FavoriteSongsRanking />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos cargar el ranking/i);
  });

  it("shows an empty state when nobody has favorites yet", async () => {
    getFavoriteSongsRanking.mockResolvedValue([]);

    render(<FavoriteSongsRanking />);

    expect(await screen.findByText(/todavía no hay favoritas cargadas/i)).toBeInTheDocument();
  });

  it("asks for a country before fetching a country-scoped ranking", async () => {
    render(<FavoriteSongsRanking />);
    await waitFor(() => expect(getFavoriteSongsRanking).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /país/i }));

    expect(screen.getByText(/elegí un país para ver su ranking/i)).toBeInTheDocument();
    expect(getFavoriteSongsRanking).toHaveBeenCalledTimes(1);
  });

  it("fetches a country-scoped ranking once a country is chosen", async () => {
    render(<FavoriteSongsRanking />);
    await waitFor(() => expect(getCountries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /país/i }));
    fireEvent.change(await screen.findByLabelText("País"), {
      target: { value: mexico.id },
    });

    await waitFor(() =>
      expect(getFavoriteSongsRanking).toHaveBeenCalledWith({ countryId: mexico.id }),
    );
  });

  it("asks for a city before fetching a city-scoped ranking, and only enables the city select after a country is chosen", async () => {
    render(<FavoriteSongsRanking />);
    await waitFor(() => expect(getCountries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /ciudad/i }));

    expect(screen.getByLabelText("Ciudad")).toBeDisabled();
    expect(screen.getByText(/elegí una ciudad para ver su ranking/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("País"), { target: { value: mexico.id } });
    await waitFor(() => expect(getCities).toHaveBeenCalledWith(mexico.id));
    await waitFor(() => expect(screen.getByLabelText("Ciudad")).not.toBeDisabled());

    expect(screen.getByText(/elegí una ciudad para ver su ranking/i)).toBeInTheDocument();
  });

  it("fetches a city-scoped ranking once a city is chosen, using cityId rather than countryId", async () => {
    render(<FavoriteSongsRanking />);
    await waitFor(() => expect(getCountries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /ciudad/i }));
    fireEvent.change(screen.getByLabelText("País"), { target: { value: mexico.id } });
    await waitFor(() => expect(screen.getByLabelText("Ciudad")).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: monterrey.id } });

    await waitFor(() =>
      expect(getFavoriteSongsRanking).toHaveBeenLastCalledWith({ cityId: monterrey.id }),
    );
  });

  it("goes back to the worldwide ranking when Mundial is chosen again", async () => {
    render(<FavoriteSongsRanking />);
    await waitFor(() => expect(getFavoriteSongsRanking).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /país/i }));
    fireEvent.click(screen.getByRole("button", { name: /mundial/i }));

    await waitFor(() => expect(getFavoriteSongsRanking).toHaveBeenLastCalledWith({}));
    expect(screen.queryByLabelText("País")).not.toBeInTheDocument();
  });

  it("marks the active scope button", async () => {
    render(<FavoriteSongsRanking />);

    const group = screen.getByRole("group", { name: /alcance del ranking/i });
    expect(within(group).getByRole("button", { name: /mundial/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
