// fetch-level tests for worker/providers/apiV1.ts. Each test re-imports the
// module tree (vi.resetModules) so token.ts/secrets.ts module caches start
// clean, and stubs the token pipeline so only the v1 routes vary.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchRoute } from '../helpers/fakeFetch';
import { jsonResponse, stubFetch, tokenPipelineRoutes } from '../helpers/fakeFetch';
import {
  PLAYLIST_ID,
  V1_PLAYLIST_META,
  V1_TRACKS_NEXT_UNDEFINED,
  V1_TRACKS_PAGE1,
  V1_TRACKS_PAGE2,
  V1_USER_PLAYLISTS,
} from '../fixtures/v1Responses';

async function freshApiV1() {
  vi.resetModules();
  return import('../../worker/providers/apiV1');
}

function v1Routes(routes: FetchRoute[]) {
  return stubFetch([...routes, ...tokenPipelineRoutes()]);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPlaylistV1', () => {
  it('happy path: metadata + 2 track pages, null tracks skipped', async () => {
    const fetchMock = v1Routes([
      {
        match: (url) => url.includes(`/v1/playlists/${PLAYLIST_ID}?`),
        respond: () => jsonResponse(V1_PLAYLIST_META),
      },
      {
        match: (url) => url.includes('/tracks?') && url.includes('offset=0'),
        respond: () => jsonResponse(V1_TRACKS_PAGE1),
      },
      {
        match: (url) => url.includes('/tracks?') && url.includes('offset=100'),
        respond: () => jsonResponse(V1_TRACKS_PAGE2),
      },
    ]);

    const { fetchPlaylistV1 } = await freshApiV1();
    const { playlist, tracks } = await fetchPlaylistV1(PLAYLIST_ID);

    expect(playlist).toMatchObject({ id: PLAYLIST_ID, name: 'Fixture Hits', trackCount: 3 });
    // page1 has 2 items but one is track:null → skipped; page2 adds 1
    expect(tracks.map((t) => t.name)).toEqual(['Alpha', 'Beta']);
    expect(tracks[0].artist).toBe('Artist A, Artist B');
    expect(fetchMock.callsTo('/tracks?')).toHaveLength(2);
    // Bearer header present on v1 calls
    const headers = fetchMock.callsTo('/v1/playlists/')[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer /);
  });

  it('404 → NotFoundError', async () => {
    v1Routes([
      {
        match: (url) => url.includes('/v1/playlists/'),
        respond: () => jsonResponse({ error: 'nope' }, 404),
      },
    ]);

    const { fetchPlaylistV1, NotFoundError } = await freshApiV1();
    await expect(fetchPlaylistV1('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('other non-ok status → ProviderError with status in message', async () => {
    v1Routes([
      {
        match: (url) => url.includes('/v1/playlists/'),
        respond: () => jsonResponse({}, 500),
      },
    ]);

    const { fetchPlaylistV1, ProviderError } = await freshApiV1();
    const err = await fetchPlaylistV1('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as Error).message).toContain('500');
  });

  it('401 → invalidates the token and retries exactly once', async () => {
    let v1Calls = 0;
    const fetchMock = v1Routes([
      {
        match: (url) => url.includes(`/v1/playlists/${PLAYLIST_ID}?`),
        respond: () => {
          v1Calls += 1;
          if (v1Calls === 1) return jsonResponse({}, 401);
          return jsonResponse({ ...V1_PLAYLIST_META, tracks: { total: 0 } });
        },
      },
      {
        match: (url) => url.includes('/tracks?'),
        respond: () => jsonResponse({ items: [], next: null }),
      },
    ]);

    const { fetchPlaylistV1 } = await freshApiV1();
    const { playlist } = await fetchPlaylistV1(PLAYLIST_ID);

    expect(playlist.name).toBe('Fixture Hits');
    expect(v1Calls).toBe(2); // exactly one retry
    // the retry minted a fresh token (2 token-endpoint calls total)
    expect(fetchMock.callsTo('/api/token')).toHaveLength(2);
  });

  it('persistent 401 → ProviderError after the single retry (no infinite retry)', async () => {
    let v1Calls = 0;
    v1Routes([
      {
        match: (url) => url.includes('/v1/playlists/'),
        respond: () => {
          v1Calls += 1;
          return jsonResponse({}, 401);
        },
      },
    ]);

    const { fetchPlaylistV1, ProviderError } = await freshApiV1();
    await expect(fetchPlaylistV1('x')).rejects.toBeInstanceOf(ProviderError);
    expect(v1Calls).toBe(2);
  });

  it('KNOWN HAZARD H2: a page with `next: undefined` never terminates the pagination loop', async () => {
    // `hasMore = page.next !== null` treats undefined as "more pages". A fuse
    // in the fake fetch proves the loop would spin forever AND terminates the
    // test deterministically. Desired behavior (see docs/TESTING.md): treat
    // undefined like null → resolves with the page-1 tracks after ≤2 calls.
    let trackCalls = 0;
    v1Routes([
      {
        match: (url) => url.includes(`/v1/playlists/${PLAYLIST_ID}?`),
        respond: () => jsonResponse(V1_PLAYLIST_META),
      },
      {
        match: (url) => url.includes('/tracks?'),
        respond: () => {
          trackCalls += 1;
          if (trackCalls > 3) throw new Error('FUSE: pagination did not terminate');
          return jsonResponse(V1_TRACKS_NEXT_UNDEFINED);
        },
      },
    ]);

    const { fetchPlaylistV1 } = await freshApiV1();
    await expect(fetchPlaylistV1(PLAYLIST_ID)).rejects.toThrow(/FUSE/);
    expect(trackCalls).toBe(4);
  });
});

describe('fetchUserPlaylistsV1', () => {
  it('maps items, skips id-less entries, URL-encodes the user id', async () => {
    const fetchMock = v1Routes([
      {
        match: (url) => url.includes('/v1/users/'),
        respond: () => jsonResponse(V1_USER_PLAYLISTS),
      },
    ]);

    const { fetchUserPlaylistsV1 } = await freshApiV1();
    const playlists = await fetchUserPlaylistsV1('user with spaces');

    expect(playlists).toHaveLength(1); // ghost entry without id skipped
    expect(playlists[0]).toMatchObject({ name: 'Public One', trackCount: 12 });
    expect(fetchMock.callsTo('/v1/users/')[0].url).toContain('user%20with%20spaces');
  });

  it('paginates until next is null', async () => {
    const fetchMock = v1Routes([
      {
        match: (url) => url.includes('/v1/users/') && url.includes('offset=0'),
        respond: () =>
          jsonResponse({ items: [{ id: 'a'.repeat(22), name: 'One' }], next: 'more' }),
      },
      {
        match: (url) => url.includes('/v1/users/') && url.includes('offset=50'),
        respond: () => jsonResponse({ items: [{ id: 'b'.repeat(22), name: 'Two' }], next: null }),
      },
    ]);

    const { fetchUserPlaylistsV1 } = await freshApiV1();
    const playlists = await fetchUserPlaylistsV1('someone');
    expect(playlists.map((p) => p.name)).toEqual(['One', 'Two']);
    expect(fetchMock.callsTo('/v1/users/')).toHaveLength(2);
  });
});
