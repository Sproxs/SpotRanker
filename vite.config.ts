import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Cloudflare serves the app from the root of its own hostname.
const base = '/';

export default defineConfig({
  base,
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
      registerType: 'autoUpdate',
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
