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
  try {
    await playlistStore.setItem('userPlaylists', playlists);
  } catch (err) {
    console.error('[offlineDb] Playlists konnten nicht gespeichert werden:', err);
    throw new Error('Playlists konnten nicht im lokalen Speicher gespeichert werden.');
  }
}

/** Load playlists from IndexedDB (returns empty array if none cached). */
export async function loadPlaylists(): Promise<SpotifyPlaylist[]> {
  try {
    return (await playlistStore.getItem<SpotifyPlaylist[]>('userPlaylists')) ?? [];
  } catch (err) {
    console.error('[offlineDb] Playlists konnten nicht geladen werden:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Track helpers (keyed by playlistId)
// ---------------------------------------------------------------------------

/** Persist tracks for one playlist. */
export async function savePlaylistTracks(playlistId: string, tracks: SpotifyTrack[]): Promise<void> {
  try {
    await trackStore.setItem(`tracks_${playlistId}`, tracks);
  } catch (err) {
    console.error('[offlineDb] Tracks konnten nicht gespeichert werden:', err);
    throw new Error('Tracks konnten nicht im lokalen Speicher gespeichert werden.');
  }
}

/** Load cached tracks for a playlist (returns null if not cached). */
export async function loadPlaylistTracks(playlistId: string): Promise<SpotifyTrack[] | null> {
  try {
    return await trackStore.getItem<SpotifyTrack[]>(`tracks_${playlistId}`);
  } catch (err) {
    console.error('[offlineDb] Tracks konnten nicht geladen werden:', err);
    return null;
  }
}

/** Check whether tracks for a playlist are already cached. */
export async function hasPlaylistTracks(playlistId: string): Promise<boolean> {
  try {
    const data = await trackStore.getItem(`tracks_${playlistId}`);
    return data !== null;
  } catch (err) {
    console.error('[offlineDb] Cache-Prüfung fehlgeschlagen:', err);
    return false;
  }
}

/** Return set of playlist IDs that have cached tracks. */
export async function getCachedPlaylistIds(): Promise<Set<string>> {
  try {
    const keys = await trackStore.keys();
    const prefix = 'tracks_';
    const ids = keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    return new Set(ids);
  } catch (err) {
    console.error('[offlineDb] Cached-IDs konnten nicht geladen werden:', err);
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Ranking helpers (keyed by playlistId)
// ---------------------------------------------------------------------------

/** Persist ranking (tier → track-ID mapping) for one playlist. */
export async function saveRanking(playlistId: string, ranking: RankingData): Promise<void> {
  try {
    await rankingStore.setItem(`ranking_${playlistId}`, ranking);
  } catch (err) {
    console.error('[offlineDb] Ranking konnte nicht gespeichert werden:', err);
    throw new Error('Ranking konnte nicht im lokalen Speicher gespeichert werden.');
  }
}

/** Load a saved ranking for a playlist (returns null if none exists). */
export async function loadRanking(playlistId: string): Promise<RankingData | null> {
  try {
    return await rankingStore.getItem<RankingData>(`ranking_${playlistId}`);
  } catch (err) {
    console.error('[offlineDb] Ranking konnte nicht geladen werden:', err);
    return null;
  }
}
