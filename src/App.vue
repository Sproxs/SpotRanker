<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppNavbar from '@/components/ui/AppNavbar.vue';
import ConsoleOverlay from '@/components/ui/ConsoleOverlay.vue';
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(29,185,84,0.18),transparent_40%),radial-gradient(circle_at_90%_0%,rgba(16,185,129,0.16),transparent_35%)]" />

    <div class="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      <AppNavbar />
      <main class="flex-1 py-8">
        <RouterView />
      </main>
    </div>
    <ConsoleOverlay />
  </div>
</template>
