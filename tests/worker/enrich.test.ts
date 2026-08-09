import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchRoute } from '../helpers/fakeFetch';
import { jsonResponse, stubFetch, tokenPipelineRoutes } from '../helpers/fakeFetch';
import type { SpotifyTrack } from '../../worker/types';

async function freshEnrich() {
  vi.resetModules();
  return import('../../worker/providers/enrich');
}

function track(id: string, coverUrl: string | null = null): SpotifyTrack {
  return {
    id,
    name: `Track ${id}`,
    artist: 'Artist',
    albumName: '',
    albumCoverUrl: coverUrl,
    playlistId: 'pl',
  };
}

/** Build the /v1/tracks payload the enricher expects for a set of ids. */
function tracksPayload(ids: string[]) {
  return {
    tracks: ids.map((id) => ({
      id,
      name: `Track ${id}`,
      album: { name: `Album ${id}`, images: [{ url: `https://i.scdn.co/${id}` }] },
    })),
  };
}

function enrichRoutes(routes: FetchRoute[]) {
  return stubFetch([...routes, ...tokenPipelineRoutes()]);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('enrichCovers', () => {
  it('fills covers and album names in place', async () => {
    enrichRoutes([
      {
        match: (url) => url.includes('/v1/tracks?ids='),
        respond: (url) => {
          const ids = new URL(url).searchParams.get('ids')!.split(',');
          return jsonResponse(tracksPayload(ids));
        },
      },
    ]);

    const tracks = [track('a'), track('b')];
    const { enrichCovers } = await freshEnrich();

    await expect(enrichCovers(tracks)).resolves.toBe(2);
    expect(tracks[0].albumCoverUrl).toBe('https://i.scdn.co/a');
    expect(tracks[0].albumName).toBe('Album a');
  });

  it('does nothing when every track already has a cover', async () => {
    const fetchMock = enrichRoutes([]);
    const tracks = [track('a', 'https://existing/a')];
    const { enrichCovers } = await freshEnrich();

    await expect(enrichCovers(tracks)).resolves.toBe(0);
    expect(fetchMock.calls).toHaveLength(0); // not even a token is minted
  });

  it('leaves already-covered tracks untouched and only asks for the rest', async () => {
    const fetchMock = enrichRoutes([
      {
        match: (url) => url.includes('/v1/tracks?ids='),
        respond: (url) => {
          const ids = new URL(url).searchParams.get('ids')!.split(',');
          return jsonResponse(tracksPayload(ids));
        },
      },
    ]);

    const tracks = [track('a', 'https://existing/a'), track('b')];
    const { enrichCovers } = await freshEnrich();

    await expect(enrichCovers(tracks)).resolves.toBe(1);
    expect(tracks[0].albumCoverUrl).toBe('https://existing/a'); // preserved
    expect(fetchMock.callsTo('/v1/tracks?ids=')[0].url).toContain('ids=b');
  });

  it('chunks ids into batches of 50', async () => {
    const fetchMock = enrichRoutes([
      {
        match: (url) => url.includes('/v1/tracks?ids='),
        respond: (url) => {
          const ids = new URL(url).searchParams.get('ids')!.split(',');
          return jsonResponse(tracksPayload(ids));
        },
      },
    ]);

    const tracks = Array.from({ length: 58 }, (_, i) => track(`t${i}`));
    const { enrichCovers } = await freshEnrich();

    await expect(enrichCovers(tracks)).resolves.toBe(58);
    const calls = fetchMock.callsTo('/v1/tracks?ids=');
    expect(calls).toHaveLength(2); // 50 + 8
    expect(new URL(calls[0].url).searchParams.get('ids')!.split(',')).toHaveLength(50);
    expect(new URL(calls[1].url).searchParams.get('ids')!.split(',')).toHaveLength(8);
  });

  it('skips null entries (tracks unavailable in this market)', async () => {
    enrichRoutes([
      {
        match: (url) => url.includes('/v1/tracks?ids='),
        respond: () => jsonResponse({ tracks: [null, { id: 'b', album: { images: [] } }] }),
      },
    ]);

    const tracks = [track('a'), track('b')];
    const { enrichCovers } = await freshEnrich();

    // null entry ignored; 'b' has no image → no cover assigned
    await expect(enrichCovers(tracks)).resolves.toBe(0);
    expect(tracks[0].albumCoverUrl).toBeNull();
  });

  it('propagates a rejected batch so the caller can treat enrichment as optional', async () => {
    enrichRoutes([
      {
        match: (url) => url.includes('/v1/tracks?ids='),
        respond: () => jsonResponse({}, 403),
      },
    ]);

    const { enrichCovers } = await freshEnrich();
    await expect(enrichCovers([track('a')])).rejects.toThrow('v1 tracks 403');
  });
});
