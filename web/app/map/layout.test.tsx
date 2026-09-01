import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

const { default: MapLayout } = await import("./layout");

// Mismo criterio que app/artists/the-warning/layout.tsx (ver su comentario):
// /map debe sentirse parte de la misma marca The Warning FanMap, con fondo
// negro fijo y texto blanco, independiente de prefers-color-scheme.
describe("MapLayout", () => {
  it("wraps children in a fixed black background with white text", () => {
    render(
      <MapLayout params={Promise.resolve({})}>
        <p>contenido</p>
      </MapLayout>,
    );

    const content = screen.getByText("contenido");
    expect(content.parentElement).toHaveClass("bg-black", "text-white");
  });

  it("renders the children unchanged", () => {
    render(
      <MapLayout params={Promise.resolve({})}>
        <p>contenido</p>
      </MapLayout>,
    );

    expect(screen.getByText("contenido")).toBeInTheDocument();
  });
});
