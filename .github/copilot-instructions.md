# Copilot Instructions for SpotRanker

## Project Overview

SpotRanker is a **Progressive Web App (PWA)** that lets users create Spotify tier lists (S/A/B/C/D rankings) from their playlists, with full offline support. It authenticates directly with Spotify using **OAuth 2.0 with PKCE** — no backend server required.

Key features: Spotify OAuth PKCE login, playlist browsing, drag-and-drop tier editor, 30-second audio previews, IndexedDB offline persistence, PNG image export, Web Share API, and installable PWA.

---

## Technology Stack

| Category | Technology |
|---|---|
| Framework | Vue 3 + TypeScript 5 (Composition API, `<script setup>`) |
| Build Tool | Vite 6 |
| State Management | Pinia 3 |
| Routing | Vue Router 4 |
| Styling | Tailwind CSS 3 (utility-first, dark theme) |
| Drag & Drop | vuedraggable 4 (Sortable.js wrapper) |
| Image Export | html2canvas 1.4 |
| Offline Storage | localForage 1.10 (IndexedDB abstraction) |
| PWA | vite-plugin-pwa |
| Type Checking | vue-tsc |

---

## Project Structure

```
src/
├── assets/main.css          # Tailwind base imports + root styles
├── components/ui/           # Reusable UI components (AppNavbar, BaseButton, BaseSpinner, SkeletonCard, etc.)
├── config/spotify.ts        # Spotify OAuth config (client ID, redirect URI, scopes)
├── router/index.ts          # Vue Router routes with requiresAuth meta guards
├── stores/
│   ├── auth.ts              # OAuth 2.0 PKCE flow, token management, auto-refresh
│   └── playlists.ts         # Playlist/track loading with offline-first caching
├── services/
│   ├── spotifyApi.ts        # Authenticated Spotify API client with pagination
│   └── offlineDb.ts         # IndexedDB wrapper (playlists, tracks, rankings)
├── types/spotify.ts         # Shared TypeScript interfaces (SpotifyPlaylist, SpotifyTrack, RankingData)
├── utils/pkce.ts            # PKCE utilities (code verifier, challenge, CSRF state)
└── views/
    ├── HomeView.vue         # Landing page
    ├── CallbackView.vue     # OAuth callback handler
    ├── DashboardView.vue    # Playlist browser
    └── EditorView.vue       # Drag-and-drop tier editor (main UI)
```

---

## Coding Conventions

### TypeScript & Vue

- Use **Composition API with `<script setup>`** for all components — no Options API.
- Use `defineProps<Type>()` with `withDefaults()` for prop definitions.
- Use `ref()` and `computed()` for reactive state; avoid `reactive()` unless needed.
- Use **TypeScript generics** for API responses, e.g. `apiFetch<T>(endpoint): Promise<T>`.
- Prefix raw Spotify API shapes with `Raw` (e.g. `RawPlaylist`, `RawTrack`) and map them to local types.
- Use TypeScript type guards (e.g. `(t): t is SpotifyTrack => t !== null`) to filter nullable arrays.

### Naming Conventions

- **Components**: PascalCase (`AppNavbar`, `SkeletonCard`)
- **Pinia stores**: `use*Store()` pattern (`useAuthStore`, `usePlaylistStore`)
- **Functions/variables**: camelCase (`fetchUserPlaylists`, `accessToken`)
- **Types/Interfaces**: PascalCase (`SpotifyPlaylist`, `RankingData`)
- **Constants**: UPPER_SNAKE_CASE (`SPOTIFY_CONFIG`, `STORAGE_KEYS`)
- **Store files**: match the domain they represent (`auth.ts`, `playlists.ts`)

### Component Structure Order

1. `<script setup lang="ts">` — imports, props, store access, reactive state, computed, functions, lifecycle hooks
2. `<template>` — markup
3. `<style scoped>` — only when needed for animations or non-Tailwind styles

### Styling

