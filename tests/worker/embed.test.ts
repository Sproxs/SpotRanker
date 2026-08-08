// worker/providers/embed.ts is tokenless — only the embed-page fetch needs
// stubbing. The private extractEntity() error paths are reached through
// malformed HTML fixtures.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlResponse, stubFetch } from '../helpers/fakeFetch';
import { fetchPlaylistEmbed } from '../../worker/providers/embed';
import { NotFoundError, ProviderError } from '../../worker/providers/apiV1';
import {
  EMBED_HTML_BAD_JSON,
  EMBED_HTML_NO_ENTITY,
  EMBED_HTML_NO_SCRIPT,
  EMBED_HTML_OK,
} from '../fixtures/embedPlaylist';

const ID = '37i9dQZF1DXcBWIGoYBM5M';

function stubEmbed(html: string, status = 200) {
  return stubFetch([
    {
      match: (url) => url.startsWith('https://open.spotify.com/embed/playlist/'),
      respond: () => htmlResponse(html, status),
    },
  ]);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPlaylistEmbed', () => {
  it('happy path: always degraded, last cover source wins, empty-id tracks filtered', async () => {
    stubEmbed(EMBED_HTML_OK);

    const { playlist, tracks, degraded } = await fetchPlaylistEmbed(ID);

    expect(degraded).toBe(true);
    expect(playlist).toEqual({
      id: ID,
      name: 'Fixture Playlist',
      description: 'Fixture subtitle',
      imageUrl: 'https://i.scdn.co/image/large', // LAST source
      trackCount: 2, // = tracks.length, not the real total
      owner: '',
    });
    // the spotify:local: entry has an empty trailing id segment → filtered
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      id: '4uLU6hMCjMI75M1A2tKUQC',
      name: 'First Song',
      artist: 'Artist One',
      albumName: '',
      albumCoverUrl: null,
      playlistId: ID,
    });
  });

  it('404 → NotFoundError', async () => {
    stubEmbed('gone', 404);
    await expect(fetchPlaylistEmbed(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('non-ok status → ProviderError', async () => {
    stubEmbed('teapot', 418);
    const err = await fetchPlaylistEmbed(ID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as Error).message).toContain('418');
  });

  it('missing __NEXT_DATA__ script → "Embed __NEXT_DATA__ nicht gefunden"', async () => {
    stubEmbed(EMBED_HTML_NO_SCRIPT);
    await expect(fetchPlaylistEmbed(ID)).rejects.toThrow('Embed __NEXT_DATA__ nicht gefunden');
  });

  it('unparseable JSON → "Embed-JSON konnte nicht geparst werden"', async () => {
    stubEmbed(EMBED_HTML_BAD_JSON);
    await expect(fetchPlaylistEmbed(ID)).rejects.toThrow('Embed-JSON konnte nicht geparst werden');
  });

  it('entity path missing → "Embed-Entity fehlt"', async () => {
    stubEmbed(EMBED_HTML_NO_ENTITY);
    await expect(fetchPlaylistEmbed(ID)).rejects.toThrow('Embed-Entity fehlt');
  });
});
