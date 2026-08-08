// Fixtures shaped like api.spotify.com/v1 responses, matching the fields=
// projections that worker/providers/apiV1.ts requests, and one profile-view
// response for worker/providers/profileView.ts.

export const PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M';

/** GET /v1/playlists/{id}?fields=... */
export const V1_PLAYLIST_META = {
  id: PLAYLIST_ID,
  name: 'Fixture Hits',
  description: 'A fixture playlist',
  images: [{ url: 'https://i.scdn.co/image/cover-large' }, { url: 'https://i.scdn.co/image/cover-small' }],
  owner: { display_name: 'Spotify' },
  tracks: { total: 3 },
};

/** GET /v1/playlists/{id}/tracks — page 1 of 2 (next is a URL string). */
export const V1_TRACKS_PAGE1 = {
  items: [
    {
      track: {
        id: 'track00000000000000001',
        name: 'Alpha',
        artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
        album: { name: 'Album One', images: [{ url: 'https://i.scdn.co/image/a1' }] },
      },
    },
    // local / unavailable track → mapV1Track returns null → skipped
    { track: null },
  ],
  next: 'https://api.spotify.com/v1/playlists/x/tracks?offset=100&limit=100',
};

/** Page 2 of 2 (next: null terminates the loop). */
export const V1_TRACKS_PAGE2 = {
  items: [
    {
      track: {
        id: 'track00000000000000002',
        name: 'Beta',
        artists: [{ name: 'Artist C' }],
        album: { name: 'Album Two', images: [] },
      },
    },
  ],
  next: null,
};

/** KNOWN HAZARD H2 fixture: `next` omitted entirely (undefined). */
export const V1_TRACKS_NEXT_UNDEFINED = {
  items: [
    {
      track: {
        id: 'track00000000000000003',
        name: 'Gamma',
        artists: [{ name: 'Artist D' }],
        album: { name: 'Album Three', images: [] },
      },
    },
  ],
  // no `next` key at all
};

/** GET /v1/users/{userId}/playlists — single page. */
export const V1_USER_PLAYLISTS = {
  items: [
    {
      id: 'pl000000000000000000001',
      name: 'Public One',
      images: [{ url: 'https://i.scdn.co/image/p1' }],
      owner: { display_name: 'Some User' },
      tracks: { total: 12 },
    },
    // entry without id → skipped by fetchUserPlaylistsV1
    { name: 'ghost entry' },
  ],
  next: null,
};

/** GET user-profile-view/v3/profile/{userId}/playlists */
export const PROFILE_VIEW_RESPONSE = {
  playlists: [
    {
      uri: 'spotify:playlist:pl000000000000000000002',
      name: 'Profile Playlist',
      owner_name: 'Some User',
      image_url: 'https://i.scdn.co/image/pv1',
    },
    // relative/spotify-internal image → dropped (must start with http)
    {
      uri: 'spotify:playlist:pl000000000000000000003',
      name: 'No Image',
      owner_name: 'Some User',
      image_url: 'spotify:image:abc',
    },
    // no uri → filtered out entirely
    { name: 'Broken Entry' },
  ],
};
