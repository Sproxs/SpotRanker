import localforage from 'localforage';
import type { SpotifyPlaylist, SpotifyTrack, RankingData } from '@/types/spotify';

// ---------------------------------------------------------------------------
// Separate stores for playlists, tracks & rankings
// ---------------------------------------------------------------------------

const playlistStore = localforage.createInstance({
  name: 'spotranker',
  storeName: 'playlists',
  description: 'Cached user playlists',
});

const trackStore = localforage.createInstance({
  name: 'spotranker',
  storeName: 'tracks',
  description: 'Cached playlist tracks',
});

const rankingStore = localforage.createInstance({
  name: 'spotranker',
  storeName: 'rankings',
  description: 'Persisted tier-list rankings per playlist',
});

// ---------------------------------------------------------------------------
// Playlist helpers
// ---------------------------------------------------------------------------

/** Persist the full array of playlists. */
export async function savePlaylists(playlists: SpotifyPlaylist[]): Promise<void> {
  await playlistStore.setItem('userPlaylists', playlists);
}

/** Load playlists from IndexedDB (returns empty array if none cached). */
export async function loadPlaylists(): Promise<SpotifyPlaylist[]> {
  return (await playlistStore.getItem<SpotifyPlaylist[]>('userPlaylists')) ?? [];
}

// ---------------------------------------------------------------------------
// Track helpers (keyed by playlistId)
// ---------------------------------------------------------------------------

/** Persist tracks for one playlist. */
export async function savePlaylistTracks(playlistId: string, tracks: SpotifyTrack[]): Promise<void> {
  await trackStore.setItem(`tracks_${playlistId}`, tracks);
}

/** Load cached tracks for a playlist (returns null if not cached). */
export async function loadPlaylistTracks(playlistId: string): Promise<SpotifyTrack[] | null> {
  return await trackStore.getItem<SpotifyTrack[]>(`tracks_${playlistId}`);
}

/** Check whether tracks for a playlist are already cached. */
export async function hasPlaylistTracks(playlistId: string): Promise<boolean> {
  const data = await trackStore.getItem(`tracks_${playlistId}`);
  return data !== null;
}

/** Return set of playlist IDs that have cached tracks. */
export async function getCachedPlaylistIds(): Promise<Set<string>> {
  const keys = await trackStore.keys();
  const prefix = 'tracks_';
  const ids = keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  return new Set(ids);
}

// ---------------------------------------------------------------------------
// Ranking helpers (keyed by playlistId)
// ---------------------------------------------------------------------------

/** Persist ranking (tier → track-ID mapping) for one playlist. */
export async function saveRanking(playlistId: string, ranking: RankingData): Promise<void> {
  await rankingStore.setItem(`ranking_${playlistId}`, ranking);
}

/** Load a saved ranking for a playlist (returns null if none exists). */
export async function loadRanking(playlistId: string): Promise<RankingData | null> {
  return await rankingStore.getItem<RankingData>(`ranking_${playlistId}`);
}
