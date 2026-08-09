import type { DegradedReason, SpotifyPlaylist, SpotifyTrack } from '@/types/spotify';

// Client for the built-in scraper backend (Cloudflare Worker under /api/*).
// Same origin, so a plain relative fetch works in dev (via Vite proxy) and prod.

const API_BASE = '/api';

interface ApiError {
  error: 'not_found' | 'private' | 'scrape_failed' | 'bad_request' | 'method_not_allowed';
  message?: string;
}

interface ApiPlaylistResponse {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
  source: 'apiv1' | 'profileview' | 'embed';
  degraded: boolean;
  degradedReason?: DegradedReason;
}

interface ApiUserPlaylistsResponse {
  playlists: SpotifyPlaylist[];
  source: 'apiv1' | 'profileview' | 'embed';
  degradedReason?: DegradedReason;
}

const ERROR_MESSAGES: Record<ApiError['error'], string> = {
  not_found: 'Playlist nicht gefunden. Ist sie öffentlich?',
  private: 'Diese Playlist ist privat und kann ohne Login nicht geladen werden.',
  scrape_failed: 'Playlist konnte nicht geladen werden. Bitte später erneut versuchen.',
  bad_request: 'Ungültige Eingabe.',
  method_not_allowed: 'Ungültige Anfrage.',
};

async function apiFetch<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Keine Verbindung zum Scraper-Dienst.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    const code = body?.error;
    if (code && code in ERROR_MESSAGES) {
      throw new Error(ERROR_MESSAGES[code]);
    }
    throw new Error(`Scraper-Fehler: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/** Fetch a public playlist (metadata + all tracks) via the scraper. */
export async function fetchScrapedPlaylist(playlistId: string): Promise<{
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
  degraded: boolean;
  degradedReason?: DegradedReason;
}> {
  const data = await apiFetch<ApiPlaylistResponse>(`/playlist/${encodeURIComponent(playlistId)}`);
  return {
    playlist: data.playlist,
    tracks: data.tracks,
    degraded: data.degraded,
    degradedReason: data.degradedReason,
  };
}

/** Fetch the public playlists of a Spotify profile via the scraper. */
export async function fetchScrapedUserPlaylists(userId: string): Promise<SpotifyPlaylist[]> {
  const data = await apiFetch<ApiUserPlaylistsResponse>(
    `/user/${encodeURIComponent(userId)}/playlists`,
  );
  return data.playlists;
}
