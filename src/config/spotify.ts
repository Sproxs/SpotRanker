export const SPOTIFY_CONFIG = {
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID as string ?? '',
  redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string ?? `${window.location.origin}/callback`,
  scopes: [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-private'
  ],
  authorizeUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
} as const;
