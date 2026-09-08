import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AuthStatus } from "@/components/auth/auth-provider";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth }));

const { JoinOrProfileLink } = await import("./join-or-profile-link");

function mockAuth(status: AuthStatus) {
  useAuth.mockReturnValue({ status, user: null, logout: vi.fn() });
}

describe("JoinOrProfileLink", () => {
  it("shows 'Join the FanMap' linking to /join when unauthenticated", () => {
    mockAuth("unauthenticated");

    render(<JoinOrProfileLink />);

    const link = screen.getByRole("link", { name: /join the fanmap/i });
    expect(link).toHaveAttribute("href", "/join");
  });

  it("shows 'Join the FanMap' while the auth status is still loading, to avoid a flash to a different label", () => {
    mockAuth("loading");

    render(<JoinOrProfileLink />);

    expect(screen.getByRole("link", { name: /join the fanmap/i })).toBeInTheDocument();
  });

  it("shows 'Join the FanMap' when the session check failed", () => {
    mockAuth("error");

    render(<JoinOrProfileLink />);

    expect(screen.getByRole("link", { name: /join the fanmap/i })).toBeInTheDocument();
  });

  it("shows 'Profile' linking to /profile when authenticated", () => {
    mockAuth("authenticated");

    render(<JoinOrProfileLink />);

    const link = screen.getByRole("link", { name: /^profile$/i });
    expect(link).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: /join the fanmap/i })).not.toBeInTheDocument();
  });
});
