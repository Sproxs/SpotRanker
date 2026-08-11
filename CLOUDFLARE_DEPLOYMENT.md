# Cloudflare Deployment Guide

SpotRanker is deployed to Cloudflare as a **Worker with static assets plus a scraper backend**, built
directly from this repository via Cloudflare's GitHub integration. There is no deployment workflow in
GitHub Actions — Cloudflare clones the repo, runs the build and publishes the result itself.

The Worker script (`worker/index.ts`) serves the built-in Spotify scraper under `/api/*`; every other
path is served from the static `dist/` assets. `wrangler deploy` bundles the Worker at deploy time —
Vite does **not** build it. The scraper reads the public pages on `open.spotify.com` and uses no
Spotify Web API, so it needs **no credentials, secrets or environment variables** at all.

---

## How a deployment happens

1. You push to `main`.
2. Cloudflare clones the repository and installs dependencies with `npm clean-install`.
3. It runs the build command `npm run build`, producing `dist/`.
4. It runs the deploy command `npx wrangler deploy`, which reads `wrangler.jsonc` and uploads
   `dist/` as the Worker's static assets.

Build logs are in the Cloudflare dashboard under the project's **Deployments** tab.

---

## Project configuration

`wrangler.jsonc` is committed, so every build uses the same settings instead of the ones Cloudflare
would otherwise generate on the fly:

| Key | Value | Why |
|---|---|---|
| `name` | `spotranker` | Worker name; determines the default `*.workers.dev` hostname |
| `main` | `worker/index.ts` | Scraper backend; wrangler bundles it at deploy time |
| `assets.directory` | `./dist` | Vite's build output |
| `assets.not_found_handling` | `single-page-application` | Serves `index.html` for unmatched paths so Vue Router can handle them |
| `assets.run_worker_first` | `["/api/*"]` | Routes only `/api/*` to the Worker; without it the SPA fallback would swallow the API and the Worker would never run |

### Dashboard build settings

These are set once when the project is created and should match:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Output directory | `dist` |

---

## Environment variables

**None.** The scraper mints nothing, stores nothing and authenticates nowhere —
it reads the public pages on `open.spotify.com`. A build with no variables set
at all is the expected configuration, and there is no Spotify application to
register.

---

## Local development

Run the frontend and the scraper Worker in two terminals:

```bash
npm install
npm run dev             # terminal 1 — Vite on :5173
npm run dev:worker      # terminal 2 — wrangler dev on :8787 (serves /api/*)
```

Vite proxies `/api` to the Worker (`server.proxy` in `vite.config.ts`), so the app works end-to-end
at `http://localhost:5173`. Smoke-test the Worker directly with
`curl http://localhost:8787/api/health` → `{"ok":true}`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails with `Invalid _redirects configuration … Infinite loop detected` | A `_redirects` file is present again | Workers handles SPA routing through `not_found_handling`; the file must not exist |
| Build fails with type errors | TypeScript error | Run `npm run type-check` locally and fix |
| 404 when reloading on `/dashboard` | `not_found_handling` missing from `wrangler.jsonc` | Restore the `assets` block shown above |
| `/api/*` returns `index.html` instead of JSON | `run_worker_first` missing from `wrangler.jsonc` | Restore `assets.run_worker_first: ["/api/*"]` |
| Scraper returns 502 `scrape_failed` for every playlist | open.spotify.com unreachable or its embed markup changed | Check the logs for `scrape_failed`; see the diagnosis table in [docs/TESTING.md](docs/TESTING.md) |
| Track tiles show the placeholder instead of covers | Cover lookups failed or are still in flight | Covers load progressively via `/api/track-covers`; check the logs for that route |
