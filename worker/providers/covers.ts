// Per-track album art without the Spotify Web API.
//
// The embed playlist payload usually carries no per-track artwork, so covers
// are resolved through Spotify's public oEmbed endpoint, which needs no token.
// Two constraints shape this:
//
//   * oEmbed sends no CORS headers, so the browser cannot call it — it has to
//     happen here, in the Worker.
//   * It answers one resource per request, and Workers cap subrequests (50 on
//     the free plan). Hence the hard MAX_IDS ceiling per invocation; the client
//     asks in small batches instead of one call per playlist.
//
// Covers are effectively immutable, so responses are cached at the edge for a
// long time (see worker/index.ts).

import { USER_AGENT } from '../errors';

const OEMBED_BASE = 'https://open.spotify.com/oembed';

/** Never resolve more than this per request — keeps us clear of subrequest caps. */
export const MAX_IDS = 20;

interface OEmbedResponse {
  thumbnail_url?: string;
}

async function coverFor(id: string): Promise<string | null> {
  try {
    const url = `${OEMBED_BASE}?url=${encodeURIComponent(`spotify:track:${id}`)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OEmbedResponse;
    return data.thumbnail_url ?? null;
  } catch {
    // A single unresolvable cover must never fail the whole batch.
    return null;
  }
}

/**
 * Resolve cover URLs for up to MAX_IDS track ids.
 * Missing/failed lookups map to null so the client can stop asking for them.
 */
export async function fetchTrackCovers(ids: string[]): Promise<Record<string, string | null>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, MAX_IDS);
  const results = await Promise.all(unique.map(async (id) => [id, await coverFor(id)] as const));
  return Object.fromEntries(results);
}
