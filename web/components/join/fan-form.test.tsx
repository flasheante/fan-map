import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { Artist, Country } from "@/lib/api";

const { getCountries, getCities, getArtists, createFanProfile, useRouter } =
  vi.hoisted(() => ({
    getCountries: vi.fn(),
    getCities: vi.fn(),
    getArtists: vi.fn(),
    createFanProfile: vi.fn(),
    useRouter: vi.fn(),
  }));

vi.mock("@/lib/api", () => ({
  getCountries,
  getCities,
  getArtists,
  createFanProfile,
}));

vi.mock("next/navigation", () => ({ useRouter }));

const { FanForm } = await import("./fan-form");

const mexico: Country = { id: "country-mx", name: "Mexico", code: "MX" };
const spain: Country = { id: "country-es", name: "Spain", code: "ES" };

const monterrey = { id: "city-mty", name: "Monterrey", countryId: "country-mx" };
const cdmx = { id: "city-cdmx", name: "Ciudad de México", countryId: "country-mx" };
const madrid = { id: "city-mad", name: "Madrid", countryId: "country-es" };

const theWarning: Artist = {
  id: "artist-warning-xyz",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const otherBand: Artist = {
  id: "artist-other-abc",
  name: "Other Band",
  slug: "other-band",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderReadyForm() {
  render(<FanForm />);
  await screen.findByLabelText(/nombre/i);
}

async function selectCountryAndCity(countryId = mexico.id, cityId = monterrey.id) {
  fireEvent.change(screen.getByLabelText(/país/i), {
    target: { value: countryId },
  });
  const citySelect = await screen.findByLabelText(/ciudad/i);
  await waitFor(() => {
    expect(within(citySelect).getAllByRole("option").length).toBeGreaterThan(1);
  });
  fireEvent.change(citySelect, { target: { value: cityId } });
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/nombre/i), {
    target: { value: "Ana Fan" },
  });
}

beforeEach(() => {
  getCountries.mockReset().mockResolvedValue([mexico, spain]);
  getArtists.mockReset().mockResolvedValue([theWarning, otherBand]);
  getCities.mockReset().mockImplementation((countryId: string) => {
    if (countryId === mexico.id) return Promise.resolve([monterrey, cdmx]);
    if (countryId === spain.id) return Promise.resolve([madrid]);
    return Promise.resolve([]);
  });
  createFanProfile.mockReset();
  useRouter.mockReset();
  useRouter.mockReturnValue({ replace: vi.fn(), push: vi.fn() });
});

