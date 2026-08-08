// Minimal stand-ins for the workerd runtime pieces the Worker touches:
// `caches.default` (worker/cache.ts) and the ExecutionContext passed to fetch().
// An in-memory cache is MORE assertable than the real edge cache: tests can
// inspect stored keys and await the waitUntil'd put deterministically.

import { vi } from 'vitest';

export class MemoryCache {
  store = new Map<string, Response>();

  async match(request: Request): Promise<Response | undefined> {
    const hit = this.store.get(request.url);
    return hit?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.store.set(request.url, response.clone());
  }
}

export interface FakeCtx extends ExecutionContext {
  /** Promises handed to waitUntil, so tests can await pending cache puts. */
  pending: Promise<unknown>[];
  /** Await everything passed to waitUntil (e.g. the async cache.put). */
  settle(): Promise<void>;
}

export function makeCtx(): FakeCtx {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
    passThroughOnException() {},
    async settle() {
      await Promise.all(pending);
    },
    props: undefined,
  } as unknown as FakeCtx;
}

/** Stub the global `caches` with a fresh MemoryCache; returns it for asserts. */
export function installCaches(): MemoryCache {
  const memory = new MemoryCache();
  vi.stubGlobal('caches', { default: memory });
  return memory;
}
