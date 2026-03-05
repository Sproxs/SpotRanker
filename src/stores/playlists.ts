import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SpotifyPlaylist, SpotifyTrack } from '@/types/spotify';
import { fetchUserPlaylists, fetchPlaylistTracks } from '@/services/spotifyApi';
import {
  savePlaylists,
  loadPlaylists,
  savePlaylistTracks,
  loadPlaylistTracks,
  getCachedPlaylistIds,
} from '@/services/offlineDb';

export const usePlaylistStore = defineStore('playlists', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const playlists = ref<SpotifyPlaylist[]>([]);
  const cachedPlaylistIds = ref<Set<string>>(new Set());
  const currentTracks = ref<SpotifyTrack[]>([]);
  const isLoadingPlaylists = ref(false);
  const isLoadingTracks = ref(false);
  const error = ref<string | null>(null);
  const searchQuery = ref('');

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------
  const filteredPlaylists = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return playlists.value;
    return playlists.value.filter(
      (p) => p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q),
    );
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Load playlists – tries API first, falls back to IndexedDB cache. */
  async function loadUserPlaylists(): Promise<void> {
    isLoadingPlaylists.value = true;
    error.value = null;

    try {
      // Always try the network first
      const apiPlaylists = await fetchUserPlaylists();
      playlists.value = apiPlaylists;
      await savePlaylists(apiPlaylists);
    } catch (e) {
      // Offline or token error – fall back to cache
      console.warn('[PlaylistStore] API-Abruf fehlgeschlagen, lade aus Cache…', e);
      const cached = await loadPlaylists();
      if (cached.length > 0) {
        playlists.value = cached;
      } else {
        error.value = e instanceof Error ? e.message : 'Playlists konnten nicht geladen werden.';
      }
    } finally {
      isLoadingPlaylists.value = false;
    }

    // Refresh offline indicators
    cachedPlaylistIds.value = await getCachedPlaylistIds();
  }

  /** Load tracks for a specific playlist – uses cache if available, fetches if needed. */
  async function loadTracks(playlistId: string): Promise<void> {
    isLoadingTracks.value = true;
    error.value = null;

    try {
      // 1. Try IndexedDB first (offline-first)
      const cached = await loadPlaylistTracks(playlistId);
      if (cached && cached.length > 0) {
        currentTracks.value = cached;
        return;
      }

      // 2. Fetch from API
      const apiTracks = await fetchPlaylistTracks(playlistId);
      currentTracks.value = apiTracks;

      // 3. Persist to IndexedDB for offline use
      await savePlaylistTracks(playlistId, apiTracks);
      cachedPlaylistIds.value = await getCachedPlaylistIds();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Tracks konnten nicht geladen werden.';
      currentTracks.value = [];
    } finally {
      isLoadingTracks.value = false;
    }
  }

  return {
    // state
    playlists,
    cachedPlaylistIds,
    currentTracks,
    isLoadingPlaylists,
    isLoadingTracks,
    error,
    searchQuery,
    // computed
    filteredPlaylists,
    // actions
    loadUserPlaylists,
    loadTracks,
  };
});
