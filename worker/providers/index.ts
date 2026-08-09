// Scraper entry points. There is no longer a provider chain: every resource has
// exactly one tokenless source on open.spotify.com, so a failure is a failure —
// no silent fallback, no "degraded" grey zone to reason about.
//
// Failures are logged and classified. wrangler.jsonc enables observability, so
// these lines are queryable in Cloudflare Logs.

import type { ApiPlaylistResponse, ApiUserPlaylistsResponse, DegradedReason } from '../types';
import { NotFoundError, ProviderError, ScrapeError } from '../errors';
import { fetchPlaylistEmbed } from './embed';
import { fetchUserPlaylistsPage } from './userPage';

export { NotFoundError, ProviderError, ScrapeError };

/** Map a scrape failure onto the coarse reason used in logs and messages. */
export function classifyFailure(e: unknown): DegradedReason {
  // ProviderError covers non-ok responses and unparseable pages; SyntaxError
  // covers JSON.parse choking on an interstitial.
  if (e instanceof ProviderError || e instanceof SyntaxError) return 'upstream';
  // raw fetch rejection: DNS, TLS, connection reset, subrequest limit
  return 'network';
}

function logFailure(resource: 'playlist' | 'user', id: string, e: unknown): DegradedReason {
  const reason = classifyFailure(e);
  console.error(
    JSON.stringify({
      evt: 'scrape_failed',
      resource,
      id,
      reason,
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    }),
  );
  return reason;
}

/** Playlist metadata + track list from the public embed page. */
export async function getPlaylist(id: string): Promise<ApiPlaylistResponse> {
  try {
    const { playlist, tracks, coversMissing } = await fetchPlaylistEmbed(id);
    return { playlist, tracks, source: 'embed', coversMissing };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    logFailure('playlist', id, e);
    throw new ScrapeError(e instanceof Error ? e.message : String(e));
  }
}

/** A profile's public playlists from the public user page. */
export async function getUserPlaylists(userId: string): Promise<ApiUserPlaylistsResponse> {
  try {
    const playlists = await fetchUserPlaylistsPage(userId);
    return { playlists, source: 'userpage' };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    logFailure('user', userId, e);
    throw new ScrapeError(e instanceof Error ? e.message : String(e));
  }
}
