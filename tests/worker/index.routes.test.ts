// Full route table of the Worker entry, driven through the exported fetch
// handler with a MemoryCache and a fake ExecutionContext. The provider chain
// is vi.mock'ed — provider internals have their own suites.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';
import { getPlaylist, getUserPlaylists } from '../../worker/providers';
import { installCaches, makeCtx } from '../helpers/workerEnv';

vi.mock('../../worker/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../worker/providers')>();
  return { ...actual, getPlaylist: vi.fn(), getUserPlaylists: vi.fn() };
});

const getPlaylistMock = vi.mocked(getPlaylist);
const getUserPlaylistsMock = vi.mocked(getUserPlaylists);

const ORIGIN = 'https://spotranker.example';
const PLAYLIST_RESPONSE = {
  playlist: { id: 'p', name: 'P', description: '', imageUrl: null, trackCount: 1, owner: '' },
  tracks: [],
  source: 'apiv1' as const,
  degraded: false,
};

function req(path: string, method = 'GET'): Request {
  return new Request(`${ORIGIN}${path}`, { method });
}

async function run(path: string, method = 'GET') {
  return worker.fetch(req(path, method), {}, makeCtx());
}

beforeEach(() => {
  vi.clearAllMocks();
  installCaches();
});

describe('routing basics', () => {
  it('GET /api/health → 200 {ok:true}, json content-type, NOT cacheable', async () => {
    const res = await run('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toBeNull();
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('non-GET → 405 envelope (POST)', async () => {
    const res = await run('/api/health', 'POST');
    expect(res.status).toBe(405);
    await expect(res.json()).resolves.toEqual({ error: 'method_not_allowed' });
  });

  it('QUIRK: HEAD /api/health → 405 (method check precedes the health route)', async () => {
    const res = await run('/api/health', 'HEAD');
    expect(res.status).toBe(405);
  });

  it('unknown /api/* path → 404 envelope', async () => {
    const res = await run('/api/nope');
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('nested/trailing path shapes do not match the playlist route', async () => {
    expect((await run('/api/playlist/a/b')).status).toBe(404);
    expect((await run('/api/playlist/')).status).toBe(404);
    expect(getPlaylistMock).not.toHaveBeenCalled();
  });

  it('non-/api/ path → 404 (guard, normally unreachable behind run_worker_first)', async () => {
    const res = await run('/dashboard');
    expect(res.status).toBe(404);
  });
});

describe('/api/playlist/{id}', () => {
  it('success: 200, cacheable, id URL-decoded and passed through', async () => {
    getPlaylistMock.mockResolvedValue(PLAYLIST_RESPONSE);

    const res = await run('/api/playlist/abc%20def');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=900');
    await expect(res.json()).resolves.toEqual(PLAYLIST_RESPONSE);
    expect(getPlaylistMock).toHaveBeenCalledWith('abc def');
  });

  it('NotFoundError → 404 envelope with German message', async () => {
    const { NotFoundError } = await import('../../worker/providers');
    getPlaylistMock.mockRejectedValue(new NotFoundError('gone'));

    const res = await run('/api/playlist/missing');
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: 'not_found',
      message: 'Playlist oder Profil nicht gefunden oder privat.',
    });
  });

  it('any other failure → 502 scrape_failed with the error message', async () => {
    getPlaylistMock.mockRejectedValue(new Error('everything burned'));

    const res = await run('/api/playlist/sad');
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: 'scrape_failed',
      message: 'everything burned',
    });
  });

  it('second identical request is served from the edge cache (provider called once)', async () => {
    getPlaylistMock.mockResolvedValue(PLAYLIST_RESPONSE);

    const ctx1 = makeCtx();
    const first = await worker.fetch(req('/api/playlist/cachedone'), {}, ctx1);
    expect(first.status).toBe(200);
    await ctx1.settle(); // let the waitUntil'd cache.put finish

    const second = await worker.fetch(req('/api/playlist/cachedone'), {}, makeCtx());
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual(PLAYLIST_RESPONSE);
    expect(getPlaylistMock).toHaveBeenCalledTimes(1);
  });

  it('errors are never cached: a failure is retried on the next request', async () => {
    getPlaylistMock
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValueOnce(PLAYLIST_RESPONSE);

    expect((await run('/api/playlist/flaky')).status).toBe(502);
    expect((await run('/api/playlist/flaky')).status).toBe(200);
    expect(getPlaylistMock).toHaveBeenCalledTimes(2);
  });

  it('KNOWN HAZARD H1: malformed percent-escape rejects with URIError (500, no JSON envelope)', async () => {
    // decodeURIComponent throws OUTSIDE the try/catch. Desired behavior (see
    // docs/TESTING.md): a 400 bad_request envelope. In production workerd
    // renders this rejection as an opaque 500 HTML page.
    await expect(run('/api/playlist/%E0%A4%A')).rejects.toThrow(URIError);
    expect(getPlaylistMock).not.toHaveBeenCalled();
  });
});

describe('/api/user/{userId}/playlists', () => {
  it('success: 200, cacheable, decoded userId passed through', async () => {
    const payload = { playlists: [], source: 'apiv1' as const };
    getUserPlaylistsMock.mockResolvedValue(payload);

    const res = await run('/api/user/some%20user/playlists');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=900');
    await expect(res.json()).resolves.toEqual(payload);
    expect(getUserPlaylistsMock).toHaveBeenCalledWith('some user');
  });

  it('failure → 502 scrape_failed', async () => {
    getUserPlaylistsMock.mockRejectedValue(new Error('no luck'));
    const res = await run('/api/user/u/playlists');
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ error: 'scrape_failed' });
  });
});
