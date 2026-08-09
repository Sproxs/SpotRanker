// Normalize raw api.spotify.com/v1 objects into the app's SpotifyPlaylist /
// SpotifyTrack shapes. Mirrors the mapping logic in src/services/spotifyApi.ts
// but against the REAL v1 response shapes (item field is `track`, playlist count
// lives at `tracks.total`).

import type { SpotifyPlaylist, SpotifyTrack } from './types';

interface RawImage {
  url: string;
}
interface RawArtist {
  name: string;
}
interface RawAlbum {
  name?: string;
  images?: RawImage[];
}
export interface RawTrack {
  id?: string | null;
  name?: string;
  artists?: RawArtist[];
  album?: RawAlbum;
}

/**
 * Album name + primary cover URL from a raw v1 track. Shared by the playlist
 * mapper and the cover enricher so both agree on which image wins.
 */
export function albumInfo(track: RawTrack): { albumName: string; albumCoverUrl: string | null } {
  const images = track.album?.images ?? [];
  return {
    albumName: track.album?.name ?? '',
    albumCoverUrl: images.length > 0 ? images[0].url : null,
  };
}

export interface RawV1Playlist {
  id: string;
  name?: string;
  description?: string | null;
  images?: RawImage[] | null;
  owner?: { display_name?: string };
  tracks?: { total?: number };
}

export interface RawV1PlaylistItem {
  track: RawTrack | null;
}

export function mapV1Playlist(raw: RawV1Playlist): SpotifyPlaylist {
  const images = raw.images ?? [];
  return {
    id: raw.id,
    name: raw.name ?? 'Unbenannte Playlist',
    description: raw.description ?? '',
    imageUrl: images.length > 0 ? images[0].url : null,
    trackCount: raw.tracks?.total ?? 0,
    owner: raw.owner?.display_name ?? '',
  };
}

export function mapV1Track(item: RawV1PlaylistItem, playlistId: string): SpotifyTrack | null {
  const track = item.track;
  if (!track || !track.id) return null; // skip local-only / unavailable tracks

  const artists = track.artists ?? [];
  const { albumName, albumCoverUrl } = albumInfo(track);

  return {
    id: track.id,
    name: track.name ?? 'Unbekannter Titel',
    artist: artists.map((a) => a.name).join(', ') || 'Unbekannter Künstler',
    albumName,
    albumCoverUrl,
    playlistId,
  };
}
