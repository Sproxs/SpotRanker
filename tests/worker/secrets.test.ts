// secrets.ts memoizes in module scope with no reset export, so every test
// re-imports a fresh module instance via vi.resetModules() + dynamic import.
//
// REMOTE_URLS is deliberately empty (the former community source is gone), so
// getSecrets must now be a pure, network-free read of the bundled secret. The
// dormant remote-merge path is covered through parseSecretDict directly.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '../helpers/fakeFetch';

async function freshSecrets() {
  vi.resetModules();
  return import('../../worker/secrets');
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getSecrets', () => {
  it('returns the bundled v61 secret without touching the network', async () => {
    // Any fetch at all fails this test: fakeFetch throws on unmatched URLs.
    stubFetch([]);

    const { getSecrets } = await freshSecrets();
    const secrets = await getSecrets();

    expect(secrets).toHaveLength(1);
    expect(secrets[0].version).toBe(61);
    expect(secrets[0].cipher.length).toBeGreaterThan(0);
  });

  it('memoizes per module instance', async () => {
    stubFetch([]);

    const { getSecrets } = await freshSecrets();
    const first = await getSecrets();
    const second = await getSecrets();

    expect(second).toBe(first); // same array reference
  });

  it('a fresh module instance starts from a clean cache', async () => {
    stubFetch([]);
    const a = await (await freshSecrets()).getSecrets();
    stubFetch([]);
    const b = await (await freshSecrets()).getSecrets();

    expect(b).not.toBe(a); // different instances
    expect(b).toEqual(a); // same content
  });
});

describe('parseSecretDict (dormant remote-refresh path)', () => {
  it('parses a well-formed dict', async () => {
    const { parseSecretDict } = await freshSecrets();
    expect(parseSecretDict({ '62': [1, 2, 3], '63': [4, 5] })).toEqual([
      { version: 62, cipher: [1, 2, 3] },
      { version: 63, cipher: [4, 5] },
    ]);
  });

  it('skips non-numeric keys and non-number arrays', async () => {
    const { parseSecretDict } = await freshSecrets();
    expect(
      parseSecretDict({
        '62': [1, 2],
        'not-a-version': [3],
        '64': ['x', 'y'],
        '65': 'not an array',
      }),
    ).toEqual([{ version: 62, cipher: [1, 2] }]);
  });

  it('returns an empty list for non-object input', async () => {
    const { parseSecretDict } = await freshSecrets();
    expect(parseSecretDict(null)).toEqual([]);
    expect(parseSecretDict('nope')).toEqual([]);
    expect(parseSecretDict(undefined)).toEqual([]);
  });
});
