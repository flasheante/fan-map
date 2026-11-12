import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { useAuth, usePathname } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePathname: vi.fn(),
}));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));
vi.mock("next/navigation", () => ({ usePathname }));

const { SiteHeader, getActiveSection } = await import("./site-header");

function renderHeader(
  pathname = "/artists/the-warning",
  status: "authenticated" | "unauthenticated" | "loading" = "unauthenticated",
) {
  usePathname.mockReturnValue(pathname);
  useAuth.mockReturnValue({ status, user: null, logout: vi.fn() });
  render(<SiteHeader />);
}

// Links de navegación del bloque desktop (el menú mobile, cerrado por
// default, no está montado).
const historyLink = () => screen.getByRole("link", { name: /^historial de shows$/i });
const fanMapLink = () => screen.getByRole("link", { name: /^fan map$/i });

describe("getActiveSection", () => {
  it.each([
    ["/artists/the-warning", null],
    ["/artists/the-warning/tour", "tour"],
    ["/artists/the-warning/tour/city-1", "tour"],
    ["/artists/the-warning/shows/show-1", "tour"],
    ["/map", "fans"],
    ["/profile", "profile"],
    ["/join", "profile"],
    ["/fans/fan-1", null],
  ])("%s -> %s", (pathname, expected) => {
    expect(getActiveSection(pathname)).toBe(expected);
  });
});

describe("SiteHeader", () => {
  beforeEach(() => {
    useAuth.mockReset();
    usePathname.mockReset();
  });

  it("is not rendered on the landing page", () => {
    renderHeader("/");

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("links the logo to the artist home", () => {
    renderHeader();

    expect(
      screen.getByRole("link", { name: /the warning — inicio/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("uses the same section names everywhere", () => {
    renderHeader("/map");

    expect(historyLink()).toHaveAttribute("href", "/artists/the-warning/tour");
    expect(fanMapLink()).toHaveAttribute("href", "/map");
  });

  it("shows 'Sumate al Fan Map' linking to /join when logged out", () => {
    renderHeader();

    expect(
      screen.getByRole("link", { name: /^sumate al fan map$/i }),
    ).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("link", { name: /^perfil$/i })).not.toBeInTheDocument();
  });

  it("shows the logged-out button while the session is still loading, so it doesn't flash", () => {
    renderHeader("/artists/the-warning", "loading");

    expect(screen.getByRole("link", { name: /^sumate al fan map$/i })).toBeInTheDocument();
  });

  // El pedido original: desde el Fan Map no se podía volver al perfil.
  it("offers 'Perfil' from the Fan Map when logged in", () => {
    renderHeader("/map", "authenticated");

    expect(screen.getByRole("link", { name: /^perfil$/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("marks Fan Map as the current section on /map", () => {
    renderHeader("/map");

    expect(fanMapLink()).toHaveAttribute("aria-current", "page");
    expect(historyLink()).not.toHaveAttribute("aria-current");
  });

  it("marks Historial de shows as the current section on a show page", () => {
    renderHeader("/artists/the-warning/shows/show-1");

    expect(historyLink()).toHaveAttribute("aria-current", "page");
    expect(fanMapLink()).not.toHaveAttribute("aria-current");
  });

  it("marks Perfil as the current section on /profile", () => {
    renderHeader("/profile", "authenticated");

    expect(screen.getByRole("link", { name: /^perfil$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks no section on the artist home", () => {
    renderHeader("/artists/the-warning");

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("stays fixed at the top above the Leaflet maps", () => {
    renderHeader();

    expect(screen.getByRole("banner")).toHaveClass("sticky", "top-0", "z-[1100]");
  });

  describe("mobile menu", () => {
    it("starts closed", () => {
      renderHeader();

      expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.getAllByRole("link", { name: /^fan map$/i })).toHaveLength(1);
    });

    it("opens with its own copies of the two section links, keeping the current one marked", () => {
      renderHeader("/map");

      fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));

      expect(screen.getByRole("button", { name: /cerrar menú/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(screen.getAllByRole("link", { name: /^historial de shows$/i })).toHaveLength(2);
      const fanMapLinks = screen.getAllByRole("link", { name: /^fan map$/i });
      expect(fanMapLinks).toHaveLength(2);
      expect(fanMapLinks[1]).toHaveAttribute("aria-current", "page");
    });

    it("closes when a link inside it is clicked", () => {
      renderHeader();

      fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
      const links = screen.getAllByRole("link", { name: /^fan map$/i });
      fireEvent.click(links[links.length - 1]);

      expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("closes on Escape", () => {
      renderHeader();

      fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("closes when clicking outside of it", () => {
      renderHeader();

      fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
      fireEvent.pointerDown(document.body);

      expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });
});
