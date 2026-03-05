<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePlaylistStore } from '@/stores/playlists';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const router = useRouter();
const store = usePlaylistStore();

onMounted(() => {
  store.loadUserPlaylists();
});

function openEditor(playlistId: string) {
  router.push({ name: 'editor', params: { playlistId } });
}
</script>

<template>
  <section class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-black text-white">Deine Playlists</h1>
      <p class="mt-2 text-zinc-300">Wähle eine Playlist, um eine Tier-List zu erstellen.</p>
    </div>

    <!-- Search -->
    <div>
      <input
        v-model="store.searchQuery"
        type="text"
        placeholder="Playlists durchsuchen…"
        class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-spotify-400 focus:ring-1 focus:ring-spotify-400 sm:max-w-sm"
      />
    </div>

    <!-- Loading -->
    <div v-if="store.isLoadingPlaylists" class="flex items-center justify-center py-12">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
    >
      {{ store.error }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="store.filteredPlaylists.length === 0 && !store.isLoadingPlaylists"
      class="py-12 text-center text-zinc-400"
    >
      <template v-if="store.searchQuery">
        Keine Playlists für „{{ store.searchQuery }}" gefunden.
      </template>
      <template v-else>
        Du hast noch keine Playlists. Erstelle eine auf Spotify und lade die Seite neu.
      </template>
    </div>

    <!-- Playlist grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="playlist in store.filteredPlaylists"
        :key="playlist.id"
        class="group cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-spotify-400/50 hover:bg-zinc-800/80"
        @click="openEditor(playlist.id)"
      >
        <!-- Cover -->
        <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-800">
          <img
            v-if="playlist.imageUrl"
            :src="playlist.imageUrl"
            :alt="playlist.name"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div v-else class="flex h-full items-center justify-center text-4xl text-zinc-600">🎵</div>

          <!-- Offline badge -->
          <span
            v-if="store.cachedPlaylistIds.has(playlist.id)"
            class="absolute bottom-2 right-2 rounded-full bg-spotify-400/90 px-2 py-0.5 text-[10px] font-bold text-black"
          >
            Offline
          </span>
        </div>

        <!-- Info -->
        <h2 class="mt-3 truncate text-sm font-semibold text-white group-hover:text-spotify-400">
          {{ playlist.name }}
        </h2>
        <p class="truncate text-xs text-zinc-400">
          {{ playlist.owner }} · {{ playlist.trackCount }} Songs
        </p>
      </article>
    </div>
  </section>
</template>
