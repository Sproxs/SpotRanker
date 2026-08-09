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

/**
 * Why the primary (v1) provider was abandoned in favour of a fallback.
 *
 * Coarse on purpose: the exact error text goes to the logs, this is what the
 * UI and support can act on. Without it, every failure class looks identical
 * from the outside (HTTP 200 + degraded: true).
 */
export type DegradedReason =
  | 'token' // anonymous token could not be minted or was rejected
  | 'rate_limit' // Spotify returned 429
  | 'forbidden' // 401/403 — token not entitled to the resource
  | 'upstream' // 5xx or an unparseable response from Spotify
  | 'network'; // fetch itself failed (DNS/TLS/subrequest limit)

export interface ApiPlaylistResponse {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
  source: ProviderSource;
  /** true when the data is incomplete (e.g. embed fallback: no per-track art, ~100-track cap). */
  degraded: boolean;
  /** Present when degraded: which failure pushed us onto the fallback. */
  degradedReason?: DegradedReason;
}

export interface ApiUserPlaylistsResponse {
  playlists: SpotifyPlaylist[];
  source: ProviderSource;
  /** Present when the v1 provider failed and profile-view answered instead. */
  degradedReason?: DegradedReason;
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
