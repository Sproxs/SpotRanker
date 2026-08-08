// Provider C — tokenless fallback via the public embed page.
//
// open.spotify.com/embed/playlist/{id} ships a __NEXT_DATA__ JSON blob with the
// playlist name, cover and track list. This needs no token at all, so it works
// even when token minting is broken — but it is DEGRADED: no per-track album art
// and the track list is typically capped around 100 entries.

import { USER_AGENT } from '../token';
import type { SpotifyPlaylist, SpotifyTrack } from '../types';
import { NotFoundError, ProviderError } from './apiV1';

const EMBED_BASE = 'https://open.spotify.com/embed/playlist/';

interface EmbedTrack {
  uri?: string;
  title?: string;
  subtitle?: string;
}

interface EmbedEntity {
  name?: string;
  title?: string;
  subtitle?: string;
  coverArt?: { sources?: { url: string }[] };
  trackList?: EmbedTrack[];
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
): Promise<{ playlist: SpotifyPlaylist; tracks: SpotifyTrack[]; degraded: boolean }> {
  const res = await fetch(`${EMBED_BASE}${id}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (res.status === 404) throw new NotFoundError(`Embed 404: ${id}`);
  if (!res.ok) throw new ProviderError(`Embed ${res.status} für ${id}`);

  const entity = extractEntity(await res.text());

  const sources = entity.coverArt?.sources ?? [];
  const imageUrl = sources.length > 0 ? sources[sources.length - 1].url : null;

  const tracks: SpotifyTrack[] = (entity.trackList ?? [])
    .map((t): SpotifyTrack => {
      const uri = t.uri ?? '';
      return {
        id: uri.split(':').pop() ?? uri,
        name: t.title ?? 'Unbekannter Titel',
        artist: t.subtitle ?? 'Unbekannter Künstler',
        albumName: '',
        albumCoverUrl: null,
        playlistId: id,
      };
    })
    .filter((t) => t.id);

  const playlist: SpotifyPlaylist = {
    id,
    name: entity.title ?? entity.name ?? 'Unbenannte Playlist',
    description: entity.subtitle ?? '',
    imageUrl,
    trackCount: tracks.length,
    owner: '',
  };

  return { playlist, tracks, degraded: true };
}
