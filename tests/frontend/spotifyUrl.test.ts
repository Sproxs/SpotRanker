import { describe, expect, it } from 'vitest';
import { classifyInput, parsePlaylistId, parseUserId } from '@/utils/spotifyUrl';

const PL = '37i9dQZF1DXcBWIGoYBM5M'; // 22 base62 chars
const USR = 'AbCdEfGhIjKlMnOpQrStUv'; // 22 base62 chars

interface Row {
  input: string;
  kind: 'playlist' | 'user' | 'unknown';
  id: string | null;
  note?: string;
}

const table: Row[] = [
  // ── accepted playlist forms ────────────────────────────────────────────
  { input: `https://open.spotify.com/playlist/${PL}`, kind: 'playlist', id: PL },
  { input: `https://open.spotify.com/playlist/${PL}?si=abc123&pt=x`, kind: 'playlist', id: PL },
  { input: `https://open.spotify.com/embed/playlist/${PL}`, kind: 'playlist', id: PL },
  { input: `https://open.spotify.com/intl-de/playlist/${PL}`, kind: 'playlist', id: PL },
  { input: `http://open.spotify.com/playlist/${PL}`, kind: 'playlist', id: PL },
  { input: `https://play.spotify.com/playlist/${PL}`, kind: 'playlist', id: PL },
  { input: `spotify:playlist:${PL}`, kind: 'playlist', id: PL },
  { input: PL, kind: 'playlist', id: PL, note: 'bare id assumed playlist' },
  { input: `  https://open.spotify.com/playlist/${PL}  `, kind: 'playlist', id: PL },
  { input: `  ${PL}\n`, kind: 'playlist', id: PL },

  // ── accepted user forms ────────────────────────────────────────────────
  { input: `https://open.spotify.com/user/${USR}`, kind: 'user', id: USR },
  { input: `spotify:user:${USR}`, kind: 'user', id: USR },

  // ── rejected ───────────────────────────────────────────────────────────
  { input: '', kind: 'unknown', id: null },
  { input: '   ', kind: 'unknown', id: null },
  { input: `open.spotify.com/playlist/${PL}`, kind: 'unknown', id: null, note: 'no scheme' },
  { input: `https://open.spotify.com/track/${PL}`, kind: 'unknown', id: null },
  { input: `https://open.spotify.com/album/${PL}`, kind: 'unknown', id: null },
  { input: `https://open.spotify.com/artist/${PL}`, kind: 'unknown', id: null },
  { input: `spotify:track:${PL}`, kind: 'unknown', id: null },
  { input: `spotify:album:${PL}`, kind: 'unknown', id: null },
  { input: 'spotify:user:someshortname', kind: 'unknown', id: null },
  { input: 'https://open.spotify.com/', kind: 'unknown', id: null },
  { input: `https://notspotify.com/playlist/${PL}`, kind: 'unknown', id: null },
  { input: `https://evilspotify.com/playlist/${PL}`, kind: 'unknown', id: null },
  { input: `https://open.spotify.com.evil.com/playlist/${PL}`, kind: 'unknown', id: null },
  { input: 'tooShort123', kind: 'unknown', id: null },
  { input: 'way-too-long-and-with-dashes-so-not-an-id', kind: 'unknown', id: null },
  { input: `https://open.spotify.com/playlist/${PL}x`, kind: 'unknown', id: null, note: '23 chars' },
  { input: `https://open.spotify.com/playlist/${PL.slice(0, 21)}_`, kind: 'unknown', id: null },

  // ── KNOWN HAZARDS (assert CURRENT behavior; desired behavior in docs/TESTING.md) ──
  {
    input: `https://evil.spotify.com/playlist/${PL}`,
    kind: 'playlist',
    id: PL,
    note: 'KNOWN HAZARD H3: any *.spotify.com subdomain is accepted',
  },
  {
    input: 'https://open.spotify.com/user/spotify',
    kind: 'unknown',
    id: null,
    note: 'KNOWN HAZARD H4: real usernames are rarely 22 base62 chars → rejected',
  },
  {
    input: 'https://open.spotify.com/user/1122334455',
    kind: 'unknown',
    id: null,
    note: 'KNOWN HAZARD H4: numeric legacy user ids rejected',
  },
];

describe('classifyInput', () => {
  for (const row of table) {
    const label = row.note ? `${row.note}: ${row.input || '(empty)'}` : row.input || '(empty)';
    it(label, () => {
      expect(classifyInput(row.input)).toEqual({ kind: row.kind, id: row.id });
    });
  }
});

describe('parsePlaylistId / parseUserId', () => {
  it('parsePlaylistId returns the id only for playlist inputs', () => {
    expect(parsePlaylistId(`spotify:playlist:${PL}`)).toBe(PL);
    expect(parsePlaylistId(`https://open.spotify.com/user/${USR}`)).toBeNull();
    expect(parsePlaylistId('garbage')).toBeNull();
  });

  it('parseUserId returns the id only for user inputs', () => {
    expect(parseUserId(`https://open.spotify.com/user/${USR}`)).toBe(USR);
    expect(parseUserId(`spotify:playlist:${PL}`)).toBeNull();
    expect(parseUserId(PL)).toBeNull(); // bare id is classified as playlist
  });
});
