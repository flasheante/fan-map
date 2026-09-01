import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { FanProfile } from "@/lib/api";
import type { AuthStatus } from "@/components/auth/auth-provider";

const { useAuth, getMyFanProfile, googleLoginUrl } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getMyFanProfile: vi.fn(),
  googleLoginUrl: vi.fn(() => "http://localhost:3000/auth/google"),
}));

vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));
vi.mock("@/lib/api", () => ({ getMyFanProfile, googleLoginUrl }));
vi.mock("@/components/join/fan-form", () => ({
  FanForm: () => <div data-testid="fan-form" />,
}));

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
};

beforeEach(() => {
  useAuth.mockReset();
  getMyFanProfile.mockReset();
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

  it("shows a 'continue' state (not the form) when authenticated and already has a fan profile", async () => {
    mockAuth("authenticated", { id: "user-1", email: "fan@example.com" });
    getMyFanProfile.mockResolvedValue(fanProfile);

    render(<JoinFlow />);

    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId("fan-form")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute(
      "href",
      "/map?view=fans",
    );
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
