// The profile provider walks the user page's __NEXT_DATA__ looking for anything
// carrying a spotify:playlist: uri, rather than pinning one JSON path — the
// web player has moved that path between releases.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlResponse, stubFetch } from '../helpers/fakeFetch';
import { fetchUserPlaylistsPage } from '../../worker/providers/userPage';
import { NotFoundError, ProviderError } from '../../worker/errors';

function page(data: unknown): string {
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    data,
  )}</script></body></html>`;
}

function stubPage(html: string, status = 200) {
  return stubFetch([
    {
      match: (url) => url.startsWith('https://open.spotify.com/user/'),
      respond: () => htmlResponse(html, status),
    },
  ]);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchUserPlaylistsPage', () => {
  it('finds playlists at any depth and maps them', async () => {
    stubPage(
      page({
        props: {
          pageProps: {
            anything: {
              nested: [
                {
                  uri: 'spotify:playlist:pl0000000000000000001',
                  name: 'Public One',
                  coverArt: { sources: [{ url: 'small' }, { url: 'large' }] },
                  owner: { display_name: 'Some User' },
                },
              ],
            },
          },
        },
      }),
    );

    await expect(fetchUserPlaylistsPage('someone')).resolves.toEqual([
      {
        id: 'pl0000000000000000001',
        name: 'Public One',
        description: '',
        imageUrl: 'large', // largest source wins
        trackCount: 0, // the user page carries no counts
        owner: 'Some User',
      },
    ]);
  });

  it('ignores non-playlist uris and deduplicates', async () => {
    stubPage(
      page({
        a: { uri: 'spotify:track:t1', name: 'A Track' },
        b: { uri: 'spotify:playlist:dup', name: 'Dup' },
        c: { uri: 'spotify:playlist:dup', name: 'Dup again' },
      }),
    );

    const result = await fetchUserPlaylistsPage('someone');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dup');
  });

  it('URL-encodes the user id', async () => {
    const fetchMock = stubPage(page({ x: { uri: 'spotify:playlist:p1', name: 'P' } }));
    await fetchUserPlaylistsPage('user with spaces');
    expect(fetchMock.calls[0].url).toContain('user%20with%20spaces');
  });

  it('404 → NotFoundError', async () => {
    stubPage('gone', 404);
    await expect(fetchUserPlaylistsPage('ghost')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('non-ok → ProviderError carrying the status', async () => {
    stubPage('nope', 503);
    const err = await fetchUserPlaylistsPage('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).status).toBe(503);
  });

  it('missing __NEXT_DATA__ → ProviderError', async () => {
    stubPage('<html><body>nothing</body></html>');
    await expect(fetchUserPlaylistsPage('x')).rejects.toThrow('__NEXT_DATA__ nicht gefunden');
  });

  it('unparseable JSON → ProviderError', async () => {
    stubPage('<html><script id="__NEXT_DATA__" type="application/json">{oops</script></html>');
    await expect(fetchUserPlaylistsPage('x')).rejects.toThrow('konnte nicht geparst werden');
  });

  it('no playlists found → ProviderError rather than an empty list', async () => {
    // An empty result is far more likely to mean the page shape changed than
    // that the profile is genuinely empty, so it must not look like success.
    stubPage(page({ props: { pageProps: {} } }));
    await expect(fetchUserPlaylistsPage('x')).rejects.toThrow('keine öffentlichen Playlists');
  });
});
