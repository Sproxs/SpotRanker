<script setup lang="ts">
const props = defineProps<{ playlistId: string }>();

const tiers = ['S', 'A', 'B', 'C', 'D'];
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="text-3xl font-black text-white">Tier Editor</h1>
      <p class="mt-1 text-zinc-300">Playlist ID: {{ props.playlistId }}</p>
    </header>

    <div class="space-y-2">
      <div
        v-for="tier in tiers"
        :key="tier"
        class="grid min-h-20 grid-cols-[4rem_1fr] items-stretch overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70"
      >
        <div class="flex items-center justify-center bg-zinc-800 text-lg font-black text-white">
          {{ tier }}
        </div>
        <div class="flex items-center px-3 text-sm text-zinc-400">
          Drop-Zone wird in Phase 4 mit Drag & Drop aktiv.
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-300">
      Unranked Pool (Platzhalter)
    </div>
  </section>
</template>
