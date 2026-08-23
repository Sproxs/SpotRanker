<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { logs, clearLogs, MAX_ENTRIES, type LogLevel } from '@/services/devConsole';

const levelClass: Record<LogLevel, string> = {
  log: 'text-zinc-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const levelBadge: Record<LogLevel, string> = {
  log: 'bg-zinc-700 text-zinc-200',
  warn: 'bg-yellow-900/60 text-yellow-300',
  error: 'bg-red-900/60 text-red-300',
};

// Read-only technical readout. Sampled on mount rather than made reactive –
// this is a debug snapshot, not a live dashboard.
const swStatus = ref('unknown');
const online = ref(true);

onMounted(async () => {
  online.value = navigator.onLine;

  if (!('serviceWorker' in navigator)) {
    swStatus.value = 'unsupported';
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    swStatus.value = 'not registered';
    return;
  }
  const parts = [
    registration.active ? 'active' : null,
    registration.waiting ? 'waiting' : null,
    registration.installing ? 'installing' : null,
    navigator.serviceWorker.controller ? 'controlling' : 'uncontrolled',
  ].filter(Boolean);
  swStatus.value = parts.join(', ');
});

const counts = computed(() => ({
  total: logs.value.length,
  errors: logs.value.filter((l) => l.level === 'error').length,
  warnings: logs.value.filter((l) => l.level === 'warn').length,
}));
</script>

<template>
  <div class="flex flex-col">
    <!-- Toolbar -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-1.5">
      <span class="font-mono text-[10px] text-zinc-600">
        {{ counts.total }}/{{ MAX_ENTRIES }} entries · {{ counts.errors }} err ·
        {{ counts.warnings }} warn
      </span>
      <button
        class="rounded px-2 py-0.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        @click="clearLogs"
      >
        Clear
      </button>
    </div>

    <!-- Log entries -->
    <div class="max-h-72 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
      <div v-if="logs.length === 0" class="py-4 text-center text-zinc-600">
        No console output yet
      </div>
      <div
        v-for="entry in logs"
        :key="entry.id"
        class="mb-1 flex items-start gap-2 rounded-lg px-2 py-1"
        :class="entry.level === 'error' ? 'bg-red-950/30' : entry.level === 'warn' ? 'bg-yellow-950/30' : 'bg-zinc-900/50'"
      >
        <span
          class="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase"
          :class="levelBadge[entry.level]"
        >
          {{ entry.level }}
        </span>
        <span class="min-w-0 break-all" :class="levelClass[entry.level]">{{ entry.message }}</span>
        <span class="ml-auto shrink-0 text-zinc-600">{{ entry.timestamp }}</span>
      </div>
    </div>

    <!-- Technical readout -->
    <div class="border-t border-zinc-800 px-4 py-1.5 font-mono text-[10px] text-zinc-600">
      SW: {{ swStatus }} · network: {{ online ? 'online' : 'offline' }}
    </div>
  </div>
</template>
