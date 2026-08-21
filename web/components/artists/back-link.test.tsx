import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackToTheWarningLink } from "./back-link";

describe("BackToTheWarningLink", () => {
  it("links back to /artists/the-warning", () => {
    render(<BackToTheWarningLink />);

    const link = screen.getByRole("link", { name: /volver a the warning/i });
    expect(link).toHaveAttribute("href", "/artists/the-warning");
  });
});
