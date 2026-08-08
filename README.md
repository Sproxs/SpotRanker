# SpotRanker

> A Progressive Web App to create S/A/B/C/D tier lists from your Spotify playlists — works fully offline, no backend required.

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5a0fc8?logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

---

## About

**SpotRanker** turns any public Spotify playlist into a classic S / A / B / C / D tier list — just paste a playlist (or profile) link, **no Spotify login required**. Data is fetched by a built-in scraper backend running as a Cloudflare Worker under `/api/*`, so there are no API credentials or premium account to manage. Signing in with Spotify is still optional and unlocks ranking your own **private** playlists. Rankings are saved locally in your browser (IndexedDB), so you can close the tab and pick up right where you left off — even offline after the first load.

---

## Features

- 🔗 **No login needed** — paste a public playlist or profile link; a built-in scraper (Cloudflare Worker) fetches the data
- 🔐 **Optional Spotify OAuth 2.0 (PKCE)** — sign in only to rank your own private playlists
- 🎵 **Local library** — added playlists persist across reloads
- 🖱️ **Drag & Drop** — move tracks between tiers with smooth animations
- 💾 **Offline persistence** — rankings stored in IndexedDB via localForage
- 🔄 **Refresh** — re-sync a playlist's tracks from Spotify on demand
- 📸 **Export as image** — download your tier list as a PNG
- 📤 **Share** — native Web Share API with clipboard fallback
- 📱 **Installable PWA** — add to home screen on mobile or desktop

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| Build tool | [Vite 6](https://vitejs.dev/) |
| State | [Pinia](https://pinia.vuejs.org/) |
| Routing | [Vue Router 4](https://router.vuejs.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Drag & Drop | [vuedraggable 4](https://github.com/SortableJS/vue.draggable.next) |
| Image Export | [html2canvas](https://html2canvas.hertzen.com/) |
| Offline Storage | [localForage](https://localforage.github.io/localForage/) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) |

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- A [Spotify Developer](https://developer.spotify.com/dashboard) application with the redirect URI configured

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Sproxs/SpotRanker.git
cd SpotRanker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Spotify app credentials:

```bash
cp .env.example .env
```

Open `.env` and set the following variables:

```env
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

You can obtain a Client ID from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Make sure `http://localhost:5173/callback` is added to the **Redirect URIs** of your app.

### 4. Start the development server

The frontend and the scraper Worker run as two processes. In one terminal:

```bash
npm run dev          # Vite dev server on http://localhost:5173
```

In a second terminal:

```bash
npm run dev:worker   # wrangler dev on http://localhost:8787 (serves /api/*)
```

Vite proxies `/api` to the Worker, so the app works end-to-end at `http://localhost:5173`.
The `.env` step above is only needed for the optional Spotify login — the scraper needs no credentials.

### 5. Run the tests

```bash
npm test             # Vitest unit suite (Spotify fully mocked, runs offline)
```

Live smoke tests against real Spotify and the manual E2E checklist are described in
[docs/TESTING.md](docs/TESTING.md).

### 6. Build for production

```bash
npm run build
```

Static output is placed in the `dist/` directory.

Pushes to `main` are deployed automatically to Cloudflare, which builds the project straight from
this repository — see [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md).

---

## Usage

1. Open the app and paste a public Spotify **playlist link** (or a **profile link** to list that profile's public playlists) — no login needed.
2. The playlist is added to your local **library** on the Dashboard. Click it to open the **Tier Editor**.
3. Drag tracks from the **Unranked Pool** at the bottom into the S / A / B / C / D rows.
4. Your ranking is saved automatically — navigate away and come back anytime.
5. Use **Save as Image** to download a PNG of your tier list, or **Share** to send it directly.
6. *(Optional)* Click **Login with Spotify** to also rank your own **private** playlists.

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please make sure your code passes the type-check before submitting:

```bash
npm run type-check
```

---

## License

Distributed under the [MIT License](LICENSE).

