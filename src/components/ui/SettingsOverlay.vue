<script setup lang="ts">
import { ref } from 'vue';
import SettingsGeneral from '@/components/ui/SettingsGeneral.vue';
import SettingsDeveloper from '@/components/ui/SettingsDeveloper.vue';
import { hasErrors, hasWarnings } from '@/services/devConsole';

type Tab = 'general' | 'developer';

const visible = ref(false);
const activeTab = ref<Tab>('general');

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Allgemein' },
  { id: 'developer', label: 'Entwickler' },
];

function tabClass(id: Tab): string {
  return activeTab.value === id
    ? 'border-spotify-500 text-white'
    : 'border-transparent text-zinc-500 hover:text-zinc-300';
}
</script>

<template>
  <!-- Toggle button – fixed to bottom-right corner -->
  <button
    class="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/90 text-xs font-bold text-zinc-300 shadow-lg ring-1 ring-zinc-700 backdrop-blur transition hover:bg-zinc-700 active:scale-95"
    :title="visible ? 'Einstellungen schließen' : 'Einstellungen'"
    @click="visible = !visible"
  >
    {{ visible ? '✕' : '⚙' }}
  </button>

  <!-- Settings panel -->
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-16 right-4 z-50 flex w-[min(92vw,480px)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
    >
      <!-- Tab bar -->
      <div class="flex border-b border-zinc-800">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-semibold transition"
          :class="tabClass(tab.id)"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <!--
            The error signal lives here rather than on the ⚙ button: a red gear
            is noise for a normal user, but it belongs next to the logs.
          -->
          <span
            v-if="tab.id === 'developer' && (hasErrors || hasWarnings)"
            class="h-1.5 w-1.5 rounded-full"
            :class="hasErrors ? 'bg-red-500' : 'bg-yellow-500'"
          />
        </button>
      </div>

      <SettingsGeneral v-if="activeTab === 'general'" />
      <SettingsDeveloper v-else />
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
