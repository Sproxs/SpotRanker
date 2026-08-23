import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '@/stores/settings';

const STORAGE_KEY = 'spotranker:settings';

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('defaults to 2x export scale when nothing is persisted', () => {
    expect(useSettingsStore().exportScale).toBe(2);
  });

  it('restores a persisted value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ exportScale: 3 }));
    expect(useSettingsStore().exportScale).toBe(3);
  });

  it('writes changes back to localStorage', async () => {
    const settings = useSettingsStore();
    settings.exportScale = 1;

    // The watcher flushes on the next microtask tick.
    await Promise.resolve();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ exportScale: 1 });
  });

  // A broken or foreign value must not take the app down – it falls back to the
  // default instead.
  it.each([
    ['malformed JSON', '{not json'],
    ['a non-object', '"hello"'],
    ['null', 'null'],
    ['an out-of-range scale', JSON.stringify({ exportScale: 7 })],
    ['a wrongly typed scale', JSON.stringify({ exportScale: '2' })],
    ['an unrelated shape', JSON.stringify({ somethingElse: true })],
  ])('falls back to the default for %s', (_label, stored) => {
    localStorage.setItem(STORAGE_KEY, stored);
    expect(useSettingsStore().exportScale).toBe(2);
  });

  it('resets to defaults', async () => {
    const settings = useSettingsStore();
    settings.exportScale = 3;
    // Flush in between: a same-tick 2 → 3 → 2 round-trip is a net no-op that
    // Vue's watcher rightly skips, which is not what this test is about.
    await Promise.resolve();

    settings.resetToDefaults();
    await Promise.resolve();

    expect(settings.exportScale).toBe(2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ exportScale: 2 });
  });
});
