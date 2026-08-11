// Cover resolution runs through Spotify's public oEmbed endpoint — no token,
// but one request per track, which is why the batch size is capped.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch } from '../helpers/fakeFetch';
import { fetchTrackCovers, MAX_IDS } from '../../worker/providers/covers';

function oembedRoute() {
  return {
    match: (url: string) => url.startsWith('https://open.spotify.com/oembed'),
    respond: (url: string) => {
      const target = new URL(url).searchParams.get('url') ?? '';
      const id = target.split(':').pop();
      return jsonResponse({ thumbnail_url: `https://i.scdn.co/${id}` });
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTrackCovers', () => {
  it('resolves one cover per id', async () => {
    stubFetch([oembedRoute()]);

    await expect(fetchTrackCovers(['a', 'b'])).resolves.toEqual({
      a: 'https://i.scdn.co/a',
      b: 'https://i.scdn.co/b',
    });
  });

  it('queries oEmbed with a spotify:track: URI', async () => {
    const fetchMock = stubFetch([oembedRoute()]);
    await fetchTrackCovers(['abc']);

    const target = new URL(fetchMock.calls[0].url).searchParams.get('url');
    expect(target).toBe('spotify:track:abc');
  });

  it('an empty id list makes no requests', async () => {
    const fetchMock = stubFetch([]);
    await expect(fetchTrackCovers([])).resolves.toEqual({});
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('deduplicates ids and drops empty ones', async () => {
    const fetchMock = stubFetch([oembedRoute()]);
    await fetchTrackCovers(['a', 'a', '', 'b']);
    expect(fetchMock.calls).toHaveLength(2);
  });

  it(`never resolves more than MAX_IDS (${MAX_IDS}) per call`, async () => {
    const fetchMock = stubFetch([oembedRoute()]);
    const ids = Array.from({ length: MAX_IDS + 15 }, (_, i) => `t${i}`);

    const covers = await fetchTrackCovers(ids);

    expect(fetchMock.calls).toHaveLength(MAX_IDS);
    expect(Object.keys(covers)).toHaveLength(MAX_IDS);
  });

  it('a missing thumbnail maps to null rather than failing', async () => {
    stubFetch([
      {
        match: (url) => url.startsWith('https://open.spotify.com/oembed'),
        respond: () => jsonResponse({}),
      },
    ]);

    await expect(fetchTrackCovers(['a'])).resolves.toEqual({ a: null });
  });

  it('one failing lookup does not sink the batch', async () => {
    stubFetch([
      {
        match: (url) => url.includes('spotify%3Atrack%3Abad'),
        respond: () => {
          throw new TypeError('connection reset');
        },
      },
      oembedRoute(),
    ]);

    await expect(fetchTrackCovers(['bad', 'good'])).resolves.toEqual({
      bad: null,
      good: 'https://i.scdn.co/good',
    });
  });

  it('a non-ok response maps to null', async () => {
    stubFetch([
      {
        match: (url) => url.startsWith('https://open.spotify.com/oembed'),
        respond: () => jsonResponse({}, 404),
      },
    ]);

    await expect(fetchTrackCovers(['a'])).resolves.toEqual({ a: null });
  });
});
