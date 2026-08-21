import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

// Landing estática, sin fetching ni estados: no hace falta mockear nada acá,
// a diferencia del resto de las páginas.
describe("Home (landing)", () => {
  it("shows the main heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /the warning fanmap/i }),
    ).toBeInTheDocument();
  });

  it("shows the tagline", () => {
    render(<Home />);

    expect(
      screen.getByText(/el mapa de fans de the warning\./i),
    ).toBeInTheDocument();
  });

  it("links the primary CTA to the artist page", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: /explorar fanmap/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("links the secondary CTA to the join page", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: /sumate al fanmap/i }),
    ).toHaveAttribute("href", "/join");
  });
});
