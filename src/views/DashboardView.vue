<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePlaylistStore } from '@/stores/playlists';
import { useAuthStore } from '@/stores/auth';
import type { LibraryPlaylist, SpotifyPlaylist } from '@/types/spotify';
import { DEGRADED_REASON_TEXT } from '@/types/spotify';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';

const router = useRouter();
const route = useRoute();
const store = usePlaylistStore();
const auth = useAuthStore();

const addInput = ref('');

async function handleAdd() {
  const value = addInput.value.trim();
  if (!value) return;
  const result = await store.addPlaylistByInput(value);
  if (result.kind === 'playlist') {
    addInput.value = '';
  }
}

function openEditor(playlistId: string) {
  router.push({ name: 'editor', params: { playlistId } });
}

async function addFromProfile(playlist: SpotifyPlaylist) {
  await store.addScrapedPlaylist(playlist);
}

/** Badge tooltip: name the actual cause when the backend reported one. */
function degradedTitle(playlist: LibraryPlaylist): string {
  const base = 'Eingeschränkte Daten (ohne Album-Cover, evtl. gekürzt)';
  const reason = playlist.degradedReason;
  return reason ? `${base} – ${DEGRADED_REASON_TEXT[reason]}` : base;
}

onMounted(async () => {
  await store.initLibrary();

  // Deep-link from the home page: /dashboard?add=<link>
  const add = route.query.add;
  if (typeof add === 'string' && add.trim()) {
    addInput.value = add.trim();
    await handleAdd();
    router.replace({ name: 'dashboard' });
  }

  // Signed-in users also see their own Spotify playlists.
  if (auth.isAuthenticated) {
    store.loadUserPlaylists();
  }
});
</script>

