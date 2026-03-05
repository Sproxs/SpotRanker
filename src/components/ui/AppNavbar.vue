<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import BaseButton from '@/components/ui/BaseButton.vue';

const auth = useAuthStore();
</script>

<template>
  <header class="sticky top-0 z-20 mt-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/60 px-4 py-3 backdrop-blur-xl">
    <div class="flex items-center justify-between">
      <RouterLink to="/" class="text-lg font-bold tracking-tight text-white">
        Spot<span class="text-spotify-400">Ranker</span>
      </RouterLink>

      <nav class="flex items-center gap-2 text-sm">
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/dashboard" class="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white">
            Dashboard
          </RouterLink>
          <button
            class="rounded-lg px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-red-400"
            @click="auth.logout()"
          >
            Logout
          </button>
        </template>
        <template v-else>
          <BaseButton class="!px-3 !py-1.5 !text-xs" @click="auth.login()">Login</BaseButton>
        </template>
      </nav>
    </div>
  </header>
</template>
