# Cloudflare Deployment Guide

SpotRanker is deployed to Cloudflare as a **Worker with static assets plus a scraper backend**, built
directly from this repository via Cloudflare's GitHub integration. There is no deployment workflow in
GitHub Actions — Cloudflare clones the repo, runs the build and publishes the result itself.

The Worker script (`worker/index.ts`) serves the built-in Spotify scraper under `/api/*`; every other
path is served from the static `dist/` assets. `wrangler deploy` bundles the Worker at deploy time —
Vite does **not** build it. The scraper needs **no credentials or secrets** (it mints anonymous
Spotify web-player tokens itself), so no new environment variables are required.

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

Set these in the Cloudflare dashboard under **Settings → Builds**, as build variables. They are read
at build time by Vite, so a change only takes effect on the next deployment.

Note that this is *not* the **Settings → Variables and Secrets** section. That one configures
runtime bindings for a Worker script, and it refuses an assets-only Worker with "Variables cannot be
added to a Worker that only has static assets". Runtime bindings would not help here anyway: Vite
inlines `VITE_*` values into the bundle during the build, and the browser cannot read Worker
bindings.

| Variable | Required | Value |
|---|---|---|
| `VITE_SPOTIFY_CLIENT_ID` | yes | Your Spotify application's Client ID |
| `VITE_SPOTIFY_REDIRECT_URI` | no | Leave unset — see below |

Without `VITE_SPOTIFY_CLIENT_ID` the build still succeeds, but the client ID becomes an empty string
and Spotify login fails at runtime.

`VITE_SPOTIFY_REDIRECT_URI` is deliberately left unset. When it is absent,
`src/config/spotify.ts` falls back to `window.location.origin + BASE_URL + "callback"`, so the app
derives the correct callback URL from whatever hostname it is served under. Setting it to an empty
string does *not* work — an empty string is not nullish, so the fallback would not apply.

A Spotify **Client Secret** is not needed; the app uses the PKCE authorization flow.

---

## Spotify setup

In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), open the app and add
the deployment's callback URL under **Redirect URIs**:

```
https://<your-worker-hostname>/callback
```

The hostname is shown in the Cloudflare dashboard after the first successful deployment — either the
generated `*.workers.dev` address or your own custom domain. Spotify matches redirect URIs
character for character, so no trailing slash and `https` rather than `http`. Keep
`http://localhost:5173/callback` in the list for local development.

---

## Local development

Run the frontend and the scraper Worker in two terminals:

```bash
npm install
cp .env.example .env    # optional: only for the Spotify login, fill in VITE_SPOTIFY_CLIENT_ID
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
| Site loads but Spotify login does nothing | `VITE_SPOTIFY_CLIENT_ID` not set in Cloudflare | Add it under Settings → Builds as a build variable, then redeploy |
| "Variables cannot be added to a Worker that only has static assets" | Wrong section — those are runtime variables | Build variables live under Settings → Builds |
| Login fails with `INVALID_CLIENT` | Callback URL not registered at Spotify | Add the exact deployment URL plus `/callback` to the app's Redirect URIs |
| 404 when reloading on `/dashboard` | `not_found_handling` missing from `wrangler.jsonc` | Restore the `assets` block shown above |
| `/api/*` returns `index.html` instead of JSON | `run_worker_first` missing from `wrangler.jsonc` | Restore `assets.run_worker_first: ["/api/*"]` |
| Scraper returns 502 `scrape_failed` for every playlist | Spotify rotated the web-player TOTP secret | Refresh the cipher bytes + version in `worker/secrets.ts` (`FALLBACK_SECRETS`) |
| Changed an environment variable but nothing changed | Variables are baked in at build time | Trigger a new deployment |
