import { describe, it, expect, beforeEach, vi } from "vitest";
import { isInstalledWebApp } from "../../lib/installedWebApp";

const stubMatchMedia = (matchingQuery: string | null) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query === matchingQuery }))
  );
};

describe("isInstalledWebApp", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { standalone: undefined });
  });

  it("returns false when no standalone display mode matches", () => {
    stubMatchMedia(null);
    expect(isInstalledWebApp()).toBe(false);
  });

  it("returns true for display-mode: standalone", () => {
    stubMatchMedia("(display-mode: standalone)");
    expect(isInstalledWebApp()).toBe(true);
  });

  it("returns true for display-mode: minimal-ui", () => {
    stubMatchMedia("(display-mode: minimal-ui)");
    expect(isInstalledWebApp()).toBe(true);
  });

  it("returns true for display-mode: window-controls-overlay", () => {
    stubMatchMedia("(display-mode: window-controls-overlay)");
    expect(isInstalledWebApp()).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS)", () => {
    stubMatchMedia(null);
    vi.stubGlobal("navigator", { standalone: true });
    expect(isInstalledWebApp()).toBe(true);
  });

  it("returns false when matchMedia is not a function on window", () => {
    // Older browsers / non-DOM environments — guard must short-circuit.
    vi.stubGlobal("matchMedia", undefined);
    expect(isInstalledWebApp()).toBe(false);
  });

  it("returns false when navigator.standalone is explicitly false", () => {
    stubMatchMedia(null);
    vi.stubGlobal("navigator", { standalone: false });
    expect(isInstalledWebApp()).toBe(false);
  });
});
