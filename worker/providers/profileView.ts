// Provider A (secondary) — a profile's public playlists via the web-player's
// user-profile-view service. This is a plain REST endpoint (no rotating GraphQL
// hash), so it is a stable fallback when the v1 users endpoint is unavailable.
// It carries no track counts, so trackCount is reported as 0 here.

import { getToken, invalidateToken, USER_AGENT } from '../token';
import type { SpotifyPlaylist } from '../types';
import { NotFoundError, ProviderError } from './apiV1';

const PROFILE_BASE = 'https://spclient.wg.spotify.com/user-profile-view/v3/profile';

interface RawProfilePlaylist {
  uri?: string;
  name?: string;
  owner_name?: string;
  image_url?: string;
}

interface ProfilePlaylistsResponse {
  playlists?: RawProfilePlaylist[];
}

function idFromUri(uri: string): string {
  return uri.split(':').pop() ?? uri;
}

export async function fetchUserPlaylistsProfileView(userId: string): Promise<SpotifyPlaylist[]> {
  const doFetch = (bearer: string) =>
    fetch(`${PROFILE_BASE}/${encodeURIComponent(userId)}/playlists?offset=0&limit=200`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

  let res = await doFetch(await getToken());
  if (res.status === 401) {
    invalidateToken();
    res = await doFetch(await getToken());
  }
  if (res.status === 404) throw new NotFoundError(`Profil 404: ${userId}`);
  if (!res.ok) throw new ProviderError(`Profile-View ${res.status} für ${userId}`);

  const data = (await res.json()) as ProfilePlaylistsResponse;
  return (data.playlists ?? [])
    .filter((p) => p.uri)
    .map((p) => ({
      id: idFromUri(p.uri as string),
      name: p.name ?? 'Unbenannte Playlist',
      description: '',
      imageUrl: p.image_url && p.image_url.startsWith('http') ? p.image_url : null,
      trackCount: 0,
      owner: p.owner_name ?? '',
    }));
}
