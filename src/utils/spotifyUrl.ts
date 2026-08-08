// Pure parsers for Spotify links / URIs / bare IDs. No network access.
//
// Accepts the forms users actually paste:
//   https://open.spotify.com/playlist/{id}?si=...
//   https://open.spotify.com/embed/playlist/{id}
//   https://open.spotify.com/user/{id}
//   spotify:playlist:{id}   /   spotify:user:{id}
//   a bare 22-char base62 id (assumed to be a playlist)
// Locale prefixes (e.g. /intl-de/) and query strings are tolerated.

/** Spotify base62 IDs are 22 chars of [A-Za-z0-9]. */
const ID_RE = /^[A-Za-z0-9]{22}$/;

export type SpotifyInputKind = 'playlist' | 'user' | 'unknown';

export interface ClassifiedInput {
  kind: SpotifyInputKind;
  id: string | null;
}

function extractId(candidate: string): string | null {
  const trimmed = candidate.trim();
  return ID_RE.test(trimmed) ? trimmed : null;
}

/** Find the id following a given segment (e.g. "playlist") in a URL path. */
function idAfterSegment(pathParts: string[], segment: string): string | null {
  const idx = pathParts.indexOf(segment);
  if (idx === -1 || idx + 1 >= pathParts.length) return null;
  return extractId(pathParts[idx + 1]);
}

function parseUri(input: string, type: 'playlist' | 'user'): string | null {
  // spotify:playlist:{id} or spotify:user:{id}
  const match = input.trim().match(/^spotify:(playlist|user):([A-Za-z0-9]{22})$/);
  if (match && match[1] === type) return match[2];
  return null;
}

function parseUrl(input: string): { kind: SpotifyInputKind; id: string | null } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;

  const parts = url.pathname.split('/').filter(Boolean); // drops '', locale handled below
  const playlistId = idAfterSegment(parts, 'playlist');
  if (playlistId) return { kind: 'playlist', id: playlistId };
  const userId = idAfterSegment(parts, 'user');
  if (userId) return { kind: 'user', id: userId };
  return { kind: 'unknown', id: null };
}

/** Parse a playlist id from any supported form, or null. */
export function parsePlaylistId(input: string): string | null {
  const classified = classifyInput(input);
  return classified.kind === 'playlist' ? classified.id : null;
}

/** Parse a user id from any supported form, or null. */
export function parseUserId(input: string): string | null {
  const classified = classifyInput(input);
  return classified.kind === 'user' ? classified.id : null;
}

/**
 * Classify pasted input as a playlist link, a profile link, or unknown.
 * A bare 22-char id is treated as a playlist (the common case).
 */
export function classifyInput(input: string): ClassifiedInput {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'unknown', id: null };

  const playlistUri = parseUri(trimmed, 'playlist');
  if (playlistUri) return { kind: 'playlist', id: playlistUri };
  const userUri = parseUri(trimmed, 'user');
  if (userUri) return { kind: 'user', id: userUri };

  const fromUrl = parseUrl(trimmed);
  if (fromUrl && fromUrl.kind !== 'unknown') return fromUrl;
  if (fromUrl && fromUrl.kind === 'unknown') return { kind: 'unknown', id: null };

  const bare = extractId(trimmed);
  if (bare) return { kind: 'playlist', id: bare };

  return { kind: 'unknown', id: null };
}
