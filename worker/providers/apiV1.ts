// Provider B — api.spotify.com/v1 with the anonymous web-player token.
//
// This is the primary provider: richest data (per-track album art, exact counts)
// and it covers both playlist contents and a profile's public playlists. The
// anonymous token is accepted for public resources.

import { getToken, invalidateToken, USER_AGENT } from '../token';
import { mapV1Playlist, mapV1Track } from '../mappers';
import type { RawV1Playlist, RawV1PlaylistItem } from '../mappers';
import type { SpotifyPlaylist, SpotifyTrack } from '../types';

const API_BASE = 'https://api.spotify.com/v1';

export class ProviderError extends Error {}
export class NotFoundError extends ProviderError {}

async function apiGet<T>(path: string, retryOn401 = true): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (res.status === 401 && retryOn401) {
    invalidateToken();
    return apiGet<T>(path, false);
  }
  if (res.status === 404) throw new NotFoundError(`v1 404: ${path}`);
  if (!res.ok) throw new ProviderError(`Spotify v1 ${res.status} für ${path}`);
  return (await res.json()) as T;
}

interface PlaylistTracksPage {
  items: RawV1PlaylistItem[];
  next: string | null;
}

export async function fetchPlaylistV1(
  id: string,
): Promise<{ playlist: SpotifyPlaylist; tracks: SpotifyTrack[] }> {
  const raw = await apiGet<RawV1Playlist>(
    `/playlists/${id}?fields=id,name,description,images,owner(display_name),tracks(total)`,
  );
  const playlist = mapV1Playlist(raw);

  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const page = await apiGet<PlaylistTracksPage>(
      `/playlists/${id}/tracks?limit=${limit}&offset=${offset}` +
        `&fields=items(track(id,name,artists(name),album(name,images))),next`,
    );
    for (const item of page.items) {
      const track = mapV1Track(item, id);
      if (track) tracks.push(track);
    }
    hasMore = page.next !== null;
    offset += limit;
  }

  return { playlist, tracks };
}

interface UserPlaylistsPage {
  items: RawV1Playlist[];
  next: string | null;
}

export async function fetchUserPlaylistsV1(userId: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const page = await apiGet<UserPlaylistsPage>(
      `/users/${encodeURIComponent(userId)}/playlists?limit=${limit}&offset=${offset}`,
    );
    for (const item of page.items) {
      if (item && item.id) playlists.push(mapV1Playlist(item));
    }
    hasMore = page.next !== null;
    offset += limit;
  }

  return playlists;
}
