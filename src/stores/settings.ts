import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

// ---------------------------------------------------------------------------
// User preferences.
//
// Persisted to localStorage, which is otherwise entirely unused by the app
// (the last keys went away with the OAuth store), so there is nothing to
// collide with.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'spotranker:settings';

/** html2canvas pixel ratio for the PNG export – higher is sharper but larger. */
export type ExportScale = 1 | 2 | 3;

export const EXPORT_SCALES: readonly ExportScale[] = [1, 2, 3];

const DEFAULTS = {
  exportScale: 2 as ExportScale,
};

function isExportScale(value: unknown): value is ExportScale {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Read persisted settings. Anything unexpected – malformed JSON, a non-object,
 * an out-of-range scale written by an older or newer build – falls back to the
 * defaults rather than propagating a broken value into the app.
 */
function loadPersisted(): typeof DEFAULTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULTS };

    const { exportScale } = parsed as Record<string, unknown>;
    return {
      exportScale: isExportScale(exportScale) ? exportScale : DEFAULTS.exportScale,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const useSettingsStore = defineStore('settings', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const initial = loadPersisted();
  const exportScale = ref<ExportScale>(initial.exportScale);

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ exportScale: exportScale.value }));
    } catch (err) {
      // Private mode or a full quota must not break the setting itself.
      console.error('[settings] Einstellungen konnten nicht gespeichert werden:', err);
    }
  }

  watch(exportScale, persist);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function resetToDefaults(): void {
    exportScale.value = DEFAULTS.exportScale;
  }

  return {
    // state
    exportScale,
    // actions
    resetToDefaults,
  };
});
