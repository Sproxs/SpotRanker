/** Simplified Spotify playlist object for local use. */
export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
}

/** Simplified Spotify track object for local use & IndexedDB caching. */
export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  albumName: string;
  albumCoverUrl: string | null;
  playlistId: string;
}

/**
 * Where a playlist's data comes from:
 * - `scraped`  – fetched via the built-in scraper backend (/api/*), no login.
 * - `account`  – fetched via the user's authenticated Spotify account (OAuth).
 */
export type PlaylistSource = 'scraped' | 'account';

/**
 * Why the scraper had to fall back to a degraded provider.
 * KEEP IN SYNC with worker/types.ts.
 */
export type DegradedReason = 'token' | 'rate_limit' | 'forbidden' | 'upstream' | 'network';

/** User-facing explanation per degraded reason. */
export const DEGRADED_REASON_TEXT: Record<DegradedReason, string> = {
  token: 'Spotify-Zugang konnte nicht hergestellt werden',
  rate_limit: 'Spotify hat die Anfragen vorübergehend gedrosselt',
  forbidden: 'Spotify hat den Zugriff auf diese Playlist verweigert',
  upstream: 'Spotify hat unerwartet geantwortet',
  network: 'Spotify war nicht erreichbar',
};

/**
 * A playlist the user has added to their local library (scraper-first flow).
 * Persisted in IndexedDB so the library survives reloads without a login.
 */
export interface LibraryPlaylist extends SpotifyPlaylist {
  source: PlaylistSource;
  /** Epoch ms when the entry was added – used for newest-first ordering. */
  addedAt: number;
  /** true when the data is incomplete (e.g. scraper embed fallback). */
  degraded?: boolean;
  /** Why the data is incomplete – set alongside `degraded`. */
  degradedReason?: DegradedReason;
}

/** Ranking data – maps tier keys to arrays of track IDs. */
export interface RankingData {
  S: string[];
  A: string[];
  B: string[];
  C: string[];
  D: string[];
  unranked: string[];
}

/** Raw Spotify API paginated response. */
export interface SpotifyPaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}
