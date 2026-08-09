<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();

const linkInput = ref('');

function startWithLink() {
  const value = linkInput.value.trim();
  router.push({ name: 'dashboard', query: value ? { add: value } : undefined });
}

function goToDashboard() {
  router.push({ name: 'dashboard' });
}
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
        Füge einfach einen öffentlichen Spotify-Playlist-Link ein – ganz ohne Login.
        Ziehe Songs per Drag &amp; Drop in Tiers und arbeite jederzeit offline weiter.
      </p>

      <!-- Primary: no-login flow -->
      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="startWithLink">
        <input
          v-model="linkInput"
          type="text"
          inputmode="url"
          placeholder="Spotify-Playlist-Link einfügen…"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-spotify-400 focus:ring-1 focus:ring-spotify-400"
        />
        <BaseButton type="submit" class="shrink-0">Los geht's</BaseButton>
      </form>

      <div class="flex flex-wrap items-center gap-3 text-sm">
        <button
          class="rounded-lg border border-zinc-700 px-3 py-2 font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          @click="goToDashboard"
        >
          Zum Dashboard
        </button>
      </div>

      <p class="max-w-xl text-xs text-zinc-500">
        Kein Account, kein Login, keine Berechtigungen – es funktioniert mit jeder
        öffentlichen Playlist.
      </p>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">So funktioniert's</h2>
      <ol class="mt-4 space-y-3 text-sm text-zinc-200">
        <li class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-spotify-500 text-xs font-bold text-zinc-950">1</span>
          Öffentlichen Playlist- oder Profil-Link einfügen — kein Login nötig.
        </li>
        <li class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-spotify-500 text-xs font-bold text-zinc-950">2</span>
          Playlist öffnen — Tracks werden lokal zwischengespeichert.
        </li>
        <li class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-spotify-500 text-xs font-bold text-zinc-950">3</span>
          Drag &amp; Drop in S / A / B / C / D — auch offline.
        </li>
      </ol>
    </div>
  </section>
</template>
