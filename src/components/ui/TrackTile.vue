<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SpotifyTrack } from '@/types/spotify';

const props = defineProps<{ track: SpotifyTrack }>();

// A cover URL can be present but unfetchable (expired CDN link, 403). Without
// this the browser renders a broken-image icon instead of the placeholder,
// because the template only ever checked whether the URL is null.
const imageFailed = ref(false);
watch(
  () => props.track.albumCoverUrl,
  () => {
    imageFailed.value = false;
  },
);
</script>

<template>
  <div class="relative aspect-square w-full bg-zinc-800">
    <img
      v-if="track.albumCoverUrl && !imageFailed"
      :src="track.albumCoverUrl"
      :alt="track.name"
      crossorigin="anonymous"
      class="pointer-events-none h-full w-full object-cover"
      loading="lazy"
      @error="imageFailed = true"
    />
    <div v-else class="flex h-full items-center justify-center text-xl text-zinc-600">🎵</div>
  </div>
  <div class="p-1">
    <p class="truncate text-[10px] font-semibold text-white">{{ track.name }}</p>
    <p class="truncate text-[9px] text-zinc-400">{{ track.artist }}</p>
  </div>
</template>
