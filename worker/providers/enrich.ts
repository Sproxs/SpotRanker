// Best-effort per-track album art for the degraded embed path.
//
// The embed __NEXT_DATA__ carries no per-track artwork, so a playlist that fell
// back to it renders as a wall of placeholder tiles. /v1/tracks?ids= returns
// full track objects for up to 50 ids per call — two subrequests for a typical
// embed list — so the covers can be filled in without re-fetching the playlist.
//
// This shares the anonymous token with the v1 provider. If token minting is
// what failed in the first place, enrichment fails in lockstep and simply
// leaves the covers null: a quality improvement, never a reliability fix.

import { getToken, USER_AGENT } from '../token';
import { albumInfo } from '../mappers';
import type { RawTrack } from '../mappers';
import type { SpotifyTrack } from '../types';

const API_BASE = 'https://api.spotify.com/v1';
const BATCH_SIZE = 50;
/** Hard ceiling on subrequests spent here, well below the Workers limit. */
const MAX_BATCHES = 4;

interface RawTracksResponse {
  tracks?: (RawTrack | null)[];
}

/**
 * Fill in `albumCoverUrl`/`albumName` on tracks that lack them, in place.
 * Returns how many tracks gained a cover. Throws if Spotify rejects a batch —
 * callers are expected to treat enrichment as optional.
 */
export async function enrichCovers(tracks: SpotifyTrack[]): Promise<number> {
  const missing = tracks.filter((t) => !t.albumCoverUrl && t.id);
  if (missing.length === 0) return 0;

  const byId = new Map(missing.map((t) => [t.id, t]));
  const ids = [...byId.keys()].slice(0, BATCH_SIZE * MAX_BATCHES);
  let filled = 0;

  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    const chunk = ids.slice(offset, offset + BATCH_SIZE);
    const token = await getToken();
    const res = await fetch(`${API_BASE}/tracks?ids=${chunk.join(',')}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`v1 tracks ${res.status}`);

    const data = (await res.json()) as RawTracksResponse;
    for (const raw of data.tracks ?? []) {
      if (!raw?.id) continue; // unavailable in this market
      const target = byId.get(raw.id);
      if (!target) continue;
      const { albumName, albumCoverUrl } = albumInfo(raw);
      if (!albumCoverUrl) continue;
      target.albumCoverUrl = albumCoverUrl;
      if (!target.albumName) target.albumName = albumName;
      filled += 1;
    }
  }

  return filled;
}
