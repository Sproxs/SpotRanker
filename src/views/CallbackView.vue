<script setup lang="ts">
import BaseSpinner from '@/components/ui/BaseSpinner.vue';
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
    <BaseSpinner />
    <h1 class="text-xl font-bold text-white">Spotify Callback wird verarbeitet</h1>
    <p class="text-sm text-zinc-300">In Phase 2 wird hier der PKCE Token-Tausch implementiert.</p>
  </section>
</template>
