<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

type LogLevel = 'log' | 'warn' | 'error';

interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: string;
}

const visible = ref(false);
const logs = ref<LogEntry[]>([]);
let nextId = 0;

const MAX_ENTRIES = 100;

function addEntry(level: LogLevel, args: unknown[]) {
  const message = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? '\n' + a.stack : ''}`;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');

  logs.value.push({
    id: nextId++,
    level,
    message,
    timestamp: new Date().toLocaleTimeString(),
  });

  if (logs.value.length > MAX_ENTRIES) {
    logs.value.shift();
  }
}

const originals = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// Prevent multiple component instances from wrapping the console more than once.
let installed = false;

function install() {
  if (installed) return;
  installed = true;
  console.log = (...args: unknown[]) => {
    originals.log(...args);
    addEntry('log', args);
  };
  console.warn = (...args: unknown[]) => {
    originals.warn(...args);
    addEntry('warn', args);
  };
  console.error = (...args: unknown[]) => {
    originals.error(...args);
    addEntry('error', args);
  };
}

function uninstall() {
  if (!installed) return;
  installed = false;
  console.log = originals.log;
  console.warn = originals.warn;
  console.error = originals.error;
}

function onUnhandledError(event: ErrorEvent) {
  addEntry('error', [`Uncaught ${event.error ?? event.message}`]);
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
  addEntry('error', [`Unhandled rejection: ${event.reason}`]);
}

onMounted(() => {
  install();
  window.addEventListener('error', onUnhandledError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
});

onUnmounted(() => {
  uninstall();
  window.removeEventListener('error', onUnhandledError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
});

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
</script>

<template>
  <!-- Toggle button – fixed to bottom-right corner -->
  <button
    class="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/90 text-xs font-bold shadow-lg ring-1 ring-zinc-700 backdrop-blur transition hover:bg-zinc-700 active:scale-95"
    :class="logs.some((l) => l.level === 'error') ? 'text-red-400 ring-red-700' : logs.some((l) => l.level === 'warn') ? 'text-yellow-400 ring-yellow-700' : 'text-zinc-300'"
    :title="visible ? 'Hide console' : 'Show console'"
    @click="visible = !visible"
  >
    {{ visible ? '✕' : '⚙' }}
  </button>

  <!-- Log panel -->
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-16 right-4 z-50 flex w-[min(92vw,480px)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span class="text-xs font-semibold uppercase tracking-widest text-zinc-400">Console</span>
        <button
          class="rounded px-2 py-0.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          @click="logs = []"
        >
          Clear
        </button>
      </div>

      <!-- Log entries -->
      <div class="max-h-72 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
        <div v-if="logs.length === 0" class="py-4 text-center text-zinc-600">No console output yet</div>
        <div
          v-for="entry in logs"
          :key="entry.id"
          class="mb-1 flex items-start gap-2 rounded-lg px-2 py-1"
          :class="entry.level === 'error' ? 'bg-red-950/30' : entry.level === 'warn' ? 'bg-yellow-950/30' : 'bg-zinc-900/50'"
        >
          <span class="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase" :class="levelBadge[entry.level]">
            {{ entry.level }}
          </span>
          <span class="min-w-0 break-all" :class="levelClass[entry.level]">{{ entry.message }}</span>
          <span class="ml-auto shrink-0 text-zinc-600">{{ entry.timestamp }}</span>
        </div>
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
