import { describe, expect, it } from "vitest";
import { formatSyncedAt } from "./format-synced-at";

// Sin fijar un TZ acá: a diferencia de formatShowDate (siempre UTC),
// formatSyncedAt corre en el huso del que mira la pantalla a propósito —
// así que estos tests verifican forma/comportamiento, no un string exacto
// que cambiaría según en qué huso corra la máquina que ejecuta el test.
describe("formatSyncedAt", () => {
  it("includes the year of the given instant", () => {
    expect(formatSyncedAt("2026-09-07T02:00:00.000Z")).toContain("2026");
  });

  it("includes a time in hh:mm form", () => {
    expect(formatSyncedAt("2026-09-07T02:00:00.000Z")).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats different instants differently", () => {
    const early = formatSyncedAt("2026-01-01T00:00:00.000Z");
    const later = formatSyncedAt("2026-06-15T12:30:00.000Z");

    expect(early).not.toBe(later);
  });
});