<template>
  <section class="space-y-8">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-black text-white">Deine Playlists</h1>
      <p class="mt-2 text-zinc-300">
        Füge eine öffentliche Playlist per Link hinzu und erstelle eine Tier-List – ganz ohne Login.
      </p>
    </div>

    <!-- Add by link -->
    <div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="handleAdd">
        <input
          v-model="addInput"
          type="text"
          inputmode="url"
          placeholder="Playlist- oder Profil-Link einfügen (open.spotify.com/…)"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-spotify-400 focus:ring-1 focus:ring-spotify-400"
        />
        <button
          type="submit"
          :disabled="store.isAddingPlaylist"
          class="shrink-0 rounded-lg bg-spotify-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-spotify-400 disabled:opacity-50"
        >
          {{ store.isAddingPlaylist ? 'Lädt…' : 'Hinzufügen' }}
        </button>
      </form>
      <p v-if="store.libraryError" class="text-sm text-red-400">{{ store.libraryError }}</p>
    </div>

    <!-- Profile results (public playlists of a pasted profile) -->
    <div v-if="store.profileResults.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-white">Öffentliche Playlists aus diesem Profil</h2>
        <button
          class="text-xs text-zinc-400 transition hover:text-white"
          @click="store.clearProfileResults()"
        >
          Schließen
        </button>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="playlist in store.profileResults"
          :key="playlist.id"
          class="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
        >
          <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-800">
            <img
              v-if="playlist.imageUrl"
              :src="playlist.imageUrl"
              :alt="playlist.name"
              crossorigin="anonymous"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex h-full items-center justify-center text-4xl text-zinc-600">🎵</div>
          </div>
          <h3 class="mt-3 truncate text-sm font-semibold text-white">{{ playlist.name }}</h3>
          <p class="truncate text-xs text-zinc-400">{{ playlist.owner }}</p>
          <button
            :disabled="store.isInLibrary(playlist.id)"
            class="mt-3 w-full rounded-lg border border-spotify-400/40 px-3 py-1.5 text-xs font-semibold text-spotify-300 transition hover:border-spotify-400 hover:text-spotify-200 disabled:cursor-default disabled:opacity-50"
            @click="addFromProfile(playlist)"
          >
            {{ store.isInLibrary(playlist.id) ? 'Hinzugefügt ✓' : 'Hinzufügen' }}
          </button>
        </article>
      </div>
    </div>

    <!-- Search -->
    <div v-if="store.library.length > 0 || store.playlists.length > 0">
      <input
        v-model="store.searchQuery"
        type="text"
        placeholder="Playlists durchsuchen…"
        class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-spotify-400 focus:ring-1 focus:ring-spotify-400 sm:max-w-sm"
      />
    </div>

    <!-- Library grid -->
    <div class="space-y-3">
      <div
        v-if="store.filteredLibrary.length === 0 && !store.searchQuery"
        class="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-zinc-400"
      >
        Noch keine Playlists. Füge oben einen Spotify-Link ein, um zu starten.
      </div>
      <div
        v-else-if="store.filteredLibrary.length === 0 && store.searchQuery"
        class="py-8 text-center text-zinc-400"
      >
        Keine Playlists für „{{ store.searchQuery }}" gefunden.
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="playlist in store.filteredLibrary"
          :key="playlist.id"
          class="group relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-spotify-400/50 hover:bg-zinc-800/80"
          @click="openEditor(playlist.id)"
        >
          <!-- Remove button -->
          <button
            class="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/80 text-zinc-300 opacity-0 transition hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
            title="Aus Bibliothek entfernen"
            @click.stop="store.removePlaylist(playlist.id)"
          >
            ✕
          </button>

          <!-- Cover -->
          <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-800">
            <img
              v-if="playlist.imageUrl"
              :src="playlist.imageUrl"
              :alt="playlist.name"
              crossorigin="anonymous"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex h-full items-center justify-center text-4xl text-zinc-600">🎵</div>

            <span
              v-if="store.cachedPlaylistIds.has(playlist.id)"
              class="absolute bottom-2 right-2 rounded-full bg-spotify-400/90 px-2 py-0.5 text-[10px] font-bold text-black"
            >
              Offline
            </span>
            <span
              v-if="playlist.degraded"
              class="absolute bottom-2 left-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-black"
              :title="degradedTitle(playlist)"
            >
              Eingeschränkt
            </span>
          </div>

          <!-- Info -->
          <h2 class="mt-3 truncate text-sm font-semibold text-white group-hover:text-spotify-400">
            {{ playlist.name }}
          </h2>
          <p class="truncate text-xs text-zinc-400">
            {{ playlist.owner || 'Unbekannt' }}<template v-if="playlist.trackCount"> · {{ playlist.trackCount }} Songs</template>
          </p>
        </article>
      </div>
    </div>

    <!-- Signed-in: the user's own Spotify playlists -->
    <div v-if="auth.isAuthenticated" class="space-y-3 border-t border-zinc-800 pt-8">
      <h2 class="text-lg font-bold text-white">Meine Playlists</h2>

      <div v-if="store.isLoadingPlaylists" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard v-for="n in 3" :key="n" />
      </div>

      <div
        v-else-if="store.error"
        class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
      >
        {{ store.error }}
      </div>

      <div
        v-else-if="store.filteredPlaylists.length === 0"
        class="py-8 text-center text-zinc-400"
      >
        Keine eigenen Playlists gefunden.
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="playlist in store.filteredPlaylists"
          :key="playlist.id"
          class="group cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-spotify-400/50 hover:bg-zinc-800/80"
          @click="openEditor(playlist.id)"
        >
          <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-800">
            <img
              v-if="playlist.imageUrl"
              :src="playlist.imageUrl"
              :alt="playlist.name"
              crossorigin="anonymous"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex h-full items-center justify-center text-4xl text-zinc-600">🎵</div>

            <span
              v-if="store.cachedPlaylistIds.has(playlist.id)"
              class="absolute bottom-2 right-2 rounded-full bg-spotify-400/90 px-2 py-0.5 text-[10px] font-bold text-black"
            >
              Offline
            </span>
          </div>

          <h3 class="mt-3 truncate text-sm font-semibold text-white group-hover:text-spotify-400">
            {{ playlist.name }}
          </h3>
          <p class="truncate text-xs text-zinc-400">
            {{ playlist.owner }} · {{ playlist.trackCount }} Songs
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
