// A profile's public playlists, read from the public user page.
//
// open.spotify.com/user/{id} is server-rendered the same way the embed pages
// are, so the playlist list can be lifted out of __NEXT_DATA__ without a token.
// The exact JSON path has moved between web-player releases, so the shape is
// probed defensively and a miss is reported as a normal provider error rather
// than crashing the route.

import { NotFoundError, ProviderError, USER_AGENT } from '../errors';
import type { SpotifyPlaylist } from '../types';

const USER_BASE = 'https://open.spotify.com/user/';

interface RawItem {
  uri?: string;
  id?: string;
  name?: string;
  title?: string;
  images?: { url?: string }[];
  coverArt?: { sources?: { url?: string }[] };
  owner?: { display_name?: string; name?: string };
}

function idFrom(item: RawItem): string | null {
  if (item.uri) {
    const last = item.uri.split(':').pop();
    if (last) return last;
  }
  return item.id ?? null;
}

function imageFrom(item: RawItem): string | null {
  const sources = item.coverArt?.sources ?? [];
  for (let i = sources.length - 1; i >= 0; i--) {
    if (sources[i]?.url) return sources[i].url as string;
  }
  return item.images?.[0]?.url ?? null;
}

/**
 * Walk the parsed page JSON for anything that looks like a playlist entry.
 * Release-proof by construction: we look for objects carrying a
 * `spotify:playlist:` uri instead of pinning one property path.
 */
function collectPlaylists(node: unknown, into: Map<string, SpotifyPlaylist>): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) collectPlaylists(child, into);
    return;
  }

  const item = node as RawItem & Record<string, unknown>;
  if (typeof item.uri === 'string' && item.uri.startsWith('spotify:playlist:')) {
    const id = idFrom(item);
    if (id && !into.has(id)) {
      into.set(id, {
        id,
        name: item.name ?? item.title ?? 'Unbenannte Playlist',
        description: '',
        imageUrl: imageFrom(item),
        trackCount: 0, // the user page carries no counts
        owner: item.owner?.display_name ?? item.owner?.name ?? '',
      });
    }
  }

  for (const value of Object.values(item)) collectPlaylists(value, into);
}

export async function fetchUserPlaylistsPage(userId: string): Promise<SpotifyPlaylist[]> {
  const res = await fetch(`${USER_BASE}${encodeURIComponent(userId)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (res.status === 404) throw new NotFoundError(`Profil 404: ${userId}`);
  if (!res.ok) throw new ProviderError(`Profilseite ${res.status} für ${userId}`, res.status);

  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new ProviderError('Profilseite: __NEXT_DATA__ nicht gefunden');

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new ProviderError('Profilseite: JSON konnte nicht geparst werden');
  }

  const found = new Map<string, SpotifyPlaylist>();
  collectPlaylists(parsed, found);
  if (found.size === 0) {
    throw new ProviderError('Profilseite: keine öffentlichen Playlists gefunden');
  }
  return [...found.values()];
}
