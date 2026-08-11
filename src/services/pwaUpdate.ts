import { computed, ref } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';

// ---------------------------------------------------------------------------
// Service-Worker update controller.
//
// This is deliberately a module singleton, NOT a composable: useRegisterSW()
// registers the service worker as a side effect, so calling it from two
// components would register twice. The update banner and the ⚙ overlay button
// share this one instance.
//
// Dev note: under `npm run dev`, `virtual:pwa-register/vue` resolves to a no-op
// stub – onRegisteredSW never fires and needRefresh stays false, so the button
// reports 'unsupported'. Exercise this against `npm run build && npm run
// preview`, which serves a real service worker.
// ---------------------------------------------------------------------------

export type UpdateCheckState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'offline'
  | 'unsupported'
  | 'error';

/** Background poll while the tab stays alive. */
const AUTO_CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Upper bound on waiting for a new worker to finish installing. */
const INSTALL_TIMEOUT_MS = 15_000;
/** How long a transient result ("Up to date", "Offline", …) stays on the button. */
const RESULT_RESET_MS = 4_000;
/** Safety net in case the SW never sends its `controlling` event. */
const RELOAD_FALLBACK_MS = 3_000;

const checkState = ref<UpdateCheckState>('idle');

let registration: ServiceWorkerRegistration | undefined;
let inFlight: Promise<UpdateCheckState> | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_swUrl, swRegistration) {
    registration = swRegistration;
    if (!swRegistration) return;

    // An installed PWA typically goes to the background instead of being
    // closed, so it may never cold-start and never re-fetch sw.js on its own.
    // These two triggers are what actually make updates arrive.
    setInterval(() => {
      void checkForUpdate({ silent: true });
    }, AUTO_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate({ silent: true });
      }
    });
  },
  onRegisterError(err) {
    console.error('[pwaUpdate] Service Worker konnte nicht registriert werden:', err);
    checkState.value = 'error';
  },
});

function setState(state: UpdateCheckState): void {
  if (resetTimer !== null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  checkState.value = state;

  // 'available' is the only sticky result – it stays until the user acts on it.
  if (state === 'idle' || state === 'checking' || state === 'available') return;

  resetTimer = setTimeout(() => {
    resetTimer = null;
    checkState.value = 'idle';
  }, RESULT_RESET_MS);
}

/**
 * Background checks must not make the button flicker through
 * "Checking…" → "Up to date" while nobody asked for it, so they only surface a
 * result when an update is actually waiting.
 */
function settle(state: UpdateCheckState, silent: boolean): UpdateCheckState {
  if (!silent || state === 'available') setState(state);
  return state;
}

/**
 * `registration.update()` resolves once the new sw.js has been fetched and the
 * install has *started* – not when it has finished. Without this wait,
 * `registration.waiting` is still empty right after and a real update would be
 * reported as "Up to date".
 */
function waitForInstall(reg: ServiceWorkerRegistration): Promise<void> {
  const installing = reg.installing;
  if (!installing) return Promise.resolve();

  return new Promise<void>((resolve) => {
    function finish(): void {
      clearTimeout(timer);
      installing!.removeEventListener('statechange', onStateChange);
      resolve();
    }

    function onStateChange(): void {
      const state = installing!.state;
      if (state === 'installed' || state === 'activated' || state === 'redundant') finish();
    }

    const timer = setTimeout(finish, INSTALL_TIMEOUT_MS);
    installing.addEventListener('statechange', onStateChange);
  });
}

async function runCheck(silent: boolean): Promise<UpdateCheckState> {
  if (!registration) return settle('unsupported', silent);
  if (!navigator.onLine) return settle('offline', silent);

  if (!silent) setState('checking');

  try {
    await registration.update();
    await waitForInstall(registration);
    const available = Boolean(registration.waiting) || needRefresh.value;
    return settle(available ? 'available' : 'up-to-date', silent);
  } catch (err) {
    console.error('[pwaUpdate] Update-Prüfung fehlgeschlagen:', err);
    return settle('error', silent);
  }
}

/** Ask the browser to re-fetch sw.js. Concurrent calls share one check. */
export function checkForUpdate(options: { silent?: boolean } = {}): Promise<UpdateCheckState> {
  if (inFlight) return inFlight;

  inFlight = runCheck(options.silent ?? false).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Hand control to the waiting worker. vite-plugin-pwa's prompt path already
 * attaches a `controlling` listener that reloads the page, so the timer below
 * only covers the case where that event never arrives.
 */
export async function applyUpdate(): Promise<void> {
  window.setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
  await updateServiceWorker(true);
}

export function usePwaUpdate() {
  return {
    /** True once a new worker is waiting – drives the update banner. */
    needRefresh,
    offlineReady,
    checkState: computed(() => checkState.value),
    checkForUpdate,
    applyUpdate,
  };
}
