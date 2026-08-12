import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import path from 'node:path';

// Cloudflare serves the app from the root of its own hostname.
const base = '/';

// Build identity, surfaced in the ⚙ overlay so a user can tell at a glance
// whether an update actually landed. Cloudflare Workers Builds clones the repo
// (so git works) but also exports the SHA directly – prefer the env var, since
// a shallow/detached checkout can make `git rev-parse` unreliable.
function resolveVersion(): string {
  const ci = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(resolveVersion()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // In dev, the scraper Worker runs separately (`npm run dev:worker` →
  // wrangler dev on :8787). Proxy /api there so the browser's same-origin
  // relative calls reach it with clean HMR for the SPA.
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  plugins: [
    vue(),
    VitePWA({
      // 'prompt', not 'autoUpdate': with autoUpdate the plugin forces
      // skipWaiting + clientsClaim, so a freshly deployed SW activates
      // immediately, drops the previous precache and takes over the *open*
      // page – which keeps running the old JS. Every lazy route chunk
      // (src/router/index.ts) then 404s, because Cloudflare removes the old
      // hashed assets on deploy. Prompt mode keeps the new SW in `waiting`
      // until src/services/pwaUpdate.ts applies it with a controlled reload,
      // so the version swap is atomic.
      registerType: 'prompt',
      manifest: {
        name: 'SpotRanker',
        short_name: 'SpotRanker',
        description: 'Spotify Tier-List PWA',
        theme_color: '#121212',
        background_color: '#09090b',
        display: 'standalone',
        start_url: base,
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // These three are Workbox defaults under registerType 'prompt', but
        // spelled out on purpose: they are the whole point of the mode, and a
        // silent flip back to 'autoUpdate' would otherwise reintroduce the
        // mixed old-page/new-SW state described above.
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // The scraper API is dynamic – never let the SPA navigation fallback
        // serve index.html for it, and never precache it.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Scraper backend: fresh data when online, cached responses as a
            // short-lived offline fallback.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'spotranker-api',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 15, // 15 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/i\.scdn\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'spotify-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/mosaic\.scdn\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'spotify-mosaic-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
