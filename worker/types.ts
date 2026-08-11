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

/** Which scraper page produced a response. Only open.spotify.com is used. */
export type ProviderSource = 'embed' | 'userpage';

/**
 * Coarse failure class for logging and for the message the UI shows.
 * The exact error text goes to the logs; this is what support can act on.
 */
export type DegradedReason =
  | 'upstream' // Spotify answered with an error or something unparseable
  | 'network'; // fetch itself failed (DNS/TLS/subrequest limit)

export interface ApiPlaylistResponse {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
  source: ProviderSource;
  /**
   * true when the embed payload carried no per-track artwork, so the client
   * should backfill it via /api/track-covers.
   */
  coversMissing: boolean;
}

export interface ApiUserPlaylistsResponse {
  playlists: SpotifyPlaylist[];
  source: ProviderSource;
}

/** Response of /api/track-covers: track id → cover URL (null = none found). */
export interface ApiTrackCoversResponse {
  covers: Record<string, string | null>;
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