- Use **Tailwind utility classes** exclusively; avoid custom CSS except for animations or complex non-Tailwind needs.
- Dark theme only: use `zinc-950` / `zinc-900` / `zinc-800` for backgrounds, `zinc-100`/`zinc-400` for text.
- Spotify brand colors: `spotify-400` (#1ed760) and `spotify-500` (#1db954) — defined in `tailwind.config.ts`.
- Tier colors: S=red, A=orange, B=yellow, C=green, D=blue.
- Use Tailwind `group/{name}` for hover states on nested elements (e.g. `group/tile`).
- Responsive layouts use `sm:`, `lg:` breakpoint prefixes.

---

## State Management (Pinia)

### Auth Store (`src/stores/auth.ts`)

Manages the full OAuth 2.0 PKCE flow:
- `login()` — generates PKCE verifier/challenge, redirects to Spotify
- `handleCallback()` — exchanges auth code for tokens, validates CSRF state
- `getAccessToken()` — auto-refresh wrapper (refreshes 5 min before expiry)
- `logout()` — clears all tokens from state and localStorage
- Token refresh is deduplicated (single in-flight refresh at a time)
- Tokens are persisted in `localStorage` with keys `sp_access_token`, `sp_refresh_token`, `sp_expires_at`

### Playlist Store (`src/stores/playlists.ts`)

Manages playlist and track data with offline-first approach:
- `loadUserPlaylists()` — tries API first, falls back to IndexedDB
- `loadTracks(playlistId)` — loads from IndexedDB first (offline-first), then API
- `filteredPlaylists` — computed property filtered by `searchQuery`

---

## Services

### Spotify API Client (`src/services/spotifyApi.ts`)

- `apiFetch<T>(endpoint)` — authenticated fetch; handles 401 auto-refresh, 403 scope errors
- `fetchUserPlaylists()` — paginated (50 per page), maps raw responses to `SpotifyPlaylist`
- `fetchPlaylistTracks(playlistId)` — paginated (100 per page), maps to `SpotifyTrack[]`
- On 401: attempt one token refresh and retry; on 403 with scope error: force logout

### Offline Database (`src/services/offlineDb.ts`)

IndexedDB via localForage with three stores (DB name: `spotranker`):
- `playlists` store — key: `"userPlaylists"`
- `tracks` store — key: `"tracks_{playlistId}"`
- `rankings` store — key: `"ranking_{playlistId}"`

All read operations return safe defaults on error (`[]`, `null`, `false`, `Set()`). Write operations re-throw with original error details.

---

## Routing

Routes are defined in `src/router/index.ts`:

| Path | View | Auth Required |
|---|---|---|
| `/` | HomeView | No |
| `/callback` | CallbackView | No |
| `/dashboard` | DashboardView | Yes |
| `/editor/:playlistId` | EditorView | Yes |

Auth guard uses `beforeEach()` and checks `localStorage` for a valid, non-expired access token. Uses `createWebHistory()` with a dynamic base URL from `import.meta.env.BASE_URL`.

---

## Build & Development

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run build        # Type-check (vue-tsc -b) + bundle (vite build)
npm run type-check   # vue-tsc --noEmit only
npm run preview      # Preview production build locally
```

There is currently **no test infrastructure**. When adding tests in the future, use Vitest (consistent with the Vite ecosystem).

---

## Deployment

- **GitHub Pages**: `/.github/workflows/deploy.yml` — sets `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_REDIRECT_URI` from repository secrets; Vite sets base path from `GITHUB_REPOSITORY`.
- **Cloudflare Pages**: `/.github/workflows/cloudflare-pages.yml` — sets `CF_PAGES_BUILD=true` so Vite uses base `'/'` instead of the GitHub Pages subpath.
- **Environment variables**: `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_REDIRECT_URI` must be set at build time; never commit secrets.

---

## Important Patterns & Constraints

- **No backend**: The app is a pure SPA. All Spotify auth uses PKCE (no client secret needed).
- **Offline-first**: Always check IndexedDB before making network requests.
- **Spotify CDN images**: Use `crossorigin="anonymous"` on all `<img>` tags referencing `i.scdn.co` or `mosaic.scdn.co` for Workbox/SW cache compatibility.
- **Debounced saves**: Ranking updates are debounced (500ms) before writing to IndexedDB.
- **Error messages**: User-facing error messages are in German (the app targets German-speaking users).
- **SPA routing on GitHub Pages**: Handled by `public/404.html` (stores URL in sessionStorage, redirects to root) + `index.html` handler script (restores via `history.replaceState`).
- **Token refresh deduplication**: Only one refresh request in flight at a time — use the existing promise lock pattern in `auth.ts`.
- **Image export**: `html2canvas` captures the tier editor DOM at `scale: 2` for high-DPI output.
