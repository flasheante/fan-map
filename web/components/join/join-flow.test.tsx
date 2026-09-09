import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { FanProfile } from "@/lib/api";
import type { AuthStatus } from "@/components/auth/auth-provider";

const { useAuth, getMyFanProfile, googleLoginUrl, useRouter } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getMyFanProfile: vi.fn(),
  googleLoginUrl: vi.fn(() => "http://localhost:3000/auth/google"),
  useRouter: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));
vi.mock("@/lib/api", () => ({ getMyFanProfile, googleLoginUrl }));
vi.mock("@/components/join/fan-form", () => ({
  FanForm: () => <div data-testid="fan-form" />,
}));
vi.mock("next/navigation", () => ({ useRouter }));

const { JoinFlow } = await import("./join-flow");

function mockAuth(status: AuthStatus, user: { id: string; email: string } | null = null) {
  useAuth.mockReturnValue({ status, user, logout: vi.fn().mockResolvedValue(undefined) });
}

const fanProfile: FanProfile = {
  id: "profile-1",
  displayName: "Ana Fan",
  showOnMap: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  city: {
    id: "city-1",
    name: "Monterrey",
    latitude: 1,
    longitude: 1,
    country: { id: "country-1", name: "Mexico", code: "MX" },
  },
  artists: [],
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
};

beforeEach(() => {
  useAuth.mockReset();
  getMyFanProfile.mockReset();
  useRouter.mockReset();
  useRouter.mockReturnValue({ replace: vi.fn(), push: vi.fn() });
});

describe("JoinFlow", () => {
  it("shows a loading state while the auth session is still resolving, without flickering unauthenticated content", () => {
    mockAuth("loading");

    render(<JoinFlow />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("fan-form")).not.toBeInTheDocument();
  });

  it("shows a login link to GET /auth/google when unauthenticated", () => {
    mockAuth("unauthenticated");

    render(<JoinFlow />);

    const link = screen.getByRole("link", { name: /google/i });
    expect(link).toHaveAttribute("href", "http://localhost:3000/auth/google");
    expect(screen.queryByTestId("fan-form")).not.toBeInTheDocument();
  });

  // Bug reportado: sin decirle a la API a dónde volver, el login "pegaba"
  // pero terminabas en la landing en vez de acá — ver googleLoginUrl en
  // lib/api.ts y el callback en la API.
  it("asks to come back to /join after logging in", () => {
    mockAuth("unauthenticated");

    render(<JoinFlow />);

    expect(googleLoginUrl).toHaveBeenCalledWith("/join");
  });

  it("shows an error message when the session check itself failed, without prompting login", () => {
    mockAuth("error");

    render(<JoinFlow />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google/i })).not.toBeInTheDocument();
  });

  it("checks for an existing fan profile once authenticated, showing loading meanwhile", async () => {
    mockAuth("authenticated", { id: "user-1", email: "fan@example.com" });
    // Nunca se resuelve dentro de este test: solo interesa el estado
    // "loading" mientras getMyFanProfile está en vuelo.
    getMyFanProfile.mockReturnValue(new Promise<FanProfile | null>(() => {}));

    render(<JoinFlow />);

    expect(getMyFanProfile).toHaveBeenCalled();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByTestId("fan-form")).not.toBeInTheDocument();
  });

  it("renders the fan form when authenticated without a fan profile yet", async () => {
    mockAuth("authenticated", { id: "user-1", email: "fan@example.com" });
    getMyFanProfile.mockResolvedValue(null);

    render(<JoinFlow />);

    expect(await screen.findByTestId("fan-form")).toBeInTheDocument();
  });

  // Aclaración del usuario: entrar a /join ("Join the FanMap") ya logueado
  // y con perfil no debe mostrar ninguna pantalla intermedia — va directo
  // a /profile. El flujo sin perfil (formulario → mapa) queda igual.
  it("redirects to /profile when authenticated and already has a fan profile, without rendering the form", async () => {
    mockAuth("authenticated", { id: "user-1", email: "fan@example.com" });
    getMyFanProfile.mockResolvedValue(fanProfile);
    const replace = vi.fn();
    useRouter.mockReturnValue({ replace, push: vi.fn() });

    render(<JoinFlow />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
    expect(screen.queryByTestId("fan-form")).not.toBeInTheDocument();
  });

  it("shows an error message when checking the fan profile fails", async () => {
    mockAuth("authenticated", { id: "user-1", email: "fan@example.com" });
    getMyFanProfile.mockRejectedValue(new Error("network error"));

    render(<JoinFlow />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("offers a logout control once authenticated", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "fan@example.com" },
      logout,
    });
    getMyFanProfile.mockResolvedValue(null);

    render(<JoinFlow />);
    await screen.findByTestId("fan-form");

    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
