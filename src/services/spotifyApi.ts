import { useAuthStore } from '@/stores/auth';
import type { SpotifyPlaylist, SpotifyTrack, SpotifyPaginatedResponse } from '@/types/spotify';

const API_BASE = 'https://api.spotify.com/v1';

// ---------------------------------------------------------------------------
// Raw Spotify API response shapes (partial, only fields we use)
// ---------------------------------------------------------------------------

interface RawImage {
  url: string;
}

interface RawArtist {
  name: string;
}

interface RawAlbum {
  name?: string;
  images?: RawImage[];
}

interface RawTrack {
  id: string | null;
  name?: string;
  preview_url?: string | null;
  artists?: RawArtist[];
  album?: RawAlbum;
}

interface RawPlaylistItem {
  track: RawTrack | null;
}

interface RawPlaylist {
  id: string;
  name?: string;
  description?: string;
  images?: RawImage[];
  tracks?: { total: number };
  owner?: { display_name?: string };
}

// ---------------------------------------------------------------------------
// Authenticated fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(endpoint: string): Promise<T> {
  const auth = useAuthStore();
  const token = await auth.getAccessToken();

  if (!token) {
    throw new Error('Nicht authentifiziert. Bitte erneut einloggen.');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Token expired mid-request – try one refresh cycle
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) throw new Error('Session abgelaufen. Bitte erneut einloggen.');

    const retryToken = await auth.getAccessToken();
    const retry = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${retryToken}` },
    });
    if (!retry.ok) throw new Error(`Spotify API Fehler: ${retry.status}`);
    return retry.json() as Promise<T>;
  }

  if (!response.ok) {
    throw new Error(`Spotify API Fehler: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

/** Fetch all playlists of the current user (handles pagination). */
export async function fetchUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const data = await apiFetch<SpotifyPaginatedResponse<RawPlaylist>>(
      `/me/playlists?limit=${limit}&offset=${offset}`,
    );

    for (const item of data.items) {
      playlists.push(mapPlaylist(item));
    }

    hasMore = data.next !== null;
    offset += limit;
  }

  return playlists;
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/** Fetch all tracks for a given playlist (handles pagination). */
export async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const data = await apiFetch<SpotifyPaginatedResponse<RawPlaylistItem>>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,preview_url,artists(name),album(name,images))),total,limit,offset,next`,
    );

    for (const item of data.items) {
      const track = mapTrack(item, playlistId);
      if (track) tracks.push(track);
    }

    hasMore = data.next !== null;
    offset += limit;
  }

  return tracks;
}

// ---------------------------------------------------------------------------
// Mappers – raw API objects → clean local types
// ---------------------------------------------------------------------------

function mapPlaylist(raw: RawPlaylist): SpotifyPlaylist {
  const images = raw.images ?? [];
  return {
    id: raw.id,
    name: raw.name ?? 'Unbenannte Playlist',
    description: raw.description ?? '',
    imageUrl: images.length > 0 ? images[0].url : null,
    trackCount: raw.tracks?.total ?? 0,
    owner: raw.owner?.display_name ?? '',
  };
}

function mapTrack(raw: RawPlaylistItem, playlistId: string): SpotifyTrack | null {
  const track = raw.track;
  if (!track || !track.id) return null; // skip local-only / unavailable tracks

  const artists = track.artists ?? [];
  const images = track.album?.images ?? [];

  return {
    id: track.id,
    name: track.name ?? 'Unbekannter Titel',
    artist: artists.map((a) => a.name).join(', ') || 'Unbekannter Künstler',
    albumName: track.album?.name ?? '',
    albumCoverUrl: images.length > 0 ? images[0].url : null,
    previewUrl: track.preview_url ?? null,
    playlistId,
  };
}
