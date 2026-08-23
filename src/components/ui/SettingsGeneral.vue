<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { usePlaylistStore } from '@/stores/playlists';
import { useSettingsStore, EXPORT_SCALES, type ExportScale } from '@/stores/settings';
import { usePwaUpdate, type UpdateCheckState } from '@/services/pwaUpdate';
import { formatBuildInfo } from '@/config/buildInfo';
import { clearTrackCache, clearAllCaches, getStorageEstimate } from '@/services/offlineDb';

const store = usePlaylistStore();
const settings = useSettingsStore();

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------
const { checkState, checkForUpdate, applyUpdate } = usePwaUpdate();

const updateLabels: Record<UpdateCheckState, string> = {
  idle: 'Nach Updates suchen',
  checking: 'Suche…',
  available: 'Update bereit – jetzt neu laden',
  'up-to-date': 'Aktuell',
  offline: 'Offline',
  unsupported: 'Im Dev-Modus nicht verfügbar',
  error: 'Prüfung fehlgeschlagen',
};

const updateLabel = computed(() => updateLabels[checkState.value]);

const updateClass = computed(() => {
  switch (checkState.value) {
    case 'available':
      return 'border-spotify-500/50 bg-spotify-500/10 text-spotify-400';
    case 'up-to-date':
      return 'border-zinc-800 bg-zinc-900 text-green-400';
    case 'error':
      return 'border-red-800/60 bg-red-950/40 text-red-300';
    case 'checking':
    case 'offline':
    case 'unsupported':
      return 'border-zinc-800 bg-zinc-900 text-zinc-500';
    default:
      return 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:text-white';
  }
});

function handleUpdateClick() {
  if (checkState.value === 'checking') return;
  if (checkState.value === 'available') {
    void applyUpdate();
    return;
  }
  void checkForUpdate();
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const storageUsage = ref<string | null>(null);

async function refreshStorageUsage() {
  const estimate = await getStorageEstimate();
  storageUsage.value = estimate ? `${(estimate.usage / 1024 / 1024).toFixed(1)} MB belegt` : null;
}

onMounted(refreshStorageUsage);

/**
 * Two-step confirmation. There is no dialog component in this project, so a
 * destructive button arms itself on the first click and only fires on the
 * second one within the timeout.
 */
const armed = ref<'tracks' | 'all' | null>(null);
let armTimer: ReturnType<typeof setTimeout> | null = null;
const busy = ref(false);

function arm(action: 'tracks' | 'all') {
  armed.value = action;
  if (armTimer !== null) clearTimeout(armTimer);
  armTimer = setTimeout(() => {
    armed.value = null;
    armTimer = null;
  }, 4000);
}

function disarm() {
  if (armTimer !== null) clearTimeout(armTimer);
  armTimer = null;
  armed.value = null;
}

onUnmounted(() => {
  if (armTimer !== null) clearTimeout(armTimer);
});

async function handleClearTracks() {
  if (armed.value !== 'tracks') return arm('tracks');

  disarm();
  busy.value = true;
  try {
    await clearTrackCache();
    await store.initLibrary();
    await refreshStorageUsage();
  } catch (err) {
    console.error('[Settings] Offline-Songs konnten nicht gelöscht werden:', err);
  } finally {
    busy.value = false;
  }
}

async function handleClearAll() {
  if (armed.value !== 'all') return arm('all');

  disarm();
  busy.value = true;
  try {
    await clearAllCaches();
    await store.initLibrary();
    await refreshStorageUsage();
  } catch (err) {
    console.error('[Settings] Daten konnten nicht gelöscht werden:', err);
  } finally {
    busy.value = false;
  }
}

// ---------------------------------------------------------------------------
// Image export
// ---------------------------------------------------------------------------
function setScale(scale: ExportScale) {
  settings.exportScale = scale;
}
</script>

<template>
  <div class="max-h-[26rem] space-y-4 overflow-y-auto p-4">
    <!-- Updates ------------------------------------------------------------->
    <section class="space-y-2">
      <h3 class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">App-Update</h3>

      <button
        class="w-full rounded-lg border px-3 py-2 text-xs font-semibold transition"
        :class="updateClass"
        @click="handleUpdateClick"
      >
        {{ updateLabel }}
      </button>

      <p class="text-[10px] text-zinc-600">
        Version {{ formatBuildInfo() }}
      </p>
      <p class="text-[10px] text-zinc-600">
        Updates werden automatisch im Hintergrund geprüft.
      </p>
    </section>

    <!-- Storage ------------------------------------------------------------->
    <section class="space-y-2">
      <h3 class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Speicher &amp; Offline-Daten
      </h3>

      <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
        <p>{{ store.library.length }} Playlists in der Bibliothek</p>
        <p class="text-zinc-500">{{ store.cachedPlaylistIds.size }} davon offline verfügbar</p>
        <p v-if="storageUsage" class="text-zinc-500">ca. {{ storageUsage }}</p>
      </div>

      <button
        class="w-full rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
        :class="armed === 'tracks'
          ? 'border-yellow-700/60 bg-yellow-950/40 text-yellow-300'
          : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:text-white'"
        :disabled="busy"
        @click="handleClearTracks"
      >
        {{ armed === 'tracks' ? 'Wirklich löschen?' : 'Offline-Songs löschen' }}
      </button>
      <p class="text-[10px] text-zinc-600">
        Gibt Speicher frei. Deine Tier-Lists und die Bibliothek bleiben erhalten –
        die Songs werden beim nächsten Öffnen neu geladen.
      </p>

      <button
        class="mt-1 w-full rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
        :class="armed === 'all'
          ? 'border-red-600 bg-red-950/60 text-red-200'
          : 'border-red-900/60 bg-red-950/20 text-red-400 hover:border-red-700 hover:text-red-300'"
        :disabled="busy"
        @click="handleClearAll"
      >
        {{ armed === 'all' ? 'Wirklich alles löschen?' : 'Alle lokalen Daten löschen' }}
      </button>
      <p class="text-[10px] text-zinc-600">
        Löscht <span class="text-red-400">alle Tier-Lists</span> und die gesamte Bibliothek.
        Das lässt sich nicht rückgängig machen.
      </p>
    </section>

    <!-- Image export -------------------------------------------------------->
    <section class="space-y-2">
      <h3 class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Bild-Export
      </h3>

      <div class="flex gap-2">
        <button
          v-for="scale in EXPORT_SCALES"
          :key="scale"
          class="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition"
          :class="settings.exportScale === scale
            ? 'border-spotify-500 bg-spotify-500/10 text-spotify-400'
            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white'"
          @click="setScale(scale)"
        >
          {{ scale }}×
        </button>
      </div>
      <p class="text-[10px] text-zinc-600">
        Auflösung für „Save as Image" und „Share". Höher = schärfer, aber größere Datei.
      </p>
    </section>
  </div>
</template>
