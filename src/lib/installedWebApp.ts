/**
 * True when the app is running as an installed Progressive Web App (or
 * equivalent standalone window). Chromium maps “installed” to CSS
 * `display-mode`: `standalone`, `minimal-ui`, or `window-controls-overlay`.
 *
 * Browser-local WebLLM (~700MB weights) is gated on this so it only loads in
 * that context, not in a normal browser tab.
 */
export function isInstalledWebApp(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  const standaloneModes = [
    "(display-mode: standalone)",
    "(display-mode: minimal-ui)",
    "(display-mode: window-controls-overlay)",
  ];
  if (standaloneModes.some((q) => window.matchMedia(q).matches)) {
    return true;
  }

  // iOS Safari add-to-home-screen (not Chromium, but same “installed” intent).
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}
