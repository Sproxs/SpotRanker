// token.ts caches the minted token in module scope; tests isolate via
// vi.resetModules() + dynamic import (which also gives each test a fresh
// secrets.ts, whose own module cache would otherwise leak across tests).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, tokenPipelineRoutes } from '../helpers/fakeFetch';

async function freshToken() {
  vi.resetModules();
  return import('../../worker/token');
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getToken', () => {
  it('mints a token through the TOTP pipeline and caches it (2nd call = 0 fetches)', async () => {
    const fetchMock = stubFetch(tokenPipelineRoutes('token-1'));

    const { getToken } = await freshToken();
    await expect(getToken()).resolves.toBe('token-1');

    const callsAfterFirst = fetchMock.calls.length;
    await expect(getToken()).resolves.toBe('token-1');
    expect(fetchMock.calls.length).toBe(callsAfterFirst); // fully served from cache
  });

  it('invalidateToken forces a re-mint on the next call', async () => {
    let minted = 0;
    stubFetch([
      {
        match: (url) => url.startsWith('https://open.spotify.com/api/token'),
        respond: () => {
          minted += 1;
          return jsonResponse({
            accessToken: `token-${minted}`,
            accessTokenExpirationTimestampMs: Date.now() + 3_600_000,
          });
        },
      },
      ...tokenPipelineRoutes(),
    ]);

    const { getToken, invalidateToken } = await freshToken();
    await expect(getToken()).resolves.toBe('token-1');
    invalidateToken();
    await expect(getToken()).resolves.toBe('token-2');
    expect(minted).toBe(2);
  });

  it('token request carries the TOTP query params and web-player headers', async () => {
    const fetchMock = stubFetch(tokenPipelineRoutes());

    const { getToken } = await freshToken();
    await getToken();

    const tokenCall = fetchMock.callsTo('/api/token')[0];
    const url = new URL(tokenCall.url);
    expect(url.searchParams.get('productType')).toBe('web-player');
    expect(url.searchParams.get('reason')).toBe('transport');
    expect(url.searchParams.get('totp')).toMatch(/^\d{6}$/);
    expect(url.searchParams.get('totp')).toBe(url.searchParams.get('totpServer'));
    expect(url.searchParams.get('totpVer')).toBe('61'); // bundled fallback secret
    const headers = tokenCall.init?.headers as Record<string, string>;
    expect(headers['App-Platform']).toBe('WebPlayer');
    expect(headers.Origin).toBe('https://open.spotify.com');
  });

  it('falls back to reason=init when transport returns an unusable response', async () => {
    const reasons: string[] = [];
    stubFetch([
      {
        match: (url) => url.startsWith('https://open.spotify.com/api/token'),
        respond: (url) => {
          const reason = new URL(url).searchParams.get('reason') ?? '';
          reasons.push(reason);
          if (reason === 'transport') return jsonResponse({}); // no accessToken
          return jsonResponse({
            accessToken: 'via-init',
            accessTokenExpirationTimestampMs: Date.now() + 3_600_000,
          });
        },
      },
      ...tokenPipelineRoutes(),
    ]);

    const { getToken } = await freshToken();
    await expect(getToken()).resolves.toBe('via-init');
    expect(reasons).toEqual(['transport', 'init']);
  });

  it('exhausting all secrets × reasons throws TokenError with the last error message', async () => {
    stubFetch([
      {
        match: (url) => url.startsWith('https://open.spotify.com/api/token'),
        respond: () => {
          throw new Error('endpoint exploded');
        },
      },
      ...tokenPipelineRoutes(),
    ]);

    const { getToken, TokenError } = await freshToken();
    const err = await getToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TokenError);
    expect((err as Error).message).toContain('Anonymes Token konnte nicht erstellt werden');
    expect((err as Error).message).toContain('endpoint exploded');
  });
});

describe('server time fallback', () => {
  it('a failing HEAD to open.spotify.com does not break minting (falls back to Date.now)', async () => {
    stubFetch([
      {
        match: (url, init) => url === 'https://open.spotify.com/' && init?.method === 'HEAD',
        respond: () => {
          throw new Error('HEAD blocked');
        },
      },
      ...tokenPipelineRoutes('local-time-token'),
    ]);

    const { getToken } = await freshToken();
    await expect(getToken()).resolves.toBe('local-time-token');
  });
});
