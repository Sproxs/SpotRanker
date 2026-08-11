// The scraper's only playlist source: the public embed page.
//
// open.spotify.com/embed/playlist/{id} ships a __NEXT_DATA__ JSON blob with the
// playlist name, cover and track list, and needs no token whatsoever. Known
// limits: the track list is typically capped around 100 entries and the entity
// carries no owner. Per-track artwork is read opportunistically (see
// coverFromTrack) — when absent, /api/track-covers backfills it via oEmbed.

import { NotFoundError, ProviderError, USER_AGENT } from '../errors';
import type { SpotifyPlaylist, SpotifyTrack } from '../types';

const EMBED_BASE = 'https://open.spotify.com/embed/playlist/';

interface CoverArt {
  sources?: { url?: string }[];
}

interface EmbedTrack {
  uri?: string;
  title?: string;
  subtitle?: string;
  // Artwork has appeared under several shapes across web-player releases and
  // may be absent entirely; all of these are treated as optional.
  coverArt?: CoverArt;
  albumOfTrack?: { coverArt?: CoverArt };
  album?: { images?: { url?: string }[] };
}

interface EmbedEntity {
  name?: string;
  title?: string;
  subtitle?: string;
  coverArt?: CoverArt;
  trackList?: EmbedTrack[];
}

/** Largest available source wins — the list is ordered small → large. */
function largestSource(art: CoverArt | undefined): string | null {
  const sources = art?.sources ?? [];
  for (let i = sources.length - 1; i >= 0; i--) {
    const url = sources[i]?.url;
    if (url) return url;
  }
  return null;
}

/**
 * Per-track artwork, if this web-player release happens to include it.
 * Returns null when the payload carries none — the normal case today.
 */
function coverFromTrack(track: EmbedTrack): string | null {
  return (
    largestSource(track.coverArt) ??
    largestSource(track.albumOfTrack?.coverArt) ??
    track.album?.images?.[0]?.url ??
    null
  );
}

function extractEntity(html: string): EmbedEntity {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new ProviderError('Embed __NEXT_DATA__ nicht gefunden');

  let entity: EmbedEntity | undefined;
  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
    };
    entity = data.props?.pageProps?.state?.data?.entity;
  } catch {
    throw new ProviderError('Embed-JSON konnte nicht geparst werden');
  }
  if (!entity) throw new ProviderError('Embed-Entity fehlt');
  return entity;
}

export async function fetchPlaylistEmbed(
  id: string,
): Promise<{ playlist: SpotifyPlaylist; tracks: SpotifyTrack[]; coversMissing: boolean }> {
  const res = await fetch(`${EMBED_BASE}${id}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (res.status === 404) throw new NotFoundError(`Embed 404: ${id}`);
  if (!res.ok) throw new ProviderError(`Embed ${res.status} für ${id}`);

  const entity = extractEntity(await res.text());

  const tracks: SpotifyTrack[] = (entity.trackList ?? [])
    .map((t): SpotifyTrack => {
      const uri = t.uri ?? '';
      return {
        id: uri.split(':').pop() ?? uri,
        name: t.title ?? 'Unbekannter Titel',
        artist: t.subtitle ?? 'Unbekannter Künstler',
        albumName: '',
        albumCoverUrl: coverFromTrack(t),
        playlistId: id,
      };
    })
    .filter((t) => t.id);

  const playlist: SpotifyPlaylist = {
    id,
    name: entity.title ?? entity.name ?? 'Unbenannte Playlist',
    description: entity.subtitle ?? '',
    imageUrl: largestSource(entity.coverArt),
    trackCount: tracks.length,
    owner: '',
  };

  // Signals that the client should backfill covers via /api/track-covers.
  const coversMissing = tracks.length > 0 && tracks.every((t) => !t.albumCoverUrl);

  return { playlist, tracks, coversMissing };
}
