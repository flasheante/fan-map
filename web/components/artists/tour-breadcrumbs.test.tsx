import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourBreadcrumbs } from "./tour-breadcrumbs";

const MENDOZA_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("TourBreadcrumbs", () => {
  describe("level: tour (/artists/the-warning/tour)", () => {
    it("shows The Warning / Historial de shows", () => {
      render(<TourBreadcrumbs level="tour" artistName="The Warning" />);

      expect(
        screen.getByRole("link", { name: "The Warning" }),
      ).toHaveAttribute("href", "/artists/the-warning");
      expect(screen.getByText("Historial de shows")).toBeInTheDocument();
    });

    it("does not render the current page as a link", () => {
      render(<TourBreadcrumbs level="tour" artistName="The Warning" />);

      expect(
        screen.queryByRole("link", { name: "Historial de shows" }),
      ).not.toBeInTheDocument();
    });

    it("marks the current page with aria-current", () => {
      render(<TourBreadcrumbs level="tour" artistName="The Warning" />);

      expect(screen.getByText("Historial de shows")).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

  describe("level: city (/artists/the-warning/tour/[cityId])", () => {
    it("shows The Warning / Historial de shows / Mendoza", () => {
      render(
        <TourBreadcrumbs
          level="city"
          artistName="The Warning"
          cityName="Mendoza"
        />,
      );

      expect(
        screen.getByRole("link", { name: "The Warning" }),
      ).toHaveAttribute("href", "/artists/the-warning");
      expect(
        screen.getByRole("link", { name: "Historial de shows" }),
      ).toHaveAttribute("href", "/artists/the-warning/tour");
      expect(screen.getByText("Mendoza")).toBeInTheDocument();
    });

    it("does not render the current city as a link", () => {
      render(
        <TourBreadcrumbs
          level="city"
          artistName="The Warning"
          cityName="Mendoza"
        />,
      );

      expect(
        screen.queryByRole("link", { name: "Mendoza" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Mendoza")).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

  describe("level: show (/artists/the-warning/shows/[showId])", () => {
    it("shows The Warning / Historial de shows / Mendoza / <fecha>", () => {
      render(
        <TourBreadcrumbs
          level="show"
          artistName="The Warning"
          city={{ id: MENDOZA_ID, name: "Mendoza" }}
          showDate="2026-08-20T00:00:00.000Z"
        />,
      );

      expect(
        screen.getByRole("link", { name: "The Warning" }),
      ).toHaveAttribute("href", "/artists/the-warning");
      expect(
        screen.getByRole("link", { name: "Historial de shows" }),
      ).toHaveAttribute("href", "/artists/the-warning/tour");
      expect(screen.getByRole("link", { name: "Mendoza" })).toHaveAttribute(
        "href",
        `/artists/the-warning/tour/${MENDOZA_ID}`,
      );
      expect(screen.getByText(/20 de agosto de 2026/i)).toBeInTheDocument();
    });

    it("does not render the show date as a link", () => {
      render(
        <TourBreadcrumbs
          level="show"
          artistName="The Warning"
          city={{ id: MENDOZA_ID, name: "Mendoza" }}
          showDate="2026-08-20T00:00:00.000Z"
        />,
      );

      expect(
        screen.queryByRole("link", { name: /20 de agosto de 2026/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/20 de agosto de 2026/i)).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("falls back to a plain 'Show' step when the show has no city, without breaking", () => {
      render(
        <TourBreadcrumbs
          level="show"
          artistName="The Warning"
          city={null}
          showDate="2026-08-20T00:00:00.000Z"
        />,
      );

      expect(
        screen.getByRole("link", { name: "The Warning" }),
      ).toHaveAttribute("href", "/artists/the-warning");
      expect(
        screen.getByRole("link", { name: "Historial de shows" }),
      ).toHaveAttribute("href", "/artists/the-warning/tour");
      expect(screen.getByText("Show")).toBeInTheDocument();
      expect(screen.getByText("Show")).toHaveAttribute(
        "aria-current",
        "page",
      );
      // Sin ciudad no hay link de ciudad ni fecha formateada.
      expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
      expect(screen.getAllByRole("link")).toHaveLength(2);
    });
  });

  it("does not render internal UUIDs as visible text", () => {
    render(
      <TourBreadcrumbs
        level="show"
        artistName="The Warning"
        city={{ id: MENDOZA_ID, name: "Mendoza" }}
        showDate="2026-08-20T00:00:00.000Z"
      />,
    );

    expect(screen.queryByText(MENDOZA_ID)).not.toBeInTheDocument();
  });

  it("is a labeled navigation landmark", () => {
    render(<TourBreadcrumbs level="tour" artistName="The Warning" />);

    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toBeInTheDocument();
  });
});
