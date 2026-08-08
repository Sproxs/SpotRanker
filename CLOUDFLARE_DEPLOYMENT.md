# Cloudflare Deployment Guide

SpotRanker is deployed to Cloudflare as a **Worker with static assets**, built directly from this
repository via Cloudflare's GitHub integration. There is no deployment workflow in GitHub Actions —
Cloudflare clones the repo, runs the build and publishes the result itself.

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
| `assets.directory` | `./dist` | Vite's build output |
| `assets.not_found_handling` | `single-page-application` | Serves `index.html` for unmatched paths so Vue Router can handle them |

### Dashboard build settings

These are set once when the project is created and should match:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Output directory | `dist` |

---

## Environment variables

Set these in the Cloudflare dashboard under **Settings → Variables and Secrets**. They are read at
build time by Vite, so a change only takes effect on the next deployment.

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

```bash
npm install
cp .env.example .env    # then fill in VITE_SPOTIFY_CLIENT_ID
npm run dev
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails with `Invalid _redirects configuration … Infinite loop detected` | A `_redirects` file is present again | Workers handles SPA routing through `not_found_handling`; the file must not exist |
| Build fails with type errors | TypeScript error | Run `npm run type-check` locally and fix |
| Site loads but Spotify login does nothing | `VITE_SPOTIFY_CLIENT_ID` not set in Cloudflare | Add it under Settings → Variables and Secrets, then redeploy |
| Login fails with `INVALID_CLIENT` | Callback URL not registered at Spotify | Add the exact deployment URL plus `/callback` to the app's Redirect URIs |
| 404 when reloading on `/dashboard` | `not_found_handling` missing from `wrangler.jsonc` | Restore the `assets` block shown above |
| Changed an environment variable but nothing changed | Variables are baked in at build time | Trigger a new deployment |
