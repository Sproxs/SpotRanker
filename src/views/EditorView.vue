<script setup lang="ts">
import { onMounted, computed, reactive, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import { usePlaylistStore } from '@/stores/playlists';
import type { SpotifyTrack } from '@/types/spotify';
import type { RankingData } from '@/types/spotify';
import { saveRanking, loadRanking } from '@/services/offlineDb';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const props = defineProps<{ playlistId: string }>();

const store = usePlaylistStore();

const playlistName = computed(() => {
  const p = store.playlists.find((pl) => pl.id === props.playlistId);
  return p?.name ?? 'Playlist';
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
// Debounced auto-save
// ---------------------------------------------------------------------------
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const ranking: RankingData = {
      S: tierData.S.map((t) => t.id),
      A: tierData.A.map((t) => t.id),
      B: tierData.B.map((t) => t.id),
      C: tierData.C.map((t) => t.id),
      D: tierData.D.map((t) => t.id),
      unranked: tierData.unranked.map((t) => t.id),
    };
    saveRanking(props.playlistId, ranking).catch((err) => {
      console.error('[EditorView] Ranking konnte nicht gespeichert werden:', err);
    });
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
    if (!initialPopulationDone.value && tracks.length > 0) {
      const savedRanking = await loadRanking(props.playlistId);
      if (savedRanking) {
        hydrateFromRanking(tracks, savedRanking);
      } else {
        tierData.unranked = [...tracks];
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

onMounted(() => {
  store.loadTracks(props.playlistId);
});
</script>

<template>
  <section class="pb-72 sm:pb-64">
    <header class="mb-4">
      <h1 class="text-3xl font-black text-white">Tier Editor</h1>
      <p class="mt-1 text-zinc-300">{{ playlistName }}</p>
    </header>

    <!-- Loading tracks -->
    <div v-if="store.isLoadingTracks" class="flex items-center justify-center py-8">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
    >
      {{ store.error }}
    </div>

    <template v-else>
      <!-- Tier rows -->
      <div class="space-y-2">
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
                class="w-20 flex-shrink-0 cursor-grab overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 transition-transform active:cursor-grabbing active:scale-105"
              >
                <div class="aspect-square w-full bg-zinc-800">
                  <img
                    v-if="element.albumCoverUrl"
                    :src="element.albumCoverUrl"
                    :alt="element.name"
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
                class="w-20 flex-shrink-0 cursor-grab overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-transform hover:border-spotify-400/50 active:cursor-grabbing active:scale-105"
              >
                <div class="aspect-square w-full bg-zinc-800">
                  <img
                    v-if="element.albumCoverUrl"
                    :src="element.albumCoverUrl"
                    :alt="element.name"
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
