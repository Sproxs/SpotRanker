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
  previewUrl: string | null;
  playlistId: string;
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