describe("FanForm", () => {
  it("shows a loading state and then renders the form", async () => {
    render(<FanForm />);

    expect(screen.getByText(/cargando formulario/i)).toBeInTheDocument();

    await screen.findByLabelText(/nombre/i);

    // Etapa 3: ya no hay campo de email — el User se resuelve de la
    // sesión, no de un input del formulario.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/país/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ciudad/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /crear perfil/i }),
    ).toBeInTheDocument();
  });

  it("shows a friendly error when initial data fails to load", async () => {
    getCountries.mockRejectedValue(new Error("network error"));

    render(<FanForm />);

    expect(
      await screen.findByText(/no pudimos cargar el formulario/i),
    ).toBeInTheDocument();
  });

  it("loads countries from GET /countries and lists them", async () => {
    await renderReadyForm();

    expect(getCountries).toHaveBeenCalled();
    const countrySelect = screen.getByLabelText(/país/i);
    expect(within(countrySelect).getByText("Mexico")).toBeInTheDocument();
    expect(within(countrySelect).getByText("Spain")).toBeInTheDocument();
  });

  it("allows selecting a country", async () => {
    await renderReadyForm();

    const countrySelect = screen.getByLabelText(/país/i) as HTMLSelectElement;
    fireEvent.change(countrySelect, { target: { value: mexico.id } });

    expect(countrySelect.value).toBe(mexico.id);
  });

  it("loads the matching cities when a country is selected", async () => {
    await renderReadyForm();

    fireEvent.change(screen.getByLabelText(/país/i), {
      target: { value: mexico.id },
    });

    await waitFor(() => expect(getCities).toHaveBeenCalledWith(mexico.id));

    const citySelect = await screen.findByLabelText(/ciudad/i);
    expect(within(citySelect).getByText("Monterrey")).toBeInTheDocument();
    expect(within(citySelect).getByText("Ciudad de México")).toBeInTheDocument();
  });

  it("clears the selected city and reloads cities when the country changes", async () => {
    await renderReadyForm();
    await selectCountryAndCity(mexico.id, monterrey.id);

    const citySelect = screen.getByLabelText(/ciudad/i) as HTMLSelectElement;
    expect(citySelect.value).toBe(monterrey.id);

    fireEvent.change(screen.getByLabelText(/país/i), {
      target: { value: spain.id },
    });

    await waitFor(() => expect(getCities).toHaveBeenCalledWith(spain.id));
    expect((screen.getByLabelText(/ciudad/i) as HTMLSelectElement).value).toBe(
      "",
    );
  });

  it("shows an appropriate state when the selected country has no cities", async () => {
    getCities.mockImplementation(() => Promise.resolve([]));
    await renderReadyForm();

    fireEvent.change(screen.getByLabelText(/país/i), {
      target: { value: mexico.id },
    });

    expect(
      await screen.findByText(/no hay ciudades disponibles/i),
    ).toBeInTheDocument();
  });

  it("loads artists from GET /artists and lists them", async () => {
    await renderReadyForm();

    expect(getArtists).toHaveBeenCalled();
    expect(screen.getByLabelText("The Warning")).toBeInTheDocument();
    expect(screen.getByLabelText("Other Band")).toBeInTheDocument();
  });

  it("shows an empty state when there are no artists", async () => {
    getArtists.mockResolvedValue([]);
    await renderReadyForm();

    expect(screen.getByText(/no hay artistas disponibles/i)).toBeInTheDocument();
  });

  it("finds and pre-selects The Warning by its slug", async () => {
    await renderReadyForm();

    expect(screen.getByLabelText("The Warning")).toBeChecked();
    expect(screen.getByLabelText("Other Band")).not.toBeChecked();
  });

  it("allows selecting/deselecting artists", async () => {
    await renderReadyForm();

    const otherCheckbox = screen.getByLabelText("Other Band");
    fireEvent.click(otherCheckbox);
    expect(otherCheckbox).toBeChecked();

    const warningCheckbox = screen.getByLabelText("The Warning");
    fireEvent.click(warningCheckbox);
    expect(warningCheckbox).not.toBeChecked();
  });

  it("allows toggling showOnMap, defaulting to enabled", async () => {
    await renderReadyForm();

    const showOnMap = screen.getByLabelText(/mostrarme en el mapa/i);
    expect(showOnMap).toBeChecked();

    fireEvent.click(showOnMap);
    expect(showOnMap).not.toBeChecked();
  });

  it("validates displayName is required", async () => {
    await renderReadyForm();
    await selectCountryAndCity();

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(await screen.findByText(/ingresá tu nombre/i)).toBeInTheDocument();
    expect(createFanProfile).not.toHaveBeenCalled();
  });

  it("validates a country is selected", async () => {
    await renderReadyForm();
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(await screen.findByText(/elegí tu país/i)).toBeInTheDocument();
    expect(createFanProfile).not.toHaveBeenCalled();
  });

  it("validates a city is selected", async () => {
    await renderReadyForm();
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/país/i), {
      target: { value: mexico.id },
    });
    await screen.findByText("Monterrey");

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(await screen.findByText(/elegí tu ciudad/i)).toBeInTheDocument();
    expect(createFanProfile).not.toHaveBeenCalled();
  });

  it("validates at least one artist is selected", async () => {
    await renderReadyForm();
    fillValidForm();
    await selectCountryAndCity();
    fireEvent.click(screen.getByLabelText("The Warning"));

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(
      await screen.findByText(/seleccioná al menos un artista/i),
    ).toBeInTheDocument();
    expect(createFanProfile).not.toHaveBeenCalled();
  });

  it("builds the correct payload and sends real artist ids on submit", async () => {
    createFanProfile.mockResolvedValue({
      id: "profile-1",
      displayName: "Ana Fan",
      showOnMap: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      city: { id: monterrey.id, name: "Monterrey", latitude: 1, longitude: 1, country: mexico },
      artists: [theWarning],
    });

    await renderReadyForm();
    fillValidForm();
    await selectCountryAndCity(mexico.id, monterrey.id);

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    await waitFor(() =>
      expect(createFanProfile).toHaveBeenCalledWith({
        displayName: "Ana Fan",
        cityId: monterrey.id,
        showOnMap: true,
        artistIds: [theWarning.id],
      }),
    );
    // El User se resuelve de la sesión (SessionAuthGuard), nunca de un
    // campo enviado por el cliente.
    const [payload] = createFanProfile.mock.calls[0] as [Record<string, unknown>];
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("userId");
  });

  it("shows a loading state while the POST is in flight", async () => {
    const { promise, resolve } = deferred<unknown>();
    createFanProfile.mockReturnValue(promise);

    await renderReadyForm();
    fillValidForm();
    await selectCountryAndCity();

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(await screen.findByText(/enviando/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviando/i })).toBeDisabled();

    resolve({
      id: "profile-1",
      displayName: "Ana Fan",
      showOnMap: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      city: { id: monterrey.id, name: "Monterrey", latitude: 1, longitude: 1, country: mexico },
      artists: [theWarning],
    });

    await screen.findByText(/tu perfil se creó correctamente/i);
  });

  it("shows a friendly error when the POST fails", async () => {
    createFanProfile.mockRejectedValue(
      new Error("User already has a fan profile"),
    );

    await renderReadyForm();
    fillValidForm();
    await selectCountryAndCity();

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(
      await screen.findByText(/no pudimos crear tu perfil/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/already has a fan profile/i)).toBeInTheDocument();
  });

  it("shows a success confirmation and redirects to /profile after a successful POST, without exposing any userId", async () => {
    const replace = vi.fn();
    useRouter.mockReturnValue({ replace, push: vi.fn() });

    createFanProfile.mockResolvedValue({
      id: "profile-1",
      displayName: "Ana Fan",
      showOnMap: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      city: { id: monterrey.id, name: "Monterrey", latitude: 1, longitude: 1, country: mexico },
      artists: [theWarning],
    });

    await renderReadyForm();
    fillValidForm();
    await selectCountryAndCity();

    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    expect(
      await screen.findByText(/tu perfil se creó correctamente/i),
    ).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
    expect(screen.queryByText(/userId/i)).not.toBeInTheDocument();
    expect(screen.queryByText("profile-1")).not.toBeInTheDocument();
  });
});
