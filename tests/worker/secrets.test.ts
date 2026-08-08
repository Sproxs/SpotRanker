// secrets.ts memoizes in module scope with no reset export, so every test
// re-imports a fresh module instance via vi.resetModules() + dynamic import.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch } from '../helpers/fakeFetch';

async function freshSecrets() {
  vi.resetModules();
  return import('../../worker/secrets');
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getSecrets', () => {
  it('offline guarantee: all remote URLs fail → bundled fallback (v61)', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.includes('raw.githubusercontent.com'),
        respond: () => {
          throw new Error('network down');
        },
      },
    ]);

    const { getSecrets } = await freshSecrets();
    const secrets = await getSecrets();

    expect(secrets).toHaveLength(1);
    expect(secrets[0].version).toBe(61);
    expect(secrets[0].cipher.length).toBeGreaterThan(0);
    // all three URLs were attempted
    expect(fetchMock.callsTo('raw.githubusercontent.com')).toHaveLength(3);
  });

  it('non-ok responses are skipped the same as network failures', async () => {
    stubFetch([
      {
        match: (url) => url.includes('raw.githubusercontent.com'),
        respond: () => new Response('nope', { status: 404 }),
      },
    ]);

    const { getSecrets } = await freshSecrets();
    const secrets = await getSecrets();
    expect(secrets.map((s) => s.version)).toEqual([61]);
  });

  it('remote dict merges over the fallback; remote wins on version clash; sorted newest first', async () => {
    stubFetch([
      {
        match: (url) => url.includes('raw.githubusercontent.com'),
        respond: () =>
          jsonResponse({
            '61': [1, 2, 3], // clashes with bundled v61 → remote wins
            '62': [4, 5, 6],
            'not-a-version': [7], // skipped: non-numeric key
            '63': ['x', 'y'], // skipped: not all numbers
          }),
      },
    ]);

    const { getSecrets } = await freshSecrets();
    const secrets = await getSecrets();

    expect(secrets.map((s) => s.version)).toEqual([62, 61]);
    expect(secrets.find((s) => s.version === 61)?.cipher).toEqual([1, 2, 3]);
  });

  it('first URL that parses wins — later URLs are not fetched', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.includes('raw.githubusercontent.com'),
        respond: () => jsonResponse({ '70': [9, 9] }),
      },
    ]);

    const { getSecrets } = await freshSecrets();
    await getSecrets();
    expect(fetchMock.callsTo('raw.githubusercontent.com')).toHaveLength(1);
  });

  it('memoizes per module instance: second call performs no fetch', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.includes('raw.githubusercontent.com'),
        respond: () => jsonResponse({ '70': [9, 9] }),
      },
    ]);

    const { getSecrets } = await freshSecrets();
    const first = await getSecrets();
    const second = await getSecrets();

    expect(second).toBe(first); // same array reference
    expect(fetchMock.callsTo('raw.githubusercontent.com')).toHaveLength(1);
  });
});
