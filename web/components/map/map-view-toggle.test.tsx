import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Next Link no expone `replace` como atributo DOM: se mockea para poder
// verificar que el toggle nunca usa push (ver el pedido: "nunca push").
vi.mock("next/link", () => ({
  default: ({
    href,
    replace,
    children,
    ...rest
  }: {
    href: string;
    replace?: boolean;
    children: React.ReactNode;
  }) => (
    <a href={href} data-replace={replace ? "true" : "false"} {...rest}>
      {children}
    </a>
  ),
}));

const { MapViewToggle } = await import("./map-view-toggle");

describe("MapViewToggle", () => {
  it("renders a link to the tour view and a link to the fans view", () => {
    render(
      <MapViewToggle
        activeView="tour"
        tourHref="/map"
        fansHref="/map?view=fans"
      />,
    );

    expect(screen.getByRole("link", { name: /historial/i })).toHaveAttribute(
      "href",
      "/map",
    );
    expect(screen.getByRole("link", { name: /fan map/i })).toHaveAttribute(
      "href",
      "/map?view=fans",
    );
  });

  it("uses replace navigation, never push, for both links", () => {
    render(
      <MapViewToggle
        activeView="tour"
        tourHref="/map"
        fansHref="/map?view=fans"
      />,
    );

    expect(screen.getByRole("link", { name: /historial/i })).toHaveAttribute(
      "data-replace",
      "true",
    );
    expect(screen.getByRole("link", { name: /fan map/i })).toHaveAttribute(
      "data-replace",
      "true",
    );
  });

  it("marks the tour link as the current page when active", () => {
    render(
      <MapViewToggle
        activeView="tour"
        tourHref="/map"
        fansHref="/map?view=fans"
      />,
    );

    expect(screen.getByRole("link", { name: /historial/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /fan map/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the fans link as the current page when active", () => {
    render(
      <MapViewToggle
        activeView="fans"
        tourHref="/map"
        fansHref="/map?view=fans"
      />,
    );

    expect(screen.getByRole("link", { name: /fan map/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /historial/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("visually distinguishes the active link from the inactive one", () => {
    render(
      <MapViewToggle
        activeView="fans"
        tourHref="/map"
        fansHref="/map?view=fans"
      />,
    );

    const tourLink = screen.getByRole("link", { name: /historial/i });
    const fansLink = screen.getByRole("link", { name: /fan map/i });

    expect(tourLink.className).not.toBe(fansLink.className);
  });

  // Responsive básico: en pantallas angostas el toggle debe apilar/wrappear
  // sus dos botones en vez de desbordar horizontalmente (mismo criterio que
  // el header de MapExplorer, ver map-explorer.test.tsx).
  it("wraps its buttons instead of overflowing on narrow screens", () => {
    render(
      <MapViewToggle
        activeView="tour"
        tourHref="/map"
        fansHref="/map?view=fans"
      />,
    );

    expect(screen.getByRole("navigation")).toHaveClass("flex-wrap");
  });
});
