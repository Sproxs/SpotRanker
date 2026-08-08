<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, reactive, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import html2canvas from 'html2canvas';
import { useRouter } from 'vue-router';
import { usePlaylistStore } from '@/stores/playlists';
import { useAuthStore } from '@/stores/auth';
import type { SpotifyTrack } from '@/types/spotify';
import type { RankingData } from '@/types/spotify';
import { saveRanking, loadRanking } from '@/services/offlineDb';
import SkeletonTierRow from '@/components/ui/SkeletonTierRow.vue';

const props = defineProps<{ playlistId: string }>();

const router = useRouter();
const store = usePlaylistStore();
const auth = useAuthStore();

const playlistName = computed(() => {
  const p =
    store.library.find((pl) => pl.id === props.playlistId) ??
    store.playlists.find((pl) => pl.id === props.playlistId);
  return p?.name ?? 'Playlist';
});

// Whether this playlist is loaded via the authenticated account (OAuth) rather
// than the scraper – only then does an "erneut einloggen" prompt make sense.
const isAccountPlaylist = computed(() => {
  const entry = store.library.find((pl) => pl.id === props.playlistId);
  if (entry) return entry.source === 'account';
  return auth.isAuthenticated;
});

// ---------------------------------------------------------------------------
// Tier definitions & colors
// ---------------------------------------------------------------------------
const tiers = ['S', 'A', 'B', 'C', 'D'] as const;
type TierKey = (typeof tiers)[number];

const tierColors: Record<TierKey, string> = {
  S: 'bg-red-600',
  A: 'bg-orange-500',
  B: 'bg-yellow-500',
  C: 'bg-green-500',
  D: 'bg-blue-500',
};

const tierBorderColors: Record<TierKey, string> = {
  S: 'border-red-600/40',
  A: 'border-orange-500/40',
  B: 'border-yellow-500/40',
  C: 'border-green-500/40',
  D: 'border-blue-500/40',
};

// ---------------------------------------------------------------------------
// Reactive tier data – songs for each tier + unranked pool
// ---------------------------------------------------------------------------
const tierData = reactive<Record<TierKey | 'unranked', SpotifyTrack[]>>({
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
  unranked: [],
});

// Track whether initial population from the store has already occurred
const initialPopulationDone = ref(false);

// ---------------------------------------------------------------------------
// User-facing status message (toast-style feedback)
// ---------------------------------------------------------------------------
const statusMessage = ref('');
let statusTimer: ReturnType<typeof setTimeout> | null = null;

function showStatus(msg: string, durationMs = 3000): void {
  statusMessage.value = msg;
  if (statusTimer !== null) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusMessage.value = '';
    statusTimer = null;
  }, durationMs);
}

// ---------------------------------------------------------------------------
// Hydration helper – restore ranking from IndexedDB into tierData
// ---------------------------------------------------------------------------
function hydrateFromRanking(tracks: SpotifyTrack[], ranking: RankingData): void {
  const trackMap = new Map<string, SpotifyTrack>();
  for (const t of tracks) {
    trackMap.set(t.id, t);
  }

  const allTierKeys: (TierKey | 'unranked')[] = [...tiers, 'unranked'];

  for (const key of allTierKeys) {
    const ids: string[] = ranking[key] ?? [];
    tierData[key] = ids
      .map((id) => trackMap.get(id))
      .filter((t): t is SpotifyTrack => t !== undefined);
  }

  // Any tracks not referenced in the saved ranking go back to unranked
  const assignedIds = new Set(allTierKeys.flatMap((k) => ranking[k] ?? []));
  const leftover = tracks.filter((t) => !assignedIds.has(t.id));
  if (leftover.length > 0) {
    tierData.unranked.push(...leftover);
  }
}

// ---------------------------------------------------------------------------
// Debounced auto-save with serialization guard
// ---------------------------------------------------------------------------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let isSaving = false;
let pendingSave: RankingData | null = null;

async function executeSave(ranking: RankingData): Promise<void> {
  if (isSaving) {
    // Queue the latest state – only the most recent matters
    pendingSave = ranking;
    return;
  }

  isSaving = true;
  let current: RankingData | null = ranking;

  while (current) {
    try {
      await saveRanking(props.playlistId, current);
    } catch (err) {
      console.error('[EditorView] Ranking konnte nicht gespeichert werden:', err);
      showStatus('Speichern fehlgeschlagen – bitte erneut versuchen.');
    }
    // If a newer save was queued while we were writing, flush it now
    current = pendingSave;
    pendingSave = null;
  }

  isSaving = false;
}

function buildRanking(): RankingData {
  return {
    S: tierData.S.map((t) => t.id),
    A: tierData.A.map((t) => t.id),
    B: tierData.B.map((t) => t.id),
    C: tierData.C.map((t) => t.id),
    D: tierData.D.map((t) => t.id),
    unranked: tierData.unranked.map((t) => t.id),
  };
}

function debouncedSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    // Fire-and-forget: executeSave handles errors internally
    void executeSave(buildRanking());
  }, 500);
}

// Watch tierData deeply and trigger debounced save after initial hydration
watch(tierData, () => {
  if (initialPopulationDone.value) {
    debouncedSave();
  }
}, { deep: true });

// When tracks are loaded from the store, populate tiers (with hydration)
watch(
  () => store.currentTracks,
  async (tracks) => {
    if (initialPopulationDone.value) return;

    // Handle empty playlists: mark done immediately so the UI is consistent
    if (tracks.length === 0 && !store.isLoadingTracks) {
      initialPopulationDone.value = true;
      return;
    }

    if (tracks.length > 0) {
      try {
        const savedRanking = await loadRanking(props.playlistId);
        if (savedRanking) {
          hydrateFromRanking(tracks, savedRanking);
        } else {
          tierData.unranked = [...tracks];
        }
      } catch (err) {
        console.error('[EditorView] Ranking-Hydration fehlgeschlagen:', err);
        tierData.unranked = [...tracks];
        showStatus('Gespeichertes Ranking konnte nicht geladen werden.');
      }
      initialPopulationDone.value = true;
    }
  },
);

// True when no tracks exist anywhere (empty state)
const hasNoTracks = computed(() =>
  tierData.unranked.length === 0 && tiers.every((t) => tierData[t].length === 0),
);

// Shared sortable group so items can move between all lists
const dragGroup = { name: 'tierlist', pull: true, put: true };

// ---------------------------------------------------------------------------
// Image Export & Sharing – shared config
// ---------------------------------------------------------------------------
const tierListRef = ref<HTMLElement | null>(null);
const isExporting = ref(false);

const canvasOptions = {
  backgroundColor: '#09090b',
  useCORS: true,
  scale: 2,
} as const;

async function exportAsImage(): Promise<void> {
  if (!tierListRef.value || isExporting.value) return;
  isExporting.value = true;

  try {
    const canvas = await html2canvas(tierListRef.value, canvasOptions);
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${playlistName.value}-tierlist.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('[EditorView] Image export failed:', err);
    showStatus('Bild-Export fehlgeschlagen.');
  } finally {
    isExporting.value = false;
  }
}

// ---------------------------------------------------------------------------
// Sharing (Web Share API with clipboard fallback)
// ---------------------------------------------------------------------------
const isSharing = ref(false);

