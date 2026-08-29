import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/join/join-flow", () => ({
  JoinFlow: () => <div data-testid="join-flow" />,
}));

const { default: JoinPage } = await import("./page");

describe("JoinPage", () => {
  it("renders a heading and the join flow", () => {
    render(<JoinPage />);

    expect(
      screen.getByRole("heading", { name: /sumate al mapa de fans/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("join-flow")).toBeInTheDocument();
  });

  it("renders a way back to the artist page", () => {
    render(<JoinPage />);

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });
});
