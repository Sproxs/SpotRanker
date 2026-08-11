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
 * A playlist the user has added to their local library.
 * Persisted in IndexedDB so the library survives reloads — there is no login.
 */
export interface LibraryPlaylist extends SpotifyPlaylist {
  /** Epoch ms when the entry was added – used for newest-first ordering. */
  addedAt: number;
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
