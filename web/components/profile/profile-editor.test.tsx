import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import type { Artist, ArtistSong, Country, FanProfile } from "@/lib/api";

const {
  getCountries,
  getCities,
  getArtists,
  getArtistSongs,
  getMyFanProfile,
  updateFanProfile,
  useRouter,
} = vi.hoisted(() => ({
  getCountries: vi.fn(),
  getCities: vi.fn(),
  getArtists: vi.fn(),
  getArtistSongs: vi.fn(),
  getMyFanProfile: vi.fn(),
  updateFanProfile: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getCountries,
  getCities,
  getArtists,
  getArtistSongs,
  getMyFanProfile,
  updateFanProfile,
}));

vi.mock("next/navigation", () => ({ useRouter }));

const { ProfileEditor } = await import("./profile-editor");

const mexico: Country = { id: "country-mx", name: "Mexico", code: "MX" };
const monterrey = { id: "city-mty", name: "Monterrey", countryId: "country-mx" };

const theWarning: Artist = {
  id: "artist-warning",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  setlistsSyncedAt: null,
};

const songA: ArtistSong = {
  id: "song-a",
  title: "Automatic Sun",
  albumTitle: "XXI Century Blood",
  releaseDate: "2017-03-27",
};

const songB: ArtistSong = {
  id: "song-b",
  title: "Choke",
  albumTitle: "ERROR",
  releaseDate: "2022-06-24",
};

function makeProfile(overrides: Partial<FanProfile> = {}): FanProfile {
  return {
    id: "profile-1",
    displayName: "Fan One",
    showOnMap: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: monterrey.id,
      name: monterrey.name,
      latitude: 25.6866,
      longitude: -100.3161,
      country: mexico,
    },
    artists: [{ id: theWarning.id, name: theWarning.name, slug: theWarning.slug, imageUrl: null }],
    photoUrl: null,
    setlistSongs: [],
    favoriteSongs: [],
    instagramUrl: null,
    instagramIsPublic: false,
    tiktokUrl: null,
    tiktokIsPublic: false,
    xUrl: null,
    xIsPublic: false,
    youtubeUrl: null,
    youtubeIsPublic: false,
    facebookUrl: null,
    facebookIsPublic: false,
    ...overrides,
  };
}

beforeEach(() => {
  getCountries.mockReset().mockResolvedValue([mexico]);
  getCities.mockReset().mockResolvedValue([monterrey]);
  getArtists.mockReset().mockResolvedValue([theWarning]);
  getArtistSongs.mockReset().mockResolvedValue([songA, songB]);
  getMyFanProfile.mockReset();
  updateFanProfile.mockReset();
  useRouter.mockReset();
  useRouter.mockReturnValue({ replace: vi.fn(), push: vi.fn() });
});

async function renderReady(profile: FanProfile = makeProfile()) {
  getMyFanProfile.mockResolvedValue(profile);
  render(<ProfileEditor />);
  await screen.findByLabelText(/nombre/i);
  return profile;
}

