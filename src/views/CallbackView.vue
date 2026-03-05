<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const auth = useAuthStore();
const router = useRouter();
const status = ref<'loading' | 'error'>('loading');

onMounted(async () => {
  const success = await auth.handleCallback(window.location.href);
  if (success) {
    router.replace('/dashboard');
  } else {
    status.value = 'error';
  }
});

function retryLogin() {
  auth.login();
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
    <!-- Loading state -->
    <template v-if="status === 'loading' && !auth.error">
      <BaseSpinner />
      <h1 class="text-xl font-bold text-white">Spotify-Login wird verarbeitet…</h1>
      <p class="text-sm text-zinc-400">Token-Austausch läuft, bitte kurz warten.</p>
    </template>

    <!-- Error state -->
    <template v-else>
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/60 text-red-400">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </div>
      <h1 class="text-xl font-bold text-white">Login fehlgeschlagen</h1>
      <p class="text-sm text-red-300">{{ auth.error }}</p>
      <div class="flex gap-3 pt-2">
        <BaseButton @click="retryLogin">Erneut versuchen</BaseButton>
        <BaseButton variant="secondary" @click="router.push('/')">Zurück</BaseButton>
      </div>
    </template>
  </section>
</template>
