// Provider chain. Each public resource is attempted through providers in order
// of richness, falling through on failure. A NotFoundError (private/deleted)
// short-circuits — there is no point trying other providers for it.

import type { ApiPlaylistResponse, ApiUserPlaylistsResponse } from '../types';
import { fetchPlaylistV1, fetchUserPlaylistsV1, NotFoundError, ProviderError } from './apiV1';
import { fetchPlaylistEmbed } from './embed';
import { fetchUserPlaylistsProfileView } from './profileView';

export { NotFoundError, ProviderError };
export class ScrapeError extends Error {}

/** Playlist metadata + full track list: v1 (rich) → embed (degraded). */
export async function getPlaylist(id: string): Promise<ApiPlaylistResponse> {
  try {
    const { playlist, tracks } = await fetchPlaylistV1(id);
    return { playlist, tracks, source: 'apiv1', degraded: false };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    // fall through to the tokenless embed fallback
  }

  try {
    const { playlist, tracks, degraded } = await fetchPlaylistEmbed(id);
    return { playlist, tracks, source: 'embed', degraded };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    throw new ScrapeError(e instanceof Error ? e.message : String(e));
  }
}

/** A profile's public playlists: v1 (with counts) → profile-view (no counts). */
export async function getUserPlaylists(userId: string): Promise<ApiUserPlaylistsResponse> {
  try {
    const playlists = await fetchUserPlaylistsV1(userId);
    return { playlists, source: 'apiv1' };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    // fall through to the profile-view fallback
  }

  try {
    const playlists = await fetchUserPlaylistsProfileView(userId);
    return { playlists, source: 'profileview' };
  } catch (e) {
    if (e instanceof NotFoundError) throw e;
    throw new ScrapeError(e instanceof Error ? e.message : String(e));
  }
}
