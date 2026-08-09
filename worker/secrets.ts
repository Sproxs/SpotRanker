// TOTP secret provider for the anonymous web-player token flow.
//
// Spotify rotates the web-player TOTP secret periodically. This module used to
// refresh the secret from a community-maintained list at runtime, but that
// source (Thereallo1026/spotify-secrets) no longer exists — all of its known
// paths return 404 — so every request burned three subrequests to learn nothing.
// The secret is now bundled outright, which is also what comparable projects
// settled on. See REMOTE_URLS below for how to re-enable a remote refresh.

export interface SpotifySecret {
  version: number;
  cipher: number[];
}

// Current web-player secret (version 61, first observed January 2026 and still
// the version the web player selects). If Spotify rotates the secret and token
// minting starts failing — watch for `token_mint_rejected` in the logs — refresh
// this array + version by extracting them from the open.spotify.com web-player
// bundle, or point REMOTE_URLS at a maintained list.
const FALLBACK_SECRETS: SpotifySecret[] = [
  {
    version: 61,
    cipher: [
      44, 55, 47, 42, 70, 40, 34, 114, 76, 74, 50, 111, 120, 97, 75, 76, 94, 102,
      43, 69, 49, 120, 118, 80, 64, 78,
    ],
  },
];

// Optional remote refresh sources, tried in order; the first that parses wins
// and is merged over FALLBACK_SECRETS. Expected shape: { "<version>": [int, …], … }.
// Deliberately empty: the previous source is gone (404 on every path), and an
// unreachable list costs a subrequest per entry on every cold isolate while
// silently changing nothing. Add a maintained URL here to re-enable refreshing.
const REMOTE_URLS: string[] = [];

let cached: SpotifySecret[] | null = null;

/** Exported for tests: validates the remote dict shape. */
export function parseSecretDict(json: unknown): SpotifySecret[] {
  if (!json || typeof json !== 'object') return [];
  const out: SpotifySecret[] = [];
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    const version = Number(key);
    if (!Number.isFinite(version)) continue;
    if (Array.isArray(value) && value.every((n) => typeof n === 'number')) {
      out.push({ version, cipher: value as number[] });
    }
  }
  return out;
}

/**
 * Known secrets, newest version first. When REMOTE_URLS is non-empty, attempts
 * one remote refresh per isolate and merges it over the bundled fallback
 * (remote entries win on version clash).
 */
export async function getSecrets(): Promise<SpotifySecret[]> {
  if (cached) return cached;

  const merged = new Map<number, SpotifySecret>();
  for (const secret of FALLBACK_SECRETS) merged.set(secret.version, secret);

  for (const url of REMOTE_URLS) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const parsed = parseSecretDict(await res.json());
      if (parsed.length > 0) {
        for (const secret of parsed) merged.set(secret.version, secret);
        break;
      }
    } catch (e) {
      // Try the next URL / fall back to the bundled secret — but say so, since
      // a silently unreachable list looks exactly like a working one.
      console.warn(
        JSON.stringify({
          evt: 'secret_refresh_failed',
          url,
          reason: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  cached = [...merged.values()].sort((a, b) => b.version - a.version);
  return cached;
}
