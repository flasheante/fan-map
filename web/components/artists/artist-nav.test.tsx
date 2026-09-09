import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));

const { ArtistNav } = await import("./artist-nav");

function renderNav() {
  useAuth.mockReturnValue({ status: "unauthenticated", user: null, logout: vi.fn() });
  render(<ArtistNav />);
}

describe("ArtistNav", () => {
  it("always shows the primary CTA and the desktop nav links", () => {
    renderNav();

    expect(screen.getByRole("link", { name: /join the fanmap/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /historial de shows/i })).toHaveAttribute(
      "href",
      "/artists/the-warning/tour",
    );
    expect(screen.getByRole("link", { name: /fan map/i })).toHaveAttribute(
      "href",
      "/map?view=fans",
    );
  });

  // Menú de mobile (ver auditoría de navegación mobile): los links de
  // "Historial de shows"/"Fan Map" del bloque desktop siguen montados
  // (se ocultan por CSS, `sm:flex`) — el menú colapsable es contenido
  // aparte, cerrado por default.
  it("starts with the mobile menu closed", () => {
    renderNav();

    expect(
      screen.getByRole("button", { name: /abrir menú/i }),
    ).toHaveAttribute("aria-expanded", "false");
    // El menú colapsable sólo se monta cuando está abierto: cerrado, cada
    // link del header existe una única vez (el del bloque desktop).
    expect(screen.getAllByRole("link", { name: /fan map/i })).toHaveLength(1);
  });

  it("opens the mobile menu (with its own copies of the two nav links) when the toggle is clicked", () => {
    renderNav();

    fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));

    expect(
      screen.getByRole("button", { name: /cerrar menú/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link", { name: /historial de shows/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /fan map/i })).toHaveLength(2);
  });

  it("closes the mobile menu when a link inside it is clicked", () => {
    renderNav();

    fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    const menuLinks = screen.getAllByRole("link", { name: /fan map/i });
    fireEvent.click(menuLinks[menuLinks.length - 1]);

    expect(
      screen.getByRole("button", { name: /abrir menú/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile menu on Escape", () => {
    renderNav();

    fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(screen.getByRole("button", { name: /cerrar menú/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("closes the mobile menu when clicking outside of it", () => {
    renderNav();

    fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(screen.getByRole("button", { name: /cerrar menú/i })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
