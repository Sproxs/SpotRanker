<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-3xl font-black text-white">Playlist Dashboard</h1>
      <p class="mt-2 text-zinc-300">Hier erscheinen in Phase 3 die Spotify-Playlists inkl. Offline-Status.</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="card in 6"
        :key="card"
        class="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
      >
        <div class="aspect-square w-full rounded-lg bg-zinc-800" />
        <h2 class="mt-3 text-sm font-semibold text-white">Playlist Platzhalter {{ card }}</h2>
        <p class="text-xs text-zinc-400">Noch nicht lokal gespeichert</p>
      </article>
    </div>
  </section>
</template>
