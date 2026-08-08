// LIVE smoke tests — these hit the real Spotify endpoints.
//
// Run on demand with `npm run test:live`. They are structurally excluded from
// `npm test` and CI (the default vitest.config.ts does not include tests/live/
// at all) and additionally self-skip when CI is set. Expect occasional
// flakiness: rate limits, rotated web-player secrets, embed markup changes.
// Their whole point is to detect that real-world drift — the unit suites run
// entirely against frozen fixtures.

import { describe, expect, it } from 'vitest';

// "Today's Top Hits" — Spotify-owned, public, effectively permanent.
const KNOWN_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M';

describe.skipIf(!!process.env.CI)('live spotify', () => {
  it('mints an anonymous web-player token', async () => {
    const { getToken } = await import('../../worker/token');
    const token = await getToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('getPlaylist resolves a well-known public playlist (shape only)', async () => {
    const { getPlaylist } = await import('../../worker/providers');
    const { playlist, tracks, source, degraded } = await getPlaylist(KNOWN_PLAYLIST_ID);

    expect(playlist.id).toBe(KNOWN_PLAYLIST_ID);
    expect(playlist.name.length).toBeGreaterThan(0);
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      artist: expect.any(String),
      playlistId: KNOWN_PLAYLIST_ID,
    });
    expect(['apiv1', 'embed']).toContain(source);
    expect(typeof degraded).toBe('boolean');
  });

  it('embed fallback works directly (canary for __NEXT_DATA__ markup drift)', async () => {
    const { fetchPlaylistEmbed } = await import('../../worker/providers/embed');
    const { playlist, tracks, degraded } = await fetchPlaylistEmbed(KNOWN_PLAYLIST_ID);

    expect(degraded).toBe(true);
    expect(playlist.name.length).toBeGreaterThan(0);
    expect(tracks.length).toBeGreaterThan(0);
  });

  // No live getUserPlaylists test: there is no stable, well-known account
  // whose id passes the 22-char base62 parser. Add one here if such an
  // account is identified. (See docs/TESTING.md, Known hazards H4.)
});
