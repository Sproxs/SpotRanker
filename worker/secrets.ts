// TOTP secret provider for the anonymous web-player token flow.
//
// Spotify rotates the web-player TOTP secret periodically. The community keeps a
// running list; we try to refresh from it at runtime but always ship a bundled
// fallback so token minting keeps working when the remote list is unreachable or
// its path/shape changed.

export interface SpotifySecret {
  version: number;
  cipher: number[];
}

// Current web-player secret (version 61, first observed January 2026). This is
// used as-is when every REMOTE_URL below fails. If Spotify rotates the secret
// and token minting starts failing, refresh this array + version (extract from
// the open.spotify.com web-player bundle) or fix REMOTE_URLS.
const FALLBACK_SECRETS: SpotifySecret[] = [
  {
    version: 61,
    cipher: [
      44, 55, 47, 42, 70, 40, 34, 114, 76, 74, 50, 111, 120, 97, 75, 76, 94, 102,
      43, 69, 49, 120, 118, 80, 64, 78,
    ],
  },
];

// Community-maintained rotating secret list. The exact path has moved across
// releases, so we try several known locations; the first that parses wins,
// otherwise FALLBACK_SECRETS is used. Expected shape: { "<version>": [int, …], … }.
const REMOTE_URLS = [
  'https://raw.githubusercontent.com/Thereallo1026/spotify-secrets/main/secrets/secretDict.json',
  'https://raw.githubusercontent.com/Thereallo1026/spotify-secrets/main/secretDict.json',
  'https://raw.githubusercontent.com/Thereallo1026/spotify-secrets/main/secrets/secrets.json',
];

let cached: SpotifySecret[] | null = null;

function parseSecretDict(json: unknown): SpotifySecret[] {
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
 * Known secrets, newest version first. Attempts one remote refresh per isolate
 * and merges it over the bundled fallback (remote entries win on version clash).
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
    } catch {
      // Ignore and try the next URL / fall back to the bundled secret.
    }
  }

  cached = [...merged.values()].sort((a, b) => b.version - a.version);
  return cached;
}
