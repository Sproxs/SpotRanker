import { computed, ref } from 'vue';

// ---------------------------------------------------------------------------
// In-app console capture.
//
// The log buffer is application state, not panel state: the settings overlay
// renders its tabs with v-if, so if the patching lived inside the developer
// tab component every tab switch would tear it down and stop collecting.
// Installing once from main.ts also catches errors thrown before the overlay
// mounts, which the previous in-component version missed.
// ---------------------------------------------------------------------------

export type LogLevel = 'log' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: string;
}

/** Ring-buffer cap – oldest entries are dropped beyond this. */
export const MAX_ENTRIES = 100;

const entries = ref<LogEntry[]>([]);

/** Read-only view for the developer tab. */
export const logs = computed(() => entries.value);

export const hasErrors = computed(() => entries.value.some((l) => l.level === 'error'));
export const hasWarnings = computed(() => entries.value.some((l) => l.level === 'warn'));

let nextId = 0;

function format(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function addEntry(level: LogLevel, args: unknown[]): void {
  entries.value.push({
    id: nextId++,
    level,
    message: args.map(format).join(' '),
    timestamp: new Date().toLocaleTimeString(),
  });

  if (entries.value.length > MAX_ENTRIES) {
    entries.value.shift();
  }
}

const originals = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let installed = false;

function onUnhandledError(event: ErrorEvent): void {
  addEntry('error', [`Uncaught ${event.error ?? event.message}`]);
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  addEntry('error', [`Unhandled rejection: ${event.reason}`]);
}

/** Start capturing console output. Idempotent. */
export function installDevConsole(): void {
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

  window.addEventListener('error', onUnhandledError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}

/** Restore the native console. Mainly for tests – the app never uninstalls. */
export function uninstallDevConsole(): void {
  if (!installed) return;
  installed = false;

  console.log = originals.log;
  console.warn = originals.warn;
  console.error = originals.error;

  window.removeEventListener('error', onUnhandledError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
}

export function clearLogs(): void {
  entries.value = [];
}
