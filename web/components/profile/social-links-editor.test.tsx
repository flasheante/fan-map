import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SocialLinksEditor, type SocialLinksValue } from "./social-links-editor";

function makeValue(overrides: Partial<SocialLinksValue> = {}): SocialLinksValue {
  return {
    instagramUrl: null,
    instagramIsPublic: false,
    tiktokUrl: null,
    tiktokIsPublic: false,
    xUrl: null,
    xIsPublic: false,
    youtubeUrl: null,
    youtubeIsPublic: false,
    facebookUrl: null,
    facebookIsPublic: false,
    ...overrides,
  };
}

describe("SocialLinksEditor", () => {
  it("renders the 5 required networks with a URL field and a public toggle each", () => {
    render(<SocialLinksEditor value={makeValue()} onChange={vi.fn()} />);

    for (const label of ["Instagram", "TikTok", "X", "YouTube", "Facebook"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(
      screen.getAllByRole("checkbox", { name: /mostrar públicamente/i }),
    ).toHaveLength(5);
  });

  it("updates a network's URL independently of the others", () => {
    const onChange = vi.fn();
    render(<SocialLinksEditor value={makeValue()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Instagram"), {
      target: { value: "https://instagram.com/fan" },
    });

    expect(onChange).toHaveBeenCalledWith(
      makeValue({ instagramUrl: "https://instagram.com/fan" }),
    );
  });

  // Requisito central: cargar una URL nunca la hace pública sola.
  it("does not mark a network public just because its URL was set", () => {
    const onChange = vi.fn();
    render(<SocialLinksEditor value={makeValue()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("TikTok"), {
      target: { value: "https://tiktok.com/@fan" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tiktokUrl: "https://tiktok.com/@fan", tiktokIsPublic: false }),
    );
  });

  it("toggles a network's public flag independently of its URL", () => {
    const onChange = vi.fn();
    render(
      <SocialLinksEditor
        value={makeValue({ xUrl: "https://x.com/fan" })}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mostrar públicamente/i })[2]);

    expect(onChange).toHaveBeenCalledWith(
      makeValue({ xUrl: "https://x.com/fan", xIsPublic: true }),
    );
  });

  it("clears a URL when emptied", () => {
    const onChange = vi.fn();
    render(
      <SocialLinksEditor
        value={makeValue({ youtubeUrl: "https://youtube.com/@fan", youtubeIsPublic: true })}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("YouTube"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ youtubeUrl: null }),
    );
  });

  it("does not affect other networks when changing one", () => {
    const onChange = vi.fn();
    render(
      <SocialLinksEditor
        value={makeValue({ instagramUrl: "https://instagram.com/fan", instagramIsPublic: true })}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Facebook"), {
      target: { value: "https://facebook.com/fan" },
    });

    expect(onChange).toHaveBeenCalledWith(
      makeValue({
        instagramUrl: "https://instagram.com/fan",
        instagramIsPublic: true,
        facebookUrl: "https://facebook.com/fan",
      }),
    );
  });
});
