import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SpotifyPlaylist, SpotifyTrack, LibraryPlaylist } from '@/types/spotify';
import {
  fetchScrapedPlaylist,
  fetchScrapedUserPlaylists,
  fetchTrackCovers,
} from '@/services/scraperApi';
import { classifyInput } from '@/utils/spotifyUrl';
import {
  savePlaylistTracks,
  loadPlaylistTracks,
  getCachedPlaylistIds,
  loadLibrary,
  saveLibrary,
  addToLibrary,
  removeFromLibrary,
} from '@/services/offlineDb';

/** Cover lookups per request — must not exceed the backend's own ceiling. */
const COVER_BATCH_SIZE = 20;

/** Result of adding pasted input – tells the view what happened. */
export type AddInputResult =
  | { kind: 'playlist'; playlist: LibraryPlaylist }
  | { kind: 'user'; playlists: SpotifyPlaylist[] }
  | { kind: 'unknown' };

export const usePlaylistStore = defineStore('playlists', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const library = ref<LibraryPlaylist[]>([]); // added by link, scraped
  const cachedPlaylistIds = ref<Set<string>>(new Set());
  const currentTracks = ref<SpotifyTrack[]>([]);
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
        const { playlist, tracks } = await fetchScrapedPlaylist(classified.id);
        const entry: LibraryPlaylist = { ...playlist, addedAt: Date.now() };
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
    const entry: LibraryPlaylist = { ...playlist, addedAt: Date.now() };
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
  // Tracks
  // ---------------------------------------------------------------------------

  /** Fetch a playlist's tracks from the scraper (the only source). */
  async function fetchTracksForPlaylist(playlistId: string): Promise<SpotifyTrack[]> {
    const entry = library.value.find((p) => p.id === playlistId);
    const { tracks, playlist } = await fetchScrapedPlaylist(playlistId);

    // Refresh the library entry with the now-known count (profile-added entries
    // start with trackCount 0).
    if (entry) {
      entry.trackCount = playlist.trackCount || tracks.length;
      if (!entry.name || entry.name === 'Unbenannte Playlist') entry.name = playlist.name;
      if (!entry.imageUrl) entry.imageUrl = playlist.imageUrl;
      await saveLibrary(library.value);
    }

    return tracks;
  }

  /**
   * Resolve album art for tracks that have none, in small batches.
   *
   * The embed payload usually carries no per-track artwork, so covers come from
   * a separate tokenless lookup. Each batch costs one request, so this runs in
   * the background: tiles show the placeholder until their cover arrives, and
   * the filled-in tracks are persisted so a second visit is instant.
   */
  async function backfillCovers(playlistId: string): Promise<void> {
    const pending = currentTracks.value.filter((t) => !t.albumCoverUrl).map((t) => t.id);
    if (pending.length === 0) return;

    let changed = false;
    for (let i = 0; i < pending.length; i += COVER_BATCH_SIZE) {
      const batch = pending.slice(i, i + COVER_BATCH_SIZE);
      let covers: Record<string, string | null>;
      try {
        covers = await fetchTrackCovers(batch);
      } catch {
        return; // offline or endpoint unavailable — placeholders stay, no error shown
      }

      for (const track of currentTracks.value) {
        const url = covers[track.id];
        if (url && !track.albumCoverUrl) {
          track.albumCoverUrl = url;
          changed = true;
        }
      }

      // Persist as we go so a reload keeps whatever was already resolved.
      if (changed) await savePlaylistTracks(playlistId, [...currentTracks.value]);
    }
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

    try {
      if (!options?.forceRefresh) {
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
    library,
    cachedPlaylistIds,
    currentTracks,
    isLoadingTracks,
    isAddingPlaylist,
    error,
    libraryError,
    searchQuery,
    profileResults,
    // computed
    filteredLibrary,
    // actions
    initLibrary,
    addPlaylistByInput,
    addScrapedPlaylist,
    removePlaylist,
    isInLibrary,
    clearProfileResults,
    loadTracks,
    backfillCovers,
  };
});
