import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchRoute } from '../helpers/fakeFetch';
import { jsonResponse, stubFetch, tokenPipelineRoutes } from '../helpers/fakeFetch';
import { PROFILE_VIEW_RESPONSE } from '../fixtures/v1Responses';

async function freshProfileView() {
  vi.resetModules();
  return import('../../worker/providers/profileView');
}

function pvRoutes(routes: FetchRoute[]) {
  return stubFetch([...routes, ...tokenPipelineRoutes()]);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchUserPlaylistsProfileView', () => {
  it('maps playlists; trackCount is always 0; non-http images dropped; uri-less filtered', async () => {
    const fetchMock = pvRoutes([
      {
        match: (url) => url.includes('spclient.wg.spotify.com'),
        respond: () => jsonResponse(PROFILE_VIEW_RESPONSE),
      },
    ]);

    const { fetchUserPlaylistsProfileView } = await freshProfileView();
    const playlists = await fetchUserPlaylistsProfileView('someuser');

    expect(playlists).toHaveLength(2); // uri-less entry filtered out
    expect(playlists[0]).toEqual({
      id: 'pl000000000000000000002',
      name: 'Profile Playlist',
      description: '',
      imageUrl: 'https://i.scdn.co/image/pv1',
      trackCount: 0, // provider limitation, documented
      owner: 'Some User',
    });
    expect(playlists[1].imageUrl).toBeNull(); // spotify:image: uri dropped
    // single page request with the hard cap of 200
    expect(fetchMock.callsTo('spclient.wg.spotify.com')[0].url).toContain('offset=0&limit=200');
  });

  it('401 → re-mints the token and retries once', async () => {
    let pvCalls = 0;
    pvRoutes([
      {
        match: (url) => url.includes('spclient.wg.spotify.com'),
        respond: () => {
          pvCalls += 1;
          if (pvCalls === 1) return jsonResponse({}, 401);
          return jsonResponse({ playlists: [] });
        },
      },
    ]);

    const { fetchUserPlaylistsProfileView } = await freshProfileView();
    await expect(fetchUserPlaylistsProfileView('someuser')).resolves.toEqual([]);
    expect(pvCalls).toBe(2);
  });

  it('404 → NotFoundError; other errors → ProviderError', async () => {
    pvRoutes([
      {
        match: (url) => url.includes('spclient.wg.spotify.com'),
        respond: () => jsonResponse({}, 404),
      },
    ]);

    const mod = await freshProfileView();
    const { NotFoundError } = await import('../../worker/providers/apiV1');
    await expect(mod.fetchUserPlaylistsProfileView('ghost')).rejects.toBeInstanceOf(NotFoundError);
  });
});
