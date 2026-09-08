import { describe, expect, it, vi } from "vitest";
import type { PublicFanProfile } from "./api";

const { getFanProfile } = vi.hoisted(() => ({ getFanProfile: vi.fn() }));
vi.mock("./api", () => ({ getFanProfile }));

const { getFanProfileView } = await import("./fan-profile-view");

function makeProfile(overrides: Partial<PublicFanProfile> = {}): PublicFanProfile {
  return {
    id: "profile-1",
    displayName: "Fan One",
    showOnMap: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-1",
      name: "Monterrey",
      latitude: 25.6866,
      longitude: -100.3161,
      country: { id: "country-1", name: "Mexico", code: "MX" },
    },
    artists: [],
    photoUrl: null,
    setlistSongs: [],
    favoriteSongs: [],
    social: {},
    ...overrides,
  };
}

function httpError(status: number): Error {
  return Object.assign(new Error(`status ${status}`), { status });
}

describe("getFanProfileView", () => {
  it("returns ok with the profile on success", async () => {
    const profile = makeProfile();
    getFanProfile.mockResolvedValue(profile);

    const result = await getFanProfileView("profile-1");

    expect(result).toEqual({ status: "ok", profile });
  });

  it("returns not-found when the API responds 404", async () => {
    getFanProfile.mockRejectedValue(httpError(404));

    const result = await getFanProfileView("missing-id");

    expect(result).toEqual({ status: "not-found" });
  });

  it("returns error for any other failure", async () => {
    getFanProfile.mockRejectedValue(httpError(500));

    const result = await getFanProfileView("profile-1");

    expect(result).toEqual({ status: "error" });
  });
});
