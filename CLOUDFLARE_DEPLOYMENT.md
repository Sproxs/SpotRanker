# Cloudflare Pages Deployment Guide

This document describes how SpotRanker is built and deployed automatically to [Cloudflare Pages](https://pages.cloudflare.com/).

---

## Overview

Every push to the `main` branch triggers the **Deploy to Cloudflare Pages** GitHub Actions workflow (`.github/workflows/cloudflare-pages.yml`), which:

1. Installs Node.js 20 and project dependencies.
2. Builds the Vite app (`npm run build`) and injects environment variables from GitHub Secrets.
3. Verifies that the `dist/` output directory and `dist/index.html` exist.
4. Deploys the `dist/` folder to Cloudflare Pages using [`cloudflare/pages-action`](https://github.com/cloudflare/pages-action).
5. Checks the live deployment URL for an HTTP 200 response as a post-deployment smoke test.

---

## One-Time Setup

### 1. Create a Cloudflare Pages project

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and open **Pages**.
2. Click **Create a project → Direct Upload** (the GitHub Actions workflow handles deployments, so no Git integration is needed here).
3. Name the project **`spotranker`** (must match the `projectName` in the workflow).

### 2. Generate a Cloudflare API token

1. In the Cloudflare Dashboard, go to **My Profile → API Tokens → Create Token**.
2. Use the **Edit Cloudflare Workers** template, or create a custom token with the **Cloudflare Pages: Edit** permission.
3. Copy the generated token — you will only see it once.

### 3. Find your Cloudflare Account ID

Your Account ID is visible in the right-hand panel of any Cloudflare Dashboard page (e.g. under **Workers & Pages**).

### 4. Add GitHub repository secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The API token created above |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |
| `VITE_SPOTIFY_CLIENT_ID` | Your Spotify application Client ID |
| `VITE_SPOTIFY_REDIRECT_URI` | The redirect URI for the production Cloudflare Pages URL (e.g. `https://spotranker.pages.dev/callback`) |

### 5. Register the redirect URI in Spotify

Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), select your application, and add the Cloudflare Pages URL as an allowed Redirect URI:

```
https://spotranker.pages.dev/callback
```

---

## Cloudflare Pages Build Settings

If you prefer to use Cloudflare's built-in Git integration instead of the GitHub Actions workflow, configure your Cloudflare Pages project with:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `20` |

Environment variables to add in the Cloudflare Pages dashboard:

| Variable | Value |
|---|---|
| `VITE_SPOTIFY_CLIENT_ID` | Your Spotify Client ID |
| `VITE_SPOTIFY_REDIRECT_URI` | Your Cloudflare Pages callback URL |

---

## SPA Routing

Cloudflare Pages uses `public/_redirects` to handle client-side routing. The file contains:

```
/* /index.html 200
```

This ensures that all paths are served by `index.html`, allowing Vue Router to handle navigation on the client side.

---

## Staging Environment

A separate workflow (`.github/workflows/cloudflare-pages-staging.yml`) deploys the `staging` branch to an independent Cloudflare Pages project (`spotranker-staging`).

### One-Time Setup for Staging

1. In the Cloudflare Dashboard, create a second Pages project named **`spotranker-staging`** (Direct Upload, same as production).
2. Add an additional GitHub repository secret:

| Secret name | Value |
|---|---|
| `VITE_SPOTIFY_REDIRECT_URI_STAGING` | The redirect URI for the staging URL (e.g. `https://spotranker-staging.pages.dev/callback`) |

The staging workflow also validates that `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured before attempting deployment.

3. Register the staging redirect URI in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):

```
https://spotranker-staging.pages.dev/callback
```

### Environment Differences

| Setting | Production | Staging |
|---|---|---|
| Trigger branch | `main` | `staging` |
| Cloudflare Pages project | `spotranker` | `spotranker-staging` |
| Spotify redirect URI secret | `VITE_SPOTIFY_REDIRECT_URI` | `VITE_SPOTIFY_REDIRECT_URI_STAGING` |
| Expected URL | `https://spotranker.pages.dev` | `https://spotranker-staging.pages.dev` |

The `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are shared between both workflows.

---



Once set up, deployments are fully automatic:

- **Push to `main`** → build + deploy to production (`spotranker` project).
- **Push to `staging`** → build + deploy to staging (`spotranker-staging` project).
- **`workflow_dispatch`** → manually trigger a deployment from the GitHub Actions tab.

Cloudflare Pages also supports **branch preview deployments** if you connect the repository directly via the Cloudflare dashboard.

---

## Post-Deployment Verification

The workflow performs two verification steps:

1. **Build output check**: Confirms that `dist/` and `dist/index.html` were created before deploying.
2. **URL smoke test**: After deployment, sends an HTTP request to the deployment URL and logs the status code. A `200` response confirms the site is live.

If the smoke test returns a non-200 status the workflow still succeeds (the site may still be propagating across Cloudflare's CDN). Visit the URL manually if needed.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow fails with `Input required and not supplied: apiToken` | `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` secret is missing | Add both secrets under **Settings → Secrets and variables → Actions** (see One-Time Setup above) |
| Build fails with type errors | TypeScript compile error | Run `npm run type-check` locally and fix errors |
| Cloudflare deployment step fails | Missing or invalid secrets | Re-check `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` |
| Assets return 404 after deploy | Wrong Vite base path | Ensure the `CF_PAGES_BUILD: 'true'` env var is set in both Cloudflare workflows' build steps — this tells Vite to use base `/` instead of `/SpotRanker/` |
| Spotify login fails on the live site | Wrong redirect URI | Ensure `VITE_SPOTIFY_REDIRECT_URI` matches the Cloudflare Pages URL and is registered in Spotify |
| Blank page / 404 on reload | Missing `_redirects` | Confirm `public/_redirects` is present and contains `/* /index.html 200` |
| HTTP 5xx on smoke test | Cloudflare propagation delay | Wait a few minutes and visit the URL manually |
