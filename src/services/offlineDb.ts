import localforage from 'localforage';
import type { SpotifyPlaylist, SpotifyTrack } from '@/types/spotify';

// ---------------------------------------------------------------------------
// Separate stores for playlists & tracks
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
