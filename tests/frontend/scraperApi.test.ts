import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch } from '../helpers/fakeFetch';
import {
  fetchScrapedPlaylist,
  fetchScrapedUserPlaylists,
} from '@/services/scraperApi';

const PLAYLIST_PAYLOAD = {
  playlist: { id: 'p', name: 'P', description: '', imageUrl: null, trackCount: 0, owner: '' },
  tracks: [],
  source: 'apiv1',
  degraded: false,
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchScrapedPlaylist', () => {
  it('returns playlist/tracks/degraded and drops `source`; id is URL-encoded', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () => jsonResponse(PLAYLIST_PAYLOAD),
      },
    ]);

    const result = await fetchScrapedPlaylist('id with spaces');

    expect(result).toEqual({
      playlist: PLAYLIST_PAYLOAD.playlist,
      tracks: [],
      degraded: false,
      degradedReason: undefined,
    });
    expect(result).not.toHaveProperty('source');
    expect(fetchMock.calls[0].url).toBe('/api/playlist/id%20with%20spaces');
  });

  it('passes degradedReason through so the UI can name the cause', async () => {
    stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () =>
          jsonResponse({
            ...PLAYLIST_PAYLOAD,
            source: 'embed',
            degraded: true,
            degradedReason: 'rate_limit',
          }),
      },
    ]);

    await expect(fetchScrapedPlaylist('x')).resolves.toMatchObject({
      degraded: true,
      degradedReason: 'rate_limit',
    });
  });

  it.each([
    ['not_found', 'Playlist nicht gefunden. Ist sie öffentlich?', 404],
    ['private', 'Diese Playlist ist privat und kann ohne Login nicht geladen werden.', 404],
    ['scrape_failed', 'Playlist konnte nicht geladen werden. Bitte später erneut versuchen.', 502],
    ['bad_request', 'Ungültige Eingabe.', 400],
    ['method_not_allowed', 'Ungültige Anfrage.', 405],
  ])('maps error code %s to its German message', async (code, message, status) => {
    stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () => jsonResponse({ error: code }, status),
      },
    ]);

    await expect(fetchScrapedPlaylist('x')).rejects.toThrow(message);
  });

  it('unknown error code falls back to the status-based message', async () => {
    stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () => jsonResponse({ error: 'weird_new_code' }, 500),
      },
    ]);

    await expect(fetchScrapedPlaylist('x')).rejects.toThrow('Scraper-Fehler: 500');
  });

  it('non-JSON error body falls back to the status-based message', async () => {
    stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () => new Response('<html>gateway error</html>', { status: 502 }),
      },
    ]);

    await expect(fetchScrapedPlaylist('x')).rejects.toThrow('Scraper-Fehler: 502');
  });

  it('network failure → "Keine Verbindung zum Scraper-Dienst."', async () => {
    stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);

    await expect(fetchScrapedPlaylist('x')).rejects.toThrow(
      'Keine Verbindung zum Scraper-Dienst.',
    );
  });

  it('documented gap: a 200 with non-JSON body rejects with a raw SyntaxError', async () => {
    // e.g. an SPA-fallback misconfiguration serving index.html under /api.
    // apiFetch only guards the error path with .catch(() => null), not the
    // success path — the German wrapper does not apply here.
    stubFetch([
      {
        match: (url) => url.includes('/api/playlist/'),
        respond: () => new Response('<!DOCTYPE html><html></html>', { status: 200 }),
      },
    ]);

    const err = await fetchScrapedPlaylist('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyntaxError);
  });
});

describe('fetchScrapedUserPlaylists', () => {
  it('returns the playlists array and drops `source`', async () => {
    const playlists = [
      { id: 'a', name: 'A', description: '', imageUrl: null, trackCount: 0, owner: '' },
    ];
    const fetchMock = stubFetch([
      {
        match: (url) => url.includes('/api/user/'),
        respond: () => jsonResponse({ playlists, source: 'profileview' }),
      },
    ]);

    await expect(fetchScrapedUserPlaylists('some user')).resolves.toEqual(playlists);
    expect(fetchMock.calls[0].url).toBe('/api/user/some%20user/playlists');
  });
});
