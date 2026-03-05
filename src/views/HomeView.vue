<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
</script>

<template>
  <section class="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.2fr_1fr]">
    <div class="space-y-6">
      <p class="inline-flex rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-300">
        Spotify Tier-List PWA
      </p>

      <h1 class="text-4xl font-black leading-tight text-white sm:text-5xl">
        Ranke deine Playlist-Tracks in einer visuellen Tier-List.
      </h1>

      <p class="max-w-xl text-base text-zinc-300 sm:text-lg">
        Verbinde deinen Spotify-Account, ziehe Songs per Drag & Drop in Tiers und arbeite jederzeit offline weiter.
      </p>

      <div class="flex flex-wrap gap-3">
        <BaseButton>Login with Spotify</BaseButton>
        <BaseButton variant="secondary">Demo öffnen</BaseButton>
      </div>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Phase 1 Status</h2>
      <ul class="mt-4 space-y-3 text-sm text-zinc-200">
        <li class="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">Vue 3 + TypeScript Projektgrundlage</li>
        <li class="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">Router-Views für Start, Callback, Dashboard, Editor</li>
        <li class="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">Tailwind Setup und wiederverwendbare UI-Komponenten</li>
      </ul>
    </div>
  </section>
</template>
