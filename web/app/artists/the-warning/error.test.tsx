import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TheWarningError from "./error";

describe("TheWarningError", () => {
  it("shows an error message and retries via reset", () => {
    const reset = vi.fn();
    render(<TheWarningError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText(/no pudimos cargar la página/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
