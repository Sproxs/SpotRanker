// Build identity for the ⚙ overlay. The values come from the `define` block in
// vite.config.ts, which vitest.config.ts does NOT replicate – hence the typeof
// guards, so importing this module from a test yields 'dev' instead of throwing
// a ReferenceError.
export const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__;
export const BUILD_TIME = typeof __BUILD_TIME__ === 'undefined' ? '' : __BUILD_TIME__;

/**
 * Human-readable build stamp, e.g. `a1b2c3d · 11.08.2026, 22:14`.
 * Falls back to the bare version when the build time is missing or unparsable.
 */
export function formatBuildInfo(version: string = APP_VERSION, iso: string = BUILD_TIME): string {
  if (!iso) return version;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return version;

  const stamp = date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${version} · ${stamp}`;
}
