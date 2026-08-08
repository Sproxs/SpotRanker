// Chain semantics of worker/providers/index.ts in isolation: the three
// provider modules are vi.mock'ed, so these tests assert ONLY the fallback /
// short-circuit / wrapping rules, not provider internals.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlaylist, getUserPlaylists, NotFoundError, ScrapeError } from '../../worker/providers';
import { fetchPlaylistV1, fetchUserPlaylistsV1, ProviderError } from '../../worker/providers/apiV1';
import { fetchPlaylistEmbed } from '../../worker/providers/embed';
import { fetchUserPlaylistsProfileView } from '../../worker/providers/profileView';

vi.mock('../../worker/providers/apiV1', async (importOriginal) => {
  // Keep the real error classes (instanceof checks in the chain depend on
  // class identity), mock only the fetchers.
  const actual = await importOriginal<typeof import('../../worker/providers/apiV1')>();
  return {
    ...actual,
    fetchPlaylistV1: vi.fn(),
    fetchUserPlaylistsV1: vi.fn(),
  };
});
vi.mock('../../worker/providers/embed', () => ({ fetchPlaylistEmbed: vi.fn() }));
vi.mock('../../worker/providers/profileView', () => ({ fetchUserPlaylistsProfileView: vi.fn() }));

const v1Playlist = vi.mocked(fetchPlaylistV1);
const v1User = vi.mocked(fetchUserPlaylistsV1);
const embed = vi.mocked(fetchPlaylistEmbed);
const profileView = vi.mocked(fetchUserPlaylistsProfileView);

const PLAYLIST = { id: 'p', name: 'P', description: '', imageUrl: null, trackCount: 1, owner: '' };
const TRACK = {
  id: 't',
  name: 'T',
  artist: 'A',
  albumName: '',
  albumCoverUrl: null,
  playlistId: 'p',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPlaylist chain (v1 → embed)', () => {
  it('v1 success: embed never called, source=apiv1, degraded=false', async () => {
    v1Playlist.mockResolvedValue({ playlist: PLAYLIST, tracks: [TRACK] });

    await expect(getPlaylist('p')).resolves.toEqual({
      playlist: PLAYLIST,
      tracks: [TRACK],
      source: 'apiv1',
      degraded: false,
    });
    expect(embed).not.toHaveBeenCalled();
  });

  it('v1 ProviderError → falls through to embed, degraded propagates', async () => {
    v1Playlist.mockRejectedValue(new ProviderError('v1 down'));
    embed.mockResolvedValue({ playlist: PLAYLIST, tracks: [TRACK], degraded: true });

    await expect(getPlaylist('p')).resolves.toMatchObject({ source: 'embed', degraded: true });
    expect(embed).toHaveBeenCalledWith('p');
  });

  it('any non-NotFound v1 failure falls through (even TypeError)', async () => {
    v1Playlist.mockRejectedValue(new TypeError('fetch blew up'));
    embed.mockResolvedValue({ playlist: PLAYLIST, tracks: [], degraded: true });

    await expect(getPlaylist('p')).resolves.toMatchObject({ source: 'embed' });
  });

  it('v1 NotFoundError short-circuits: embed is NEVER tried', async () => {
    v1Playlist.mockRejectedValue(new NotFoundError('gone'));

    await expect(getPlaylist('p')).rejects.toBeInstanceOf(NotFoundError);
    expect(embed).not.toHaveBeenCalled();
  });

  it('embed NotFoundError is also rethrown as-is', async () => {
    v1Playlist.mockRejectedValue(new ProviderError('v1 down'));
    embed.mockRejectedValue(new NotFoundError('embed 404'));

    await expect(getPlaylist('p')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('both providers fail → ScrapeError wrapping the second error message', async () => {
    v1Playlist.mockRejectedValue(new ProviderError('v1 down'));
    embed.mockRejectedValue(new ProviderError('embed down'));

    const err = await getPlaylist('p').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScrapeError);
    expect((err as Error).message).toBe('embed down');
  });
});

describe('getUserPlaylists chain (v1 → profileView)', () => {
  it('v1 success: profileView never called, source=apiv1', async () => {
    v1User.mockResolvedValue([PLAYLIST]);

    await expect(getUserPlaylists('u')).resolves.toEqual({
      playlists: [PLAYLIST],
      source: 'apiv1',
    });
    expect(profileView).not.toHaveBeenCalled();
  });

  it('v1 failure → profileView fallback, source=profileview', async () => {
    v1User.mockRejectedValue(new ProviderError('v1 down'));
    profileView.mockResolvedValue([PLAYLIST]);

    await expect(getUserPlaylists('u')).resolves.toMatchObject({ source: 'profileview' });
  });

  it('v1 NotFoundError short-circuits: profileView is NEVER tried', async () => {
    v1User.mockRejectedValue(new NotFoundError('no such user'));

    await expect(getUserPlaylists('u')).rejects.toBeInstanceOf(NotFoundError);
    expect(profileView).not.toHaveBeenCalled();
  });

  it('both fail → ScrapeError', async () => {
    v1User.mockRejectedValue(new ProviderError('v1 down'));
    profileView.mockRejectedValue(new ProviderError('pv down'));

    await expect(getUserPlaylists('u')).rejects.toBeInstanceOf(ScrapeError);
  });
});
