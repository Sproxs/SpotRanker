import localforage from 'localforage';
import type { SpotifyPlaylist, SpotifyTrack, RankingData, LibraryPlaylist } from '@/types/spotify';

// ---------------------------------------------------------------------------
// Separate stores for playlists, tracks & rankings
// ---------------------------------------------------------------------------

const playlistStore = localforage.createInstance({
  name: 'spotranker',
  storeName: 'playlists',
  description: 'The local playlist library',
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
// Library helpers – the playlists the user added by link
// ---------------------------------------------------------------------------

const LIBRARY_KEY = 'libraryPlaylists';

/** Load the persistent library (returns empty array if none saved). */
export async function loadLibrary(): Promise<LibraryPlaylist[]> {
  try {
    return (await playlistStore.getItem<LibraryPlaylist[]>(LIBRARY_KEY)) ?? [];
  } catch (err) {
    console.error('[offlineDb] Bibliothek konnte nicht geladen werden:', err);
    return [];
  }
}

/** Persist the full library array. */
export async function saveLibrary(library: LibraryPlaylist[]): Promise<void> {
  try {
    await playlistStore.setItem(LIBRARY_KEY, library);
  } catch (err) {
    console.error('[offlineDb] Bibliothek konnte nicht gespeichert werden:', err);
    throw new Error(
      `Bibliothek konnte nicht gespeichert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Add (or update) a library entry, newest first, deduped by id. Returns the new list. */
export async function addToLibrary(entry: LibraryPlaylist): Promise<LibraryPlaylist[]> {
  const current = await loadLibrary();
  const withoutDupe = current.filter((p) => p.id !== entry.id);
  const updated = [entry, ...withoutDupe];
  await saveLibrary(updated);
  return updated;
}

/**
 * Remove a library entry and its cached tracks + ranking, so nothing is
 * orphaned. Returns the new library list.
 */
export async function removeFromLibrary(id: string): Promise<LibraryPlaylist[]> {
  const current = await loadLibrary();
  const updated = current.filter((p) => p.id !== id);
  await saveLibrary(updated);
  await Promise.all([
    trackStore.removeItem(`tracks_${id}`).catch(() => {}),
    rankingStore.removeItem(`ranking_${id}`).catch(() => {}),
  ]);
  return updated;
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
    throw new Error(`Tracks konnten nicht im lokalen Speicher gespeichert werden: ${err instanceof Error ? err.message : String(err)}`);
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
    throw new Error(`Ranking konnte nicht im lokalen Speicher gespeichert werden: ${err instanceof Error ? err.message : String(err)}`);
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

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/** Clear all cached data (playlists, tracks and rankings). */
export async function clearAllCaches(): Promise<void> {
  await Promise.all([playlistStore.clear(), trackStore.clear(), rankingStore.clear()]);
}
