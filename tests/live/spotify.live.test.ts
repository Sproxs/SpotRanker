// LIVE smoke tests — these hit the real open.spotify.com pages.
//
// Run on demand with `npm run test:live`. They are structurally excluded from
// `npm test` and CI (the default vitest.config.ts does not include tests/live/
// at all) and additionally self-skip when CI is set.
//
// The app has exactly one data source, so these are the only tests that can
// catch it drifting: a changed embed page layout, a moved __NEXT_DATA__ path,
// or oEmbed dropping thumbnails. The unit suites all run against frozen
// fixtures and would stay green through any of that.

import { describe, expect, it } from 'vitest';

// "Today's Top Hits" — Spotify-owned, public, effectively permanent.
const KNOWN_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M';

describe.skipIf(!!process.env.CI)('live open.spotify.com', () => {
  it('reads a well-known public playlist from the embed page', async () => {
    const { getPlaylist } = await import('../../worker/providers');
    const { playlist, tracks, source } = await getPlaylist(KNOWN_PLAYLIST_ID);

    expect(source).toBe('embed');
    expect(playlist.id).toBe(KNOWN_PLAYLIST_ID);
    expect(playlist.name.length).toBeGreaterThan(0);
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      artist: expect.any(String),
      playlistId: KNOWN_PLAYLIST_ID,
    });
  });

  it('reports whether the embed carries per-track artwork', async () => {
    // Not an assertion about which way it goes — the parser reads artwork
    // opportunistically, and this records what the live payload actually
    // provides. If coversMissing is false, the /api/track-covers round-trip
    // is redundant and can be dropped.
    const { getPlaylist } = await import('../../worker/providers');
    const { coversMissing, tracks } = await getPlaylist(KNOWN_PLAYLIST_ID);

    console.log(
      `embed per-track artwork: ${coversMissing ? 'ABSENT' : 'PRESENT'} (${tracks.length} tracks)`,
    );
    expect(typeof coversMissing).toBe('boolean');
  });

  it('resolves covers through oEmbed', async () => {
    const { getPlaylist } = await import('../../worker/providers');
    const { fetchTrackCovers } = await import('../../worker/providers/covers');

    const { tracks } = await getPlaylist(KNOWN_PLAYLIST_ID);
    const ids = tracks.slice(0, 3).map((t) => t.id);
    const covers = await fetchTrackCovers(ids);

    expect(Object.keys(covers)).toHaveLength(ids.length);
    // At least one of three well-known tracks must resolve, otherwise oEmbed
    // has changed shape or started refusing us.
    expect(Object.values(covers).some((url) => typeof url === 'string')).toBe(true);
  });
});
