import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));

vi.mock("@/components/profile/profile-editor", () => ({
  ProfileEditor: () => <div data-testid="profile-editor">editor</div>,
}));

const { default: ProfilePage } = await import("./page");

describe("ProfilePage", () => {
  it("shows a loading state while auth is resolving", () => {
    useAuth.mockReturnValue({ status: "loading", user: null, logout: vi.fn() });

    render(<ProfilePage />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByTestId("profile-editor")).not.toBeInTheDocument();
  });

  it("shows an error state when the session check fails", () => {
    useAuth.mockReturnValue({ status: "error", user: null, logout: vi.fn() });

    render(<ProfilePage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/no pudimos verificar/i);
  });

  it("offers a Google login link when unauthenticated, without mounting the editor", () => {
    useAuth.mockReturnValue({ status: "unauthenticated", user: null, logout: vi.fn() });

    render(<ProfilePage />);

    expect(screen.getByRole("link", { name: /continuar con google/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/auth/google"),
    );
    expect(screen.queryByTestId("profile-editor")).not.toBeInTheDocument();
  });

  it("mounts the ProfileEditor only when authenticated", () => {
    useAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "fan@example.com" },
      logout: vi.fn(),
    });

    render(<ProfilePage />);

    expect(screen.getByTestId("profile-editor")).toBeInTheDocument();
  });

  // Pedido: dentro del perfil tiene que poder cerrarse sesión.
  it("offers a way to log out when authenticated", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "fan@example.com" },
      logout,
    });

    render(<ProfilePage />);

    expect(screen.getByText("fan@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it("does not show the logout control before authentication resolves", () => {
    useAuth.mockReturnValue({ status: "loading", user: null, logout: vi.fn() });

    render(<ProfilePage />);

    expect(screen.queryByRole("button", { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });

  it("does not show the logout control when unauthenticated", () => {
    useAuth.mockReturnValue({ status: "unauthenticated", user: null, logout: vi.fn() });

    render(<ProfilePage />);

    expect(screen.queryByRole("button", { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page", () => {
    useAuth.mockReturnValue({ status: "loading", user: null, logout: vi.fn() });

    render(<ProfilePage />);

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });
});
