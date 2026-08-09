// Provider chain. Each public resource is attempted through providers in order
// of richness, falling through on failure. A NotFoundError (private/deleted)
// short-circuits — there is no point trying other providers for it.
//
// Every fall-through is logged and classified. Without that, all eight failure
// classes (token mint, 401, 403, 429, 5xx, network, subrequest limit, unparseable
// body) produce byte-identical output — HTTP 200 with degraded: true — and the
// reason is unknowable after the fact. wrangler.jsonc enables observability, so
// these console.error lines are queryable in Cloudflare Logs.

import type { ApiPlaylistResponse, ApiUserPlaylistsResponse, DegradedReason } from '../types';
import { fetchPlaylistV1, fetchUserPlaylistsV1, NotFoundError, ProviderError } from './apiV1';
import { fetchPlaylistEmbed } from './embed';
import { fetchUserPlaylistsProfileView } from './profileView';
import { enrichCovers } from './enrich';
import { TokenError } from '../token';

export { NotFoundError, ProviderError };
export class ScrapeError extends Error {}

/** Map a provider failure onto the coarse reason exposed to the UI. */
export function classifyFailure(e: unknown): DegradedReason {
  if (e instanceof TokenError) return 'token';
  if (e instanceof ProviderError) {
    if (e.status === 429) return 'rate_limit';
    if (e.status === 401 || e.status === 403) return 'forbidden';
    return 'upstream';
  }
  // res.json() choking on a bot-mitigation HTML page
  if (e instanceof SyntaxError) return 'upstream';
  // raw fetch rejection: DNS, TLS, connection reset, subrequest limit
  return 'network';
}

function logFallback(
  resource: 'playlist' | 'user',
  id: string,
  to: string,
  e: unknown,
  reason: DegradedReason,
): void {
  console.error(
    JSON.stringify({
      evt: 'provider_fallback',
      resource,
      id,
      from: 'apiv1',
      to,
      reason,
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    }),
  );
}

/** Playlist metadata + full track list: v1 (rich) → embed (degraded). */
export async function getPlaylist(id: string): Promise<ApiPlaylistResponse> {
  let degradedReason: DegradedReason | undefined;

  try {
    const { playlist, tracks } = await fetchPlaylistV1(id);
    return { playlist, tracks, source: 'apiv1', degraded: false };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    degradedReason = classifyFailure(e);
    logFallback('playlist', id, 'embed', e, degradedReason);
  }

  try {
    const { playlist, tracks, degraded } = await fetchPlaylistEmbed(id);
    // The embed carries no per-track artwork. Try to backfill it — cheap (two
    // subrequests for a typical list) and entirely optional: it uses the same
    // token that just failed, so it is expected to be a no-op whenever the
    // fallback was caused by a token problem. `degraded` stays true either way,
    // because the track list itself is still truncated.
    await tryEnrichCovers(tracks, id);
    return { playlist, tracks, source: 'embed', degraded, degradedReason };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    throw new ScrapeError(e instanceof Error ? e.message : String(e));
  }
}

async function tryEnrichCovers(tracks: ApiPlaylistResponse['tracks'], id: string): Promise<void> {
  try {
    const filled = await enrichCovers(tracks);
    if (filled > 0) {
      console.log(JSON.stringify({ evt: 'covers_enriched', id, filled, of: tracks.length }));
    }
  } catch (e) {
    console.warn(
      JSON.stringify({
        evt: 'cover_enrichment_failed',
        id,
        reason: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}

/** A profile's public playlists: v1 (with counts) → profile-view (no counts). */
export async function getUserPlaylists(userId: string): Promise<ApiUserPlaylistsResponse> {
  let degradedReason: DegradedReason | undefined;

  try {
    const playlists = await fetchUserPlaylistsV1(userId);
    return { playlists, source: 'apiv1' };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    degradedReason = classifyFailure(e);
    logFallback('user', userId, 'profileview', e, degradedReason);
  }

  try {
    const playlists = await fetchUserPlaylistsProfileView(userId);
    return { playlists, source: 'profileview', degradedReason };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    throw new ScrapeError(e instanceof Error ? e.message : String(e));
  }
}
