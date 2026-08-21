import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/join/fan-form", () => ({
  FanForm: () => <div data-testid="fan-form" />,
}));

const { default: JoinPage } = await import("./page");

describe("JoinPage", () => {
  it("renders a heading and the fan registration form", () => {
    render(<JoinPage />);

    expect(
      screen.getByRole("heading", { name: /sumate al mapa de fans/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("fan-form")).toBeInTheDocument();
  });

  it("renders a way back to the artist page", () => {
    render(<JoinPage />);

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });
});
