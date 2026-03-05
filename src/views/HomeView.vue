<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import BaseButton from '@/components/ui/BaseButton.vue';

const auth = useAuthStore();
const router = useRouter();

async function handleLogin() {
  await auth.login();
}

function goToDashboard() {
  router.push('/dashboard');
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
        Verbinde deinen Spotify-Account, ziehe Songs per Drag & Drop in Tiers und arbeite jederzeit offline weiter.
      </p>

      <div class="flex flex-wrap gap-3">
        <BaseButton v-if="!auth.isAuthenticated" @click="handleLogin">
          <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          Login with Spotify
        </BaseButton>
        <BaseButton v-else @click="goToDashboard">Zum Dashboard</BaseButton>
        <BaseButton variant="secondary" @click="router.push('/editor/demo')">Demo öffnen</BaseButton>
      </div>

      <p v-if="auth.error" class="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
        {{ auth.error }}
      </p>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">So funktioniert's</h2>
      <ol class="mt-4 space-y-3 text-sm text-zinc-200">
        <li class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-spotify-500 text-xs font-bold text-zinc-950">1</span>
          Mit Spotify einloggen (sicherer PKCE-Flow, kein Backend).
        </li>
        <li class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-spotify-500 text-xs font-bold text-zinc-950">2</span>
          Playlist auswählen — Tracks werden lokal zwischengespeichert.
        </li>
        <li class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-spotify-500 text-xs font-bold text-zinc-950">3</span>
          Drag &amp; Drop in S / A / B / C / D — auch offline.
        </li>
      </ol>
    </div>
  </section>
</template>
