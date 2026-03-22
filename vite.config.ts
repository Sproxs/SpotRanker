import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// GitHub Pages serves the app under a sub-path (/<repo-name>/).
// Cloudflare Pages serves from the root, so the base should be '/'.
// CF_PAGES_BUILD is set by the Cloudflare Pages workflow to signal a root-path build.
const base =
  process.env.GITHUB_ACTIONS && !process.env.CF_PAGES_BUILD
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'SpotRanker'}/`
    : '/';

export default defineConfig({
  base,
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
        runtimeCaching: [
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
