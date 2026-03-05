<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { usePlaylistStore } from '@/stores/playlists';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const props = defineProps<{ playlistId: string }>();

const store = usePlaylistStore();

const playlistName = computed(() => {
  const p = store.playlists.find((pl) => pl.id === props.playlistId);
  return p?.name ?? 'Playlist';
});

const tiers = ['S', 'A', 'B', 'C', 'D'];
const tierColors: Record<string, string> = {
  S: 'bg-red-600',
  A: 'bg-orange-500',
  B: 'bg-yellow-500',
  C: 'bg-green-500',
  D: 'bg-blue-500',
};

onMounted(() => {
  store.loadTracks(props.playlistId);
});
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="text-3xl font-black text-white">Tier Editor</h1>
      <p class="mt-1 text-zinc-300">{{ playlistName }}</p>
    </header>

    <!-- Tier rows (Phase 4 will add drag & drop) -->
    <div class="space-y-2">
      <div
        v-for="tier in tiers"
        :key="tier"
        class="grid min-h-20 grid-cols-[4rem_1fr] items-stretch overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70"
      >
        <div
          :class="[tierColors[tier], 'flex items-center justify-center text-lg font-black text-white']"
        >
          {{ tier }}
        </div>
        <div class="flex items-center px-3 text-sm text-zinc-400">
          Drop-Zone wird in Phase 4 mit Drag &amp; Drop aktiv.
        </div>
      </div>
    </div>

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

    <!-- Unranked pool -->
    <div
      v-else
      class="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4"
    >
      <h2 class="mb-3 text-sm font-semibold text-zinc-300">
        Unranked Pool ({{ store.currentTracks.length }} Songs)
      </h2>

      <div
        v-if="store.currentTracks.length === 0"
        class="py-6 text-center text-sm text-zinc-500"
      >
        Keine Tracks gefunden.
      </div>

      <div v-else class="flex flex-wrap gap-3">
        <div
          v-for="track in store.currentTracks"
          :key="track.id"
          class="w-24 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition hover:border-spotify-400/50"
        >
          <div class="aspect-square w-full bg-zinc-800">
            <img
              v-if="track.albumCoverUrl"
              :src="track.albumCoverUrl"
              :alt="track.name"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex h-full items-center justify-center text-2xl text-zinc-600">🎵</div>
          </div>
          <div class="p-1.5">
            <p class="truncate text-[10px] font-semibold text-white">{{ track.name }}</p>
            <p class="truncate text-[9px] text-zinc-400">{{ track.artist }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