describe("ProfileEditor", () => {
  it("shows a loading state while fetching", () => {
    getMyFanProfile.mockReturnValue(new Promise(() => {}));

    render(<ProfileEditor />);

    expect(screen.getByText(/cargando tu perfil/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    getMyFanProfile.mockRejectedValue(new Error("network error"));

    render(<ProfileEditor />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos cargar/i);
  });

  it("shows a CTA to /join when the authenticated user has no fan profile yet", async () => {
    getMyFanProfile.mockResolvedValue(null);

    render(<ProfileEditor />);

    const cta = await screen.findByRole("link", { name: /sumate al mapa/i });
    expect(cta).toHaveAttribute("href", "/join");
  });

  it("prefills the form with the loaded profile", async () => {
    await renderReady();

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Fan One");
    expect(screen.getByLabelText(/país/i)).toHaveValue(mexico.id);
    await waitFor(() => expect(screen.getByLabelText(/ciudad/i)).toHaveValue(monterrey.id));
    expect(screen.getByLabelText(/mostrarme en el mapa/i)).toBeChecked();
    expect(screen.getByLabelText("The Warning")).toBeChecked();
  });

  it("shows the Google photo when the profile has one", async () => {
    await renderReady(makeProfile({ photoUrl: "https://lh3.googleusercontent.com/a/photo.jpg" }));

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/photo.jpg",
    );
  });

  it("does not render a photo element when the profile has none", async () => {
    await renderReady(makeProfile({ photoUrl: null }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("prefills existing favorite songs into the Top 10 editor", async () => {
    await renderReady(
      makeProfile({
        favoriteSongs: [{ id: songA.id, title: songA.title, albumTitle: songA.albumTitle, position: 1 }],
      }),
    );

    expect(screen.getByText("Automatic Sun")).toBeInTheDocument();
    // Setlist en blanco (0/15) y Top 10 con una canción (1/10) — dos
    // contadores independientes, ver SongListEditor x2 en ProfileEditor.
    expect(screen.getByText("0/15")).toBeInTheDocument();
    expect(screen.getByText("1/10")).toBeInTheDocument();
  });

  it("prefills existing setlist songs into the setlist editor, independently of favorites", async () => {
    await renderReady(
      makeProfile({
        setlistSongs: [{ id: songB.id, title: songB.title, albumTitle: songB.albumTitle, position: 1 }],
        favoriteSongs: [{ id: songA.id, title: songA.title, albumTitle: songA.albumTitle, position: 1 }],
      }),
    );

    expect(screen.getByText("1/15")).toBeInTheDocument();
    expect(screen.getByText("1/10")).toBeInTheDocument();
    expect(screen.getByText("Choke")).toBeInTheDocument();
    expect(screen.getByText("Automatic Sun")).toBeInTheDocument();
  });

  it("prefills existing social links into the social editor", async () => {
    await renderReady(
      makeProfile({ instagramUrl: "https://instagram.com/fan", instagramIsPublic: true }),
    );

    expect(screen.getByLabelText("Instagram")).toHaveValue("https://instagram.com/fan");
    expect(
      within(screen.getByLabelText("Instagram").closest("div")!).queryByRole("checkbox"),
    ).toBeChecked();
  });

  it("saves the full profile state via updateFanProfile on submit", async () => {
    const profile = await renderReady();
    updateFanProfile.mockResolvedValue(profile);

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Renamed Fan" } });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(updateFanProfile).toHaveBeenCalled());
    expect(updateFanProfile).toHaveBeenCalledWith(
      profile.id,
      expect.objectContaining({
        displayName: "Renamed Fan",
        cityId: monterrey.id,
        showOnMap: true,
        artistIds: [theWarning.id],
        setlistSongs: [],
        favoriteSongs: [],
      }),
    );
  });

  it("shows a success message after saving", async () => {
    const profile = await renderReady();
    updateFanProfile.mockResolvedValue(profile);

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/perfil guardado/i)).toBeInTheDocument();
  });

  // Cambio de navegabilidad: guardar (con o sin cambios de setlist/
  // favoritas) manda directo al fan map.
  it("navigates to the fan map after a successful save", async () => {
    const profile = await renderReady();
    updateFanProfile.mockResolvedValue(profile);
    const push = vi.fn();
    useRouter.mockReturnValue({ replace: vi.fn(), push });

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/map?view=fans"));
  });

  // Cubre el caso "o no" hizo cambios: un link siempre visible para salir
  // al mapa sin pasar por Guardar.
  it("always offers a link straight to the fan map, even without saving", async () => {
    await renderReady();

    const mapLink = screen.getByRole("link", { name: /ir al mapa/i });
    expect(mapLink).toHaveAttribute("href", "/map?view=fans");
    expect(updateFanProfile).not.toHaveBeenCalled();
  });

  it("shows an API error message when saving fails", async () => {
    await renderReady();
    updateFanProfile.mockRejectedValue(new Error("At most 15 favoriteSongs"));

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at most 15 favoritesongs/i);
  });

  it("discards unsaved changes when Cancelar is clicked", async () => {
    await renderReady();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Unsaved Name" } });
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Fan One");
    expect(updateFanProfile).not.toHaveBeenCalled();
  });
});
