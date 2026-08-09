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

/** Longest we are willing to stall a request waiting out a 429. */
const MAX_RETRY_WAIT_MS = 2_000;

export class ProviderError extends Error {
  /** HTTP status when the failure came from a response (absent for throws). */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}
export class NotFoundError extends ProviderError {}

/**
 * Spotify explains most failures in the response body ("Insufficient client
 * scope", market restrictions, bot-mitigation notices). The status code alone
 * routinely fails to distinguish a rotated secret from an IP block, so pull a
 * bounded excerpt into the error message.
 */
async function describeBody(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim().slice(0, 300);
    return text ? ` – ${text}` : '';
  } catch {
    return '';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RetryState {
  on401: boolean;
  on429: boolean;
}

async function apiGet<T>(
  path: string,
  retry: RetryState = { on401: true, on429: true },
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (res.status === 401 && retry.on401) {
    invalidateToken();
    return apiGet<T>(path, { ...retry, on401: false });
  }

  // Honour Retry-After for a single short wait. A long cooldown is not worth
  // stalling the request for — fall through and let the fallback provider answer.
  if (res.status === 429 && retry.on429) {
    const seconds = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 500;
    if (waitMs <= MAX_RETRY_WAIT_MS) {
      await sleep(waitMs);
      return apiGet<T>(path, { ...retry, on429: false });
    }
  }

  if (res.status === 404) throw new NotFoundError(`v1 404: ${path}`, 404);
  if (!res.ok) {
    throw new ProviderError(`Spotify v1 ${res.status} für ${path}${await describeBody(res)}`, res.status);
  }
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
