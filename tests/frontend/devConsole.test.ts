import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_ENTRIES,
  clearLogs,
  hasErrors,
  installDevConsole,
  logs,
  uninstallDevConsole,
} from '@/services/devConsole';

// Always restore the real console, otherwise a failure here would garble the
// rest of the Vitest output.
afterEach(() => {
  uninstallDevConsole();
  clearLogs();
});

describe('devConsole', () => {
  it('captures console output into the buffer', () => {
    installDevConsole();
    console.log('hello', 'world');

    expect(logs.value).toHaveLength(1);
    expect(logs.value[0].level).toBe('log');
    expect(logs.value[0].message).toBe('hello world');
  });

  it('records the level and flags errors', () => {
    installDevConsole();
    console.warn('careful');
    expect(hasErrors.value).toBe(false);

    console.error('boom');
    expect(logs.value.map((l) => l.level)).toEqual(['warn', 'error']);
    expect(hasErrors.value).toBe(true);
  });

  it('serializes Errors and objects instead of printing [object Object]', () => {
    installDevConsole();
    console.error(new Error('kaputt'));
    console.log({ a: 1 });

    expect(logs.value[0].message).toContain('Error: kaputt');
    expect(logs.value[1].message).toContain('"a": 1');
  });

  it('caps the buffer at MAX_ENTRIES, dropping the oldest', () => {
    installDevConsole();
    for (let i = 0; i < MAX_ENTRIES + 10; i++) console.log(`entry-${i}`);

    expect(logs.value).toHaveLength(MAX_ENTRIES);
    expect(logs.value[0].message).toBe('entry-10');
    expect(logs.value[logs.value.length - 1].message).toBe(`entry-${MAX_ENTRIES + 9}`);
  });

  it('is idempotent – a second install does not double-record', () => {
    installDevConsole();
    installDevConsole();
    console.log('once');

    expect(logs.value).toHaveLength(1);
  });

  it('restores the native console on uninstall', () => {
    const pristine = console.log;
    installDevConsole();
    expect(console.log).not.toBe(pristine);

    uninstallDevConsole();
    console.log('not captured');

    expect(logs.value).toHaveLength(0);
  });

  it('clears the buffer', () => {
    installDevConsole();
    console.log('a');
    clearLogs();

    expect(logs.value).toHaveLength(0);
  });
});
