import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SpotifyPlaylist, SpotifyTrack, LibraryPlaylist } from '@/types/spotify';
import { fetchUserPlaylists, fetchPlaylistTracks } from '@/services/spotifyApi';
import { fetchScrapedPlaylist, fetchScrapedUserPlaylists } from '@/services/scraperApi';
import { classifyInput } from '@/utils/spotifyUrl';
import { useAuthStore } from '@/stores/auth';
import {
  savePlaylists,
  loadPlaylists,
  savePlaylistTracks,
  loadPlaylistTracks,
  getCachedPlaylistIds,
  loadLibrary,
  saveLibrary,
  addToLibrary,
  removeFromLibrary,
} from '@/services/offlineDb';

/** Result of adding pasted input – tells the view what happened. */
export type AddInputResult =
  | { kind: 'playlist'; playlist: LibraryPlaylist }
  | { kind: 'user'; playlists: SpotifyPlaylist[] }
  | { kind: 'unknown' };

export const usePlaylistStore = defineStore('playlists', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const playlists = ref<SpotifyPlaylist[]>([]); // OAuth "Meine Playlists"
  const library = ref<LibraryPlaylist[]>([]); // scraper-first, added by link
  const cachedPlaylistIds = ref<Set<string>>(new Set());
  const currentTracks = ref<SpotifyTrack[]>([]);
  const isLoadingPlaylists = ref(false);
  const isLoadingTracks = ref(false);
  const isAddingPlaylist = ref(false);
  const error = ref<string | null>(null);
  const libraryError = ref<string | null>(null);
  const searchQuery = ref('');

  // Public playlists returned by a pasted profile link (awaiting one-click add).
  const profileResults = ref<SpotifyPlaylist[]>([]);

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

  const filteredLibrary = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return library.value;
    return library.value.filter(
      (p) => p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q),
    );
  });

  // ---------------------------------------------------------------------------
  // Library (scraper) actions
  // ---------------------------------------------------------------------------

  /** Load the persistent local library from IndexedDB. */
  async function initLibrary(): Promise<void> {
    library.value = await loadLibrary();
    cachedPlaylistIds.value = await getCachedPlaylistIds();
  }

  /**
   * Add pasted input to the library. A playlist link is scraped and added
   * immediately; a profile link returns that profile's public playlists for the
   * view to offer one-click adding (they are NOT auto-added).
   */
  async function addPlaylistByInput(input: string): Promise<AddInputResult> {
    isAddingPlaylist.value = true;
    libraryError.value = null;
    profileResults.value = [];

    try {
      const classified = classifyInput(input);

      if (classified.kind === 'playlist' && classified.id) {
        const { playlist, tracks, degraded, degradedReason } = await fetchScrapedPlaylist(
          classified.id,
        );
        const entry: LibraryPlaylist = {
          ...playlist,
          source: 'scraped',
          addedAt: Date.now(),
          degraded,
          degradedReason,
        };
        library.value = await addToLibrary(entry);
        await savePlaylistTracks(entry.id, tracks);
        cachedPlaylistIds.value = await getCachedPlaylistIds();
        return { kind: 'playlist', playlist: entry };
      }

      if (classified.kind === 'user' && classified.id) {
        const results = await fetchScrapedUserPlaylists(classified.id);
        profileResults.value = results;
        return { kind: 'user', playlists: results };
      }

      libraryError.value = 'Kein gültiger Spotify-Playlist- oder Profil-Link erkannt.';
      return { kind: 'unknown' };
    } catch (e) {
      libraryError.value = e instanceof Error ? e.message : 'Hinzufügen fehlgeschlagen.';
      return { kind: 'unknown' };
    } finally {
      isAddingPlaylist.value = false;
    }
  }

  /** One-click add for a playlist listed from a profile. */
  async function addScrapedPlaylist(playlist: SpotifyPlaylist): Promise<void> {
    const entry: LibraryPlaylist = { ...playlist, source: 'scraped', addedAt: Date.now() };
    library.value = await addToLibrary(entry);
  }

  /** Remove a library entry (and its cached tracks/ranking). */
  async function removePlaylist(id: string): Promise<void> {
    library.value = await removeFromLibrary(id);
    cachedPlaylistIds.value = await getCachedPlaylistIds();
  }

  /** True if a playlist id is already in the library. */
  function isInLibrary(id: string): boolean {
    return library.value.some((p) => p.id === id);
  }

  function clearProfileResults(): void {
    profileResults.value = [];
  }

  // ---------------------------------------------------------------------------
  // OAuth "Meine Playlists" (unchanged behavior)
  // ---------------------------------------------------------------------------

  /** Load the signed-in user's playlists – tries API first, falls back to cache. */
  async function loadUserPlaylists(): Promise<void> {
    isLoadingPlaylists.value = true;
    error.value = null;

    try {
      const apiPlaylists = await fetchUserPlaylists();
      playlists.value = apiPlaylists;
      await savePlaylists(apiPlaylists);
    } catch (e) {
      console.warn('[PlaylistStore] API-Abruf fehlgeschlagen, lade aus Cache…', e);

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

    cachedPlaylistIds.value = await getCachedPlaylistIds();
  }

  // ---------------------------------------------------------------------------
  // Tracks – source-routed (scraper vs. authenticated account)
  // ---------------------------------------------------------------------------

  /**
   * Decide how to fetch a playlist's tracks:
   * - `account`  → the OAuth Web API (private playlists, "Meine Playlists").
   * - `scraped`  → the built-in scraper (default, no login).
   * A library entry's own `source` wins; otherwise a signed-in user defaults to
   * the account API and everyone else to the scraper.
   */
  async function fetchTracksForPlaylist(playlistId: string): Promise<SpotifyTrack[]> {
    const entry = library.value.find((p) => p.id === playlistId);
    const auth = useAuthStore();

    const useAccount = entry
      ? entry.source === 'account'
      : auth.isAuthenticated;

    if (useAccount) {
      return fetchPlaylistTracks(playlistId);
    }

    const { tracks, playlist, degraded, degradedReason } = await fetchScrapedPlaylist(playlistId);

    // Refresh the library entry with the now-known count/degraded (profile-added
    // entries start with trackCount 0).
    if (entry) {
      entry.trackCount = playlist.trackCount || tracks.length;
      entry.degraded = degraded;
      entry.degradedReason = degradedReason;
      if (!entry.name || entry.name === 'Unbenannte Playlist') entry.name = playlist.name;
      if (!entry.imageUrl) entry.imageUrl = playlist.imageUrl;
      await saveLibrary(library.value);
    }

    return tracks;
  }

  /**
   * Load tracks for a playlist – cache-first unless `forceRefresh`. On a forced
   * refresh that fails (e.g. offline) the cached tracks are kept.
   */
  async function loadTracks(
    playlistId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<'cache' | 'network' | 'error'> {
    isLoadingTracks.value = true;
    error.value = null;

    // Cached tracks from a degraded fetch (embed fallback: no album covers,
    // list truncated) are worth one re-attempt per open. Nothing else ever
    // invalidates the IndexedDB copy, so without this the placeholder tiles
    // would stay forever even after the upstream cause cleared.
    const entry = library.value.find((p) => p.id === playlistId);
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const retryDegraded = entry?.degraded === true && online;
    const mayFallBackToCache = options?.forceRefresh === true || retryDegraded;

    try {
      if (!options?.forceRefresh && !retryDegraded) {
        const cached = await loadPlaylistTracks(playlistId);
        if (cached && cached.length > 0) {
          currentTracks.value = cached;
          return 'cache';
        }
      }

      const apiTracks = await fetchTracksForPlaylist(playlistId);
      currentTracks.value = apiTracks;

      await savePlaylistTracks(playlistId, apiTracks);
      cachedPlaylistIds.value = await getCachedPlaylistIds();
      return 'network';
    } catch (e) {
      if (mayFallBackToCache) {
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
    library,
    cachedPlaylistIds,
    currentTracks,
    isLoadingPlaylists,
    isLoadingTracks,
    isAddingPlaylist,
    error,
    libraryError,
    searchQuery,
    profileResults,
    // computed
    filteredPlaylists,
    filteredLibrary,
    // library actions
    initLibrary,
    addPlaylistByInput,
    addScrapedPlaylist,
    removePlaylist,
    isInLibrary,
    clearProfileResults,
    // account actions
    loadUserPlaylists,
    loadTracks,
  };
});
