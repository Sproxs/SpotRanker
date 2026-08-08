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
 * A playlist the user has added to their local library (scraper-first flow).
 * Persisted in IndexedDB so the library survives reloads without a login.
 */
export interface LibraryPlaylist extends SpotifyPlaylist {
  source: PlaylistSource;
  /** Epoch ms when the entry was added – used for newest-first ordering. */
  addedAt: number;
  /** true when the data is incomplete (e.g. scraper embed fallback). */
  degraded?: boolean;
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
