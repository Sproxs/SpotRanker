// There is no provider chain any more: each resource has exactly one tokenless
// source on open.spotify.com. These tests pin that contract — a failure is a
// failure, with no silent fallback — plus the failure classification.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyFailure,
  getPlaylist,
  getUserPlaylists,
  NotFoundError,
  ProviderError,
  ScrapeError,
} from '../../worker/providers';
import { fetchPlaylistEmbed } from '../../worker/providers/embed';
import { fetchUserPlaylistsPage } from '../../worker/providers/userPage';

vi.mock('../../worker/providers/embed', () => ({ fetchPlaylistEmbed: vi.fn() }));
vi.mock('../../worker/providers/userPage', () => ({ fetchUserPlaylistsPage: vi.fn() }));

const embed = vi.mocked(fetchPlaylistEmbed);
const userPage = vi.mocked(fetchUserPlaylistsPage);

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

describe('getPlaylist', () => {
  it('returns the embed result with source=embed', async () => {
    embed.mockResolvedValue({ playlist: PLAYLIST, tracks: [TRACK], coversMissing: true });

    await expect(getPlaylist('p')).resolves.toEqual({
      playlist: PLAYLIST,
      tracks: [TRACK],
      source: 'embed',
      coversMissing: true,
    });
  });

  it('passes coversMissing:false through when artwork was inline', async () => {
    embed.mockResolvedValue({
      playlist: PLAYLIST,
      tracks: [{ ...TRACK, albumCoverUrl: 'https://i.scdn.co/x' }],
      coversMissing: false,
    });

    await expect(getPlaylist('p')).resolves.toMatchObject({ coversMissing: false });
  });

  it('NotFoundError is rethrown as-is (no fallback exists)', async () => {
    embed.mockRejectedValue(new NotFoundError('gone'));
    await expect(getPlaylist('p')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('any other failure becomes a ScrapeError carrying the message', async () => {
    embed.mockRejectedValue(new ProviderError('embed down'));

    const err = await getPlaylist('p').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScrapeError);
    expect((err as Error).message).toBe('embed down');
  });
});

describe('getUserPlaylists', () => {
  it('returns the user-page result with source=userpage', async () => {
    userPage.mockResolvedValue([PLAYLIST]);

    await expect(getUserPlaylists('u')).resolves.toEqual({
      playlists: [PLAYLIST],
      source: 'userpage',
    });
  });

  it('NotFoundError is rethrown as-is', async () => {
    userPage.mockRejectedValue(new NotFoundError('no such user'));
    await expect(getUserPlaylists('u')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('any other failure becomes a ScrapeError', async () => {
    userPage.mockRejectedValue(new ProviderError('page down'));
    await expect(getUserPlaylists('u')).rejects.toBeInstanceOf(ScrapeError);
  });
});

describe('classifyFailure', () => {
  it.each([
    ['ProviderError', new ProviderError('bad page'), 'upstream'],
    ['ProviderError with status', new ProviderError('boom', 503), 'upstream'],
    ['unparseable body', new SyntaxError('Unexpected token <'), 'upstream'],
    ['raw fetch rejection', new TypeError('Failed to fetch'), 'network'],
    ['non-Error throw', 'something', 'network'],
  ])('%s → %s', (_label, error, expected) => {
    expect(classifyFailure(error)).toBe(expected);
  });
});
