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

**SpotRanker** lets you connect your Spotify account and drag-and-drop tracks from any of your playlists into a classic S / A / B / C / D tier list. Rankings are saved locally in your browser (IndexedDB), so you can close the tab and pick up right where you left off — even without an internet connection after the first load.

---

## Features

- 🔐 **Spotify OAuth 2.0 (PKCE)** — secure login with no server-side secrets
- 🎵 **Playlist browser** — pick any playlist you own or follow
- 🖱️ **Drag & Drop** — move tracks between tiers with smooth animations
- 🔊 **Audio previews** — tap a track tile to hear a 30-second preview
- 💾 **Offline persistence** — rankings stored in IndexedDB via localForage
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

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 5. Build for production

```bash
npm run build
```

Static output is placed in the `dist/` directory and can be served by any static hosting provider (e.g. Vercel, Netlify, GitHub Pages).

---

## Usage

1. Open the app and click **Login with Spotify**.
2. After authorizing, you are taken to your **Dashboard** where your playlists are listed.
3. Click a playlist to open the **Tier Editor**.
4. Drag tracks from the **Unranked Pool** at the bottom into the S / A / B / C / D rows.
5. Your ranking is saved automatically — navigate away and come back anytime.
6. Use **Save as Image** to download a PNG of your tier list, or **Share** to send it directly.

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

