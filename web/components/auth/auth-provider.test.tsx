import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { CurrentUser } from "@/lib/api";

const { getCurrentUser, logoutApi } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  logoutApi: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getCurrentUser,
  logout: logoutApi,
}));

const { AuthProvider, useAuth } = await import("./auth-provider");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function AuthProbe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{user?.email ?? "none"}</p>
      <button onClick={() => void logout()}>Cerrar sesión</button>
    </div>
  );
}

const user: CurrentUser = { id: "user-1", email: "fan@example.com" };

beforeEach(() => {
  getCurrentUser.mockReset();
  logoutApi.mockReset().mockResolvedValue(undefined);
});

describe("AuthProvider / useAuth", () => {
  it("starts in the loading state before GET /auth/me resolves", async () => {
    const { promise } = deferred<CurrentUser | null>();
    getCurrentUser.mockReturnValue(promise);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
  });

  it("becomes authenticated with the resolved user when GET /auth/me returns 200", async () => {
    getCurrentUser.mockResolvedValue(user);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("fan@example.com");
  });

  it("becomes unauthenticated (user null) when GET /auth/me returns 401 (getCurrentUser resolves null)", async () => {
    getCurrentUser.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });

  // No debe confundirse un error real de la API con "no autenticado": la UI
  // no debe empujar al usuario a un loop de login cuando en realidad la API
  // está caída.
  it("surfaces a distinct error state for a real API failure, without treating it as unauthenticated", async () => {
    getCurrentUser.mockRejectedValue(new Error("Failed to fetch current user: 500"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("error"),
    );
    expect(screen.getByTestId("status")).not.toHaveTextContent("unauthenticated");
  });

  it("logs out: calls the API, clears the user, and becomes unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(user);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() => expect(logoutApi).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });

  // La cookie de sesión es httpOnly y debe seguir siéndolo: el frontend no
  // debe guardar ningún id de sesión (ni el user) en storage del browser.
  it("never persists anything to localStorage or sessionStorage", async () => {
    const localSetItem = vi.spyOn(Storage.prototype, "setItem");
    getCurrentUser.mockResolvedValue(user);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    await waitFor(() => expect(logoutApi).toHaveBeenCalled());

    expect(localSetItem).not.toHaveBeenCalled();
    localSetItem.mockRestore();
  });

  it("throws when useAuth is used outside an AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<AuthProbe />)).toThrow(/useAuth/);

    consoleError.mockRestore();
  });
});
