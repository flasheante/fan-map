import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PublicFanProfile } from "@/lib/api";
import type { FanProfileViewData } from "@/lib/fan-profile-view";

const { getFanProfileView } = vi.hoisted(() => ({ getFanProfileView: vi.fn() }));
vi.mock("@/lib/fan-profile-view", () => ({ getFanProfileView }));

const { default: FanProfilePage } = await import("./page");

function makeProfile(overrides: Partial<PublicFanProfile> = {}): PublicFanProfile {
  return {
    id: "profile-1",
    displayName: "Fan One",
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
    artists: [],
    photoUrl: null,
    setlistSongs: [],
    favoriteSongs: [],
    social: {},
    ...overrides,
  };
}

async function renderPage(data: FanProfileViewData) {
  getFanProfileView.mockResolvedValue(data);
  const jsx = await FanProfilePage({ params: Promise.resolve({ id: "profile-1" }) });
  render(jsx);
}

describe("FanProfilePage", () => {
  it("shows an error message when the profile fails to load", async () => {
    await renderPage({ status: "error" });

    expect(screen.getByText(/no pudimos cargar este perfil/i)).toBeInTheDocument();
  });

  it("shows a not-found message when the profile does not exist", async () => {
    await renderPage({ status: "not-found" });

    expect(screen.getByText(/no se encontró este perfil/i)).toBeInTheDocument();
  });

  it("shows displayName and city", async () => {
    await renderPage({ status: "ok", profile: makeProfile() });

    expect(screen.getByRole("heading", { name: "Fan One" })).toBeInTheDocument();
    expect(screen.getByText("Monterrey, Mexico")).toBeInTheDocument();
  });

  it("never exposes email or userId", async () => {
    await renderPage({ status: "ok", profile: makeProfile() });

    expect(document.body.innerHTML).not.toContain("email");
    expect(document.body.innerHTML).not.toContain("userId");
  });

  it("shows the photo when present", async () => {
    await renderPage({
      status: "ok",
      profile: makeProfile({ photoUrl: "https://lh3.googleusercontent.com/a/photo.jpg" }),
    });

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/photo.jpg",
    );
  });

  it("does not render a photo element when absent", async () => {
    await renderPage({ status: "ok", profile: makeProfile({ photoUrl: null }) });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("hides the Social section entirely when there are no public social links", async () => {
    await renderPage({ status: "ok", profile: makeProfile({ social: {} }) });

    expect(screen.queryByText(/^social$/i)).not.toBeInTheDocument();
  });

  it("shows only the public social links", async () => {
    await renderPage({
      status: "ok",
      profile: makeProfile({ social: { instagram: "https://instagram.com/fan" } }),
    });

    const link = screen.getByRole("link", { name: /instagram/i });
    expect(link).toHaveAttribute("href", "https://instagram.com/fan");
    expect(screen.queryByText(/tiktok/i)).not.toBeInTheDocument();
  });

  it("hides the Top 10 section when there are no favorite songs", async () => {
    await renderPage({ status: "ok", profile: makeProfile({ favoriteSongs: [] }) });

    expect(screen.queryByText(/top 10/i)).not.toBeInTheDocument();
  });

  it("shows the Top 10, ordered by position", async () => {
    await renderPage({
      status: "ok",
      profile: makeProfile({
        favoriteSongs: [
          { id: "song-b", title: "Choke", albumTitle: null, position: 2 },
          { id: "song-a", title: "Automatic Sun", albumTitle: null, position: 1 },
        ],
      }),
    });

    expect(screen.getByText(/top 10/i)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["1. Automatic Sun", "2. Choke"]);
  });

  it("hides the setlist section when there are no setlist songs", async () => {
    await renderPage({ status: "ok", profile: makeProfile({ setlistSongs: [] }) });

    expect(screen.queryByText(/mi setlist/i)).not.toBeInTheDocument();
  });

  it("shows the setlist, ordered by position", async () => {
    await renderPage({
      status: "ok",
      profile: makeProfile({
        setlistSongs: [
          { id: "song-b", title: "Choke", albumTitle: null, position: 2 },
          { id: "song-a", title: "Automatic Sun", albumTitle: null, position: 1 },
        ],
      }),
    });

    expect(screen.getByText(/mi setlist/i)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["1. Automatic Sun", "2. Choke"]);
  });

  // Requisito central de la etapa: son dos listas completamente
  // independientes — una canción en una no implica nada sobre la otra, y
  // ambas se muestran a la vez, cada una en su propia sección.
  it("shows the setlist and the Top 10 independently, even when they share and differ in songs", async () => {
    await renderPage({
      status: "ok",
      profile: makeProfile({
        setlistSongs: [{ id: "song-a", title: "Automatic Sun", albumTitle: null, position: 1 }],
        favoriteSongs: [{ id: "song-b", title: "Choke", albumTitle: null, position: 1 }],
      }),
    });

    const setlistSection = screen.getByText(/mi setlist/i).closest("section")!;
    const topSection = screen.getByText(/top 10/i).closest("section")!;

    expect(setlistSection).toHaveTextContent("Automatic Sun");
    expect(setlistSection).not.toHaveTextContent("Choke");
    expect(topSection).toHaveTextContent("Choke");
    expect(topSection).not.toHaveTextContent("Automatic Sun");
  });

  it("shows artists the fan follows", async () => {
    await renderPage({
      status: "ok",
      profile: makeProfile({
        artists: [{ id: "artist-1", name: "The Warning", slug: "the-warning", imageUrl: null }],
      }),
    });

    expect(screen.getByText("The Warning")).toBeInTheDocument();
  });

  it("offers a way back to the artist page", async () => {
    await renderPage({ status: "ok", profile: makeProfile() });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });
});
