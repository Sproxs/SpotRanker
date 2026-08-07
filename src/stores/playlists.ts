import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SpotifyPlaylist, SpotifyTrack } from '@/types/spotify';
import { fetchUserPlaylists, fetchPlaylistTracks } from '@/services/spotifyApi';
import { useAuthStore } from '@/stores/auth';
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

      // If the API call caused a forced logout (e.g. 403 scope error), do not
      // silently show stale cache – surface the re-login error immediately.
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        error.value = e instanceof Error ? e.message : 'Playlists konnten nicht geladen werden.';
        return;
      }

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

  /**
   * Load tracks for a specific playlist – uses cache if available, fetches if
   * needed. With `forceRefresh` the cache is bypassed and overwritten; if the
   * network fails, cached tracks are kept as a fallback.
   * Returns where the tracks came from.
   */
  async function loadTracks(
    playlistId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<'cache' | 'network' | 'error'> {
    isLoadingTracks.value = true;
    error.value = null;

    try {
      // 1. Try IndexedDB first (offline-first), unless a refresh is forced
      if (!options?.forceRefresh) {
        const cached = await loadPlaylistTracks(playlistId);
        if (cached && cached.length > 0) {
          currentTracks.value = cached;
          return 'cache';
        }
      }

      // 2. Fetch from API
      const apiTracks = await fetchPlaylistTracks(playlistId);
      currentTracks.value = apiTracks;

      // 3. Persist to IndexedDB for offline use
      await savePlaylistTracks(playlistId, apiTracks);
      cachedPlaylistIds.value = await getCachedPlaylistIds();
      return 'network';
    } catch (e) {
      // Forced refresh gone wrong (e.g. offline) – fall back to the cache
      // instead of wiping the editor.
      if (options?.forceRefresh) {
        const cached = await loadPlaylistTracks(playlistId);
        if (cached && cached.length > 0) {
          currentTracks.value = cached;
          return 'cache';
        }
      }
      error.value = e instanceof Error ? e.message : 'Tracks konnten nicht geladen werden.';
      currentTracks.value = [];
      return 'error';
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
