// Response contracts for the /api/* scraper endpoints, plus local copies of the
// app's domain types.
//
// The Worker compiles with its own tsconfig and cannot cleanly import from src/,
// so SpotifyPlaylist / SpotifyTrack are mirrored here. KEEP IN SYNC with
// src/types/spotify.ts — the frontend deserializes these shapes verbatim.

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  albumName: string;
  albumCoverUrl: string | null;
  playlistId: string;
}

/** Which scraper provider produced a response. */
export type ProviderSource = 'apiv1' | 'profileview' | 'embed';

export interface ApiPlaylistResponse {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
  source: ProviderSource;
  /** true when the data is incomplete (e.g. embed fallback: no per-track art, ~100-track cap). */
  degraded: boolean;
}

export interface ApiUserPlaylistsResponse {
  playlists: SpotifyPlaylist[];
  source: ProviderSource;
}

export type ApiErrorCode =
  | 'not_found'
  | 'private'
  | 'scrape_failed'
  | 'bad_request'
  | 'method_not_allowed';

export interface ApiError {
  error: ApiErrorCode;
  message?: string;
}