async function shareImage(): Promise<void> {
  if (!tierListRef.value || isSharing.value) return;
  isSharing.value = true;

  try {
    const canvas = await html2canvas(tierListRef.value, canvasOptions);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('Failed to create image blob');

    if (navigator.share) {
      const file = new File([blob], `${playlistName.value}-tierlist.png`, {
        type: 'image/png',
      });
      await navigator.share({
        title: `${playlistName.value} – SpotRanker Tier List`,
        files: [file],
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      shareTooltip.value = 'Copied to clipboard!';
      setTimeout(() => (shareTooltip.value = ''), 2000);
    }
  } catch (err) {
    if ((err as DOMException).name !== 'AbortError') {
      console.error('[EditorView] Share failed:', err);
      showStatus('Teilen fehlgeschlagen.');
    }
  } finally {
    isSharing.value = false;
  }
}

const shareTooltip = ref('');

// ---------------------------------------------------------------------------
// Manual refresh – bypass the track cache and re-hydrate the tier list
// ---------------------------------------------------------------------------
const isRefreshing = ref(false);

async function refreshTracks(): Promise<void> {
  if (isRefreshing.value || store.isLoadingTracks) return;
  isRefreshing.value = true;

  try {
    // Persist the current ranking immediately so re-hydration uses fresh state
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await executeSave(buildRanking());

    initialPopulationDone.value = false;
    const source = await store.loadTracks(props.playlistId, { forceRefresh: true });

    if (source === 'network') {
      showStatus('Playlist aktualisiert.');
    } else if (source === 'cache') {
      showStatus('Keine Verbindung – zeige zwischengespeicherte Tracks.');
    }
  } finally {
    isRefreshing.value = false;
  }
}

onBeforeUnmount(() => {
  // Clean up pending save timer to prevent writes after unmount
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (statusTimer !== null) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
});

onMounted(() => {
  store.loadTracks(props.playlistId);
});
</script>

<template>
  <section class="pb-72 sm:pb-64">
    <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black text-white">Tier Editor</h1>
        <p class="mt-1 text-zinc-300">{{ playlistName }}</p>
      </div>

      <!-- Action buttons -->
      <div v-if="!store.isLoadingTracks && !store.error" class="flex flex-wrap gap-2">
        <button
          :disabled="isRefreshing"
          class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
          @click="refreshTracks"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="{ 'animate-spin': isRefreshing }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
          {{ isRefreshing ? 'Aktualisiere…' : 'Aktualisieren' }}
        </button>

        <button
          :disabled="isExporting"
          class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
          @click="exportAsImage"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          {{ isExporting ? 'Exporting…' : 'Save as Image' }}
        </button>

        <div class="relative">
          <button
            :disabled="isSharing"
            class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
            @click="shareImage"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
            {{ isSharing ? 'Sharing…' : 'Share' }}
          </button>
          <span
            v-if="shareTooltip"
            class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-700 px-2 py-1 text-[10px] text-white"
          >
            {{ shareTooltip }}
          </span>
        </div>
      </div>
    </header>

    <!-- Status toast -->
    <Transition name="fade">
      <div
        v-if="statusMessage"
        class="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 shadow-lg"
      >
        {{ statusMessage }}
      </div>
    </Transition>

    <!-- Loading skeleton -->
    <div v-if="store.isLoadingTracks" class="space-y-2">
      <SkeletonTierRow v-for="n in 5" :key="n" />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
    >
      <p>{{ store.error }}</p>
      <button
        v-if="isAccountPlaylist"
        class="mt-3 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:text-red-200"
        @click="auth.logout(); router.replace({ name: 'home' })"
      >
        Erneut einloggen
      </button>
    </div>

    <template v-else>
      <!-- Tier rows (captured for export) -->
      <div ref="tierListRef" class="space-y-2">
        <div
          v-for="tier in tiers"
          :key="tier"
          :class="[
            tierBorderColors[tier],
            'grid min-h-20 grid-cols-[4rem_1fr] items-stretch overflow-hidden rounded-xl border bg-zinc-900/70 transition-colors',
          ]"
        >
          <!-- Tier label -->
          <div
            :class="[tierColors[tier], 'flex items-center justify-center text-lg font-black text-white select-none']"
          >
            {{ tier }}
          </div>

          <!-- Draggable drop zone -->
          <draggable
            v-model="tierData[tier]"
            :group="dragGroup"
            item-key="id"
            :animation="200"
            ghost-class="opacity-40"
            drag-class="rotate-2"
            class="flex min-h-20 flex-wrap items-start gap-2 p-2"
          >
            <template #item="{ element }: { element: SpotifyTrack }">
              <div
                class="group/tile relative w-20 flex-shrink-0 cursor-grab overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 transition-transform active:cursor-grabbing active:scale-105"
              >
                <div class="relative aspect-square w-full bg-zinc-800">
                  <img
                    v-if="element.albumCoverUrl"
                    :src="element.albumCoverUrl"
                    :alt="element.name"
                    crossorigin="anonymous"
                    class="pointer-events-none h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div v-else class="flex h-full items-center justify-center text-xl text-zinc-600">🎵</div>
                </div>
                <div class="p-1">
                  <p class="truncate text-[10px] font-semibold text-white">{{ element.name }}</p>
                  <p class="truncate text-[9px] text-zinc-400">{{ element.artist }}</p>
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </div>

      <!-- Sticky unranked pool (bottom) -->
      <div
        class="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-700 bg-zinc-950/95 backdrop-blur-md"
      >
        <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <h2 class="mb-2 text-sm font-semibold text-zinc-300">
            Unranked Pool ({{ tierData.unranked.length }})
          </h2>

          <div
            v-if="hasNoTracks"
            class="py-4 text-center text-sm text-zinc-500"
          >
            Keine Tracks gefunden.
          </div>

          <draggable
            v-model="tierData.unranked"
            :group="dragGroup"
            item-key="id"
            :animation="200"
            ghost-class="opacity-40"
            drag-class="rotate-2"
            class="flex max-h-44 flex-wrap gap-2 overflow-y-auto sm:max-h-40"
          >
            <template #item="{ element }: { element: SpotifyTrack }">
              <div
                class="group/tile relative w-20 flex-shrink-0 cursor-grab overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-transform hover:border-spotify-400/50 active:cursor-grabbing active:scale-105"
                style="content-visibility: auto; contain-intrinsic-size: 5rem 6.5rem"
              >
                <div class="relative aspect-square w-full bg-zinc-800">
                  <img
                    v-if="element.albumCoverUrl"
                    :src="element.albumCoverUrl"
                    :alt="element.name"
                    crossorigin="anonymous"
                    class="pointer-events-none h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div v-else class="flex h-full items-center justify-center text-xl text-zinc-600">🎵</div>
                </div>
                <div class="p-1">
                  <p class="truncate text-[10px] font-semibold text-white">{{ element.name }}</p>
                  <p class="truncate text-[9px] text-zinc-400">{{ element.artist }}</p>
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
