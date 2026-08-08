// Cloudflare Worker: Spotify scraper backend.
//
// Serves same-origin JSON under /api/*, already shaped as the app's
// SpotifyPlaylist / SpotifyTrack types, so the frontend needs no Spotify login.
// Only /api/* reaches this Worker (wrangler.jsonc `run_worker_first`); every
// other path is served by the static-asset handler with SPA fallback.

import type { ApiError } from './types';
import { getPlaylist, getUserPlaylists, NotFoundError } from './providers';
import { cached } from './cache';

// Edge cache TTL for successful scrapes (seconds).
const CACHE_TTL = 900;

function json(body: unknown, status = 200, cacheable = false): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
  };
  if (cacheable) headers['Cache-Control'] = `public, max-age=${CACHE_TTL}`;
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(e: unknown): Response {
  if (e instanceof NotFoundError) {
    const body: ApiError = {
      error: 'not_found',
      message: 'Playlist oder Profil nicht gefunden oder privat.',
    };
    return json(body, 404);
  }
  const body: ApiError = {
    error: 'scrape_failed',
    message: e instanceof Error ? e.message : String(e),
  };
  return json(body, 502);
}

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    // The Worker only ever receives /api/*, but guard anyway.
    if (!pathname.startsWith('/api/')) {
      return json({ error: 'not_found' } satisfies ApiError, 404);
    }
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed' } satisfies ApiError, 405);
    }

    // Cheap smoke test — validates routing/bundling without touching Spotify.
    if (pathname === '/api/health') {
      return json({ ok: true });
    }

    const playlistMatch = pathname.match(/^\/api\/playlist\/([^/]+)$/);
    if (playlistMatch) {
      const id = decodeURIComponent(playlistMatch[1]);
      try {
        return await cached(request.url, ctx, async () => json(await getPlaylist(id), 200, true));
      } catch (e) {
        return errorResponse(e);
      }
    }

    const userMatch = pathname.match(/^\/api\/user\/([^/]+)\/playlists$/);
    if (userMatch) {
      const userId = decodeURIComponent(userMatch[1]);
      try {
        return await cached(request.url, ctx, async () =>
          json(await getUserPlaylists(userId), 200, true),
        );
      } catch (e) {
        return errorResponse(e);
      }
    }

    return json({ error: 'not_found' } satisfies ApiError, 404);
  },
};
