import { describe, expect, it } from 'vitest';
import { mapV1Playlist, mapV1Track } from '../../worker/mappers';

describe('mapV1Playlist', () => {
  it('maps a full playlist, first image wins', () => {
    expect(
      mapV1Playlist({
        id: 'p1',
        name: 'Hits',
        description: 'desc',
        images: [{ url: 'first' }, { url: 'second' }],
        owner: { display_name: 'Spotify' },
        tracks: { total: 42 },
      }),
    ).toEqual({
      id: 'p1',
      name: 'Hits',
      description: 'desc',
      imageUrl: 'first',
      trackCount: 42,
      owner: 'Spotify',
    });
  });

  it('defaults everything that is missing', () => {
    expect(mapV1Playlist({ id: 'p2' })).toEqual({
      id: 'p2',
      name: 'Unbenannte Playlist',
      description: '',
      imageUrl: null,
      trackCount: 0,
      owner: '',
    });
  });

  it('null description and null images are tolerated', () => {
    const mapped = mapV1Playlist({ id: 'p3', description: null, images: null });
    expect(mapped.description).toBe('');
    expect(mapped.imageUrl).toBeNull();
  });
});

describe('mapV1Track', () => {
  it('maps a full track, joins artists with ", "', () => {
    expect(
      mapV1Track(
        {
          track: {
            id: 't1',
            name: 'Song',
            artists: [{ name: 'A' }, { name: 'B' }],
            album: { name: 'Alb', images: [{ url: 'cover' }] },
          },
        },
        'pl',
      ),
    ).toEqual({
      id: 't1',
      name: 'Song',
      artist: 'A, B',
      albumName: 'Alb',
      albumCoverUrl: 'cover',
      playlistId: 'pl',
    });
  });

  it('returns null for local-only items (track null / missing id)', () => {
    expect(mapV1Track({ track: null }, 'pl')).toBeNull();
    expect(mapV1Track({ track: { name: 'no id' } }, 'pl')).toBeNull();
    expect(mapV1Track({ track: { id: null, name: 'null id' } }, 'pl')).toBeNull();
  });

  it('falls back for empty artists and missing album art', () => {
    const mapped = mapV1Track({ track: { id: 't2', artists: [], album: { images: [] } } }, 'pl');
    expect(mapped).toEqual({
      id: 't2',
      name: 'Unbekannter Titel',
      artist: 'Unbekannter Künstler',
      albumName: '',
      albumCoverUrl: null,
      playlistId: 'pl',
    });
  });
});
