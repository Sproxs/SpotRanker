<script setup lang="ts">
import { ref } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { usePwaUpdate } from '@/services/pwaUpdate';

const { needRefresh, applyUpdate } = usePwaUpdate();

const dismissed = ref(false);
const applying = ref(false);

async function handleUpdate() {
  applying.value = true;
  try {
    await applyUpdate();
  } catch (err) {
    console.error('[UpdateBanner] Update konnte nicht angewendet werden:', err);
    applying.value = false;
  }
  // On success the page reloads, so `applying` is never reset here.
}

// Dismissing only hides the banner – the new worker keeps waiting and takes
// over on the next cold start.
function handleDismiss() {
  dismissed.value = true;
}
</script>

<template>
  <!--
    Anchored bottom-left: the ⚙ console FAB (bottom-4 right-4) and its panel
    (bottom-16 right-4) both own the right edge. On narrow screens right-20
    keeps the banner clear of the FAB.
  -->
  <Transition name="slide-up">
    <div
      v-if="needRefresh && !dismissed"
      class="fixed bottom-4 left-4 right-20 z-40 rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-xl sm:right-auto sm:w-80"
      role="status"
    >
      <p class="text-sm font-semibold text-white">Neue Version verfügbar</p>
      <p class="mt-1 text-xs text-zinc-400">
        Deine Rankings bleiben erhalten – die App lädt sich einmal neu.
      </p>

      <div class="mt-3 flex items-center gap-2">
        <BaseButton class="!px-3 !py-1.5 !text-xs" :disabled="applying" @click="handleUpdate">
          {{ applying ? 'Aktualisiere…' : 'Jetzt aktualisieren' }}
        </BaseButton>
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          @click="handleDismiss"
        >
          Später
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
