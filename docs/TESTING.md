# Testing

Der Scraper (Cloudflare Worker unter `worker/`, Frontend-Anbindung unter
`src/`) wird auf drei Ebenen geprüft:

1. **Unit-Tests (Vitest)** — Spotify vollständig gemockt, laufen offline und in CI.
2. **Live-Smoke-Tests** — wenige Tests gegen echtes Spotify, nur lokal auf Abruf.
3. **Manuelle E2E-Checkliste** — `wrangler dev` + curl + UI-Durchlauf.

## 1. Unit-Tests

```bash
npm test          # einmalig (CI-Modus)
npm run test:watch
```

- Konfiguration: `vitest.config.ts`, zwei Projekte — `worker` (node) und
  `frontend` (happy-dom). Tests liegen in `tests/` (bewusst außerhalb jedes
  tsconfig-Include, damit `vue-tsc -b` sie nie in den Produktions-Build zieht).
- Der Worker läuft in den Tests unter Node, nicht unter workerd:
  `caches.default` wird durch einen In-Memory-Stub ersetzt
  (`tests/helpers/workerEnv.ts`), `crypto.subtle` ist in Node nativ. Der
  Worker nutzt keine Bindings/Env-Vars, daher ist das verlustfrei; die
  Laufzeit-Fidelity deckt die manuelle Checkliste unten ab.
- Netzwerk ist per Konstruktion unerreichbar: der `fakeFetch`-Helper
  (`tests/helpers/fakeFetch.ts`) **wirft** bei jeder nicht explizit
  gemockten URL. Ein Test, der echtes Netz bräuchte, schlägt laut fehl.

## 2. Live-Smoke-Tests

```bash
npm run test:live
```

- Datei: `tests/live/spotify.live.test.ts` — Token-Mint, `getPlaylist` gegen
  „Today's Top Hits" (nur Shape-Assertions) und der Embed-Fallback als
  Kanarienvogel für Änderungen am `__NEXT_DATA__`-Markup.
- **Nie in CI**: die Default-Config kennt `tests/live/` nicht (strukturell
  ausgeschlossen, kein vergessbares `--exclude`), zusätzlich `describe.skipIf(CI)`.
- Braucht **freien Egress** zu `open.spotify.com`, `api.spotify.com`,
  `spclient.wg.spotify.com`. Hinter restriktiven Proxies (z. B. Claude-Code-
  Cloud-Container: 403 auf CONNECT zu Spotify) schlagen alle drei fehl —
  das ist dann Umgebung, nicht Code.
- Gelegentliche Flakiness ist der Zweck: Rate-Limits, rotierte
  Web-Player-Secrets oder geändertes Embed-Markup sollen hier auffallen,
  bevor Nutzer sie treffen.

## 3. Manuelle E2E-Checkliste

### 3.1 Worker-Smoke (wrangler dev + curl)

Voraussetzung: einmal bauen (wrangler served `./dist`), dann Worker starten:

```bash
npm run build
npm run dev:worker     # wrangler dev --port 8787
```

| Aufruf | Soll |
|---|---|
| `curl -s localhost:8787/api/health` | `{"ok":true}` |
| `curl -sD - -o /tmp/p.json localhost:8787/api/playlist/37i9dQZF1DXcBWIGoYBM5M` | `200`, `content-type: application/json`, `cache-control: public, max-age=900` |
| `jq '{name, tracks: (.tracks\|length), degraded}' /tmp/p.json` | Name gesetzt, `tracks > 0`, `degraded: false` (v1-Pfad) |
| denselben Playlist-Call wiederholen | deutlich schneller (Edge-Cache, 15 min) |
| `curl -si localhost:8787/api/playlist/0000000000000000000000` | `404` + `{"error":"not_found", …}` |
| `curl -si -X POST localhost:8787/api/health` | `405` + `{"error":"method_not_allowed"}` |
| `curl -sI localhost:8787/api/health` | `405` — **Quirk**: Method-Check läuft vor der Health-Route, HEAD ist kein GET |
| `curl -si 'localhost:8787/api/playlist/%E0%A4%A'` | aktuell `500` (HTML, kein JSON) — **Known Hazard H1**, siehe unten |
| `curl -si localhost:8787/api/user/<22-char-id>/playlists` | `200`, Array; `trackCount` darf 0 sein (profileView-Limitierung) |

Ohne freien Egress zu Spotify liefern die Inhalts-Routen `502 scrape_failed`
— health/404/405/H1 sind auch dann prüfbar.

### 3.2 Vite-Proxy

Zweites Terminal:

```bash
npm run dev            # Vite auf :5173, proxied /api → :8787
```

`http://localhost:5173/api/health` im Browser → `{"ok":true}`.

### 3.3 UI-Walkthrough (http://localhost:5173)

1. **Home**: Link-Feld + „Ohne Login starten" sichtbar; Login-Button nur ohne Session.
2. **Paste-to-add** (Dashboard): nacheinander einfügen —
   volle URL (`https://open.spotify.com/playlist/{id}?si=…`),
   URI (`spotify:playlist:{id}`), bare 22-Zeichen-Id.
   Jeweils: Playlist erscheint in der Library, Eingabefeld wird geleert.
3. **Profil-Link** mit 22-Zeichen-Id → Picker „Playlists des Profils" mit
   „Hinzufügen"-Buttons; bereits vorhandene zeigen „Hinzugefügt ✓".
   Ein realer Username (nicht 22 Zeichen) → Fehlermeldung „Kein gültiger …"
   — **Known Hazard H4**.
4. **Library-Grid**: Offline-Badge nach dem ersten Öffnen einer Playlist;
   ✕ entfernt den Eintrag (inkl. Tracks/Ranking); Suchfeld filtert.
5. **Deep-Link**: `http://localhost:5173/dashboard?add=<playlist-url>` →
   Playlist wird automatisch hinzugefügt, Query verschwindet aus der URL.
6. **Editor ohne Login**: Playlist öffnen, Seite hart neu laden — Tracks
   laden über den Scraper (kein Redirect zur Home).
7. **Degraded-Pfad** *(optional, dev-only)*: `api.spotify.com` temporär
   blocken (Hosts-Datei) oder `fetchPlaylistV1` lokal werfen lassen →
   Playlist lädt über Embed, Karte zeigt das gelbe „Eingeschränkt"-Badge.
   Änderung danach zurücknehmen.

## 4. Scraper-Diagnose in Produktion

Wenn Playlists mit dem Badge „Eingeschränkt" und ohne Song-Cover ankommen, ist
der v1-Provider gescheitert und der Embed-Fallback hat übernommen. Der Embed
liefert per Design keine Track-Cover. Die Frage ist immer: **warum** ist v1
gescheitert?

`wrangler.jsonc` hat `observability.enabled`, die Logs stehen also im
Cloudflare-Dashboard (oder live via `npx wrangler tail`). Relevante Events:

| Event | Bedeutung |
|---|---|
| `provider_fallback` | v1 wurde aufgegeben. `reason` ist die grobe Klasse, `message` der Originalfehler. |
| `token_mint_rejected` | Der Token-Endpunkt hat abgelehnt — `status` + `body` enthalten Spotifys Begründung. Häufigste Ursache eines `reason: "token"`. |
| `secret_refresh_failed` | Eine konfigurierte Remote-Secret-Quelle war nicht erreichbar (standardmäßig ist keine konfiguriert). |
| `server_time_fallback` | `open.spotify.com` war für den HEAD nicht erreichbar — oft das erste Symptom eines Egress-Blocks. |
| `cover_enrichment_failed` | Das Cover-Nachladen via `/v1/tracks` scheiterte; die Playlist bleibt ohne Track-Cover. |
| `covers_enriched` | Cover wurden nachgeladen (`filled` von `of`). |

Die Klassen in `reason` und was sie praktisch bedeuten:

| `reason` | Ursache | Nächster Schritt |
|---|---|---|
| `token` | Anonymes Token nicht erhältlich oder abgelehnt | `token_mint_rejected` lesen. Ist der `body` ein Egress-/Bot-Block, hilft kein Code-Fix. Rotiertes Secret → `FALLBACK_SECRETS` in `worker/secrets.ts` aktualisieren. |
| `rate_limit` | Spotify 429 | Meist transient; `apiGet` wartet einmal kurz (`Retry-After`, max. 2 s). |
| `forbidden` | 401/403 | Token nicht berechtigt, oder Markt-/Playlist-Restriktion. |
| `upstream` | 5xx oder unlesbare Antwort | Spotify-seitig; abwarten. |
| `network` | fetch selbst fehlgeschlagen | DNS/TLS/Subrequest-Limit. |

Der Grund steht zusätzlich in der API-Antwort (`degradedReason`) und im Tooltip
des „Eingeschränkt"-Badges, ist also ohne Log-Zugriff sichtbar.

**Wichtig zur Cache-Wirkung:** degradierte Antworten werden nur **60 s** am Edge
gecacht (vollständige 900 s). Ein Reproduktionsversuch direkt nach einer
Änderung braucht also höchstens eine Minute Wartezeit, nicht eine Viertelstunde.

### Offene Verifikation: Embed-Trackliste

`worker/providers/embed.ts` liest pro Track nur `uri`/`title`/`subtitle`. Ob
Spotify im `__NEXT_DATA__` doch Artwork pro Track mitliefert, ist **unbestätigt**
— das Fixture wurde aus dem Parser abgeleitet, nicht aus einer echten Antwort.
Prüfen (braucht freien Zugang zu `open.spotify.com`):

```bash
curl -sL -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' \
  'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M' \
| sed -n 's/.*<script id="__NEXT_DATA__"[^>]*>\(.*\)<\/script>.*/\1/p' \
| jq '.props.pageProps.state.data.entity.trackList[0]'
```

Enthält die Ausgabe ein Bildfeld, ist das ein reiner Parser-Fix ohne Token und
ohne Zusatz-Requests — deutlich besser als das aktuelle Nachladen via
`/v1/tracks`, das am selben Token hängt, der im Fehlerfall gerade versagt hat.

## Known Hazards

Tests mit Präfix `KNOWN HAZARD:` asserten das **Ist**-Verhalten. Beim Fix
schlägt der jeweilige Test an und die Assertion wird auf das Soll gedreht.

| # | Ist | Soll | Test |
|---|---|---|---|
| H1 | `decodeURIComponent` wirft außerhalb des try/catch → unbehandelte Exception (workerd: 500-HTML) | `400` + `{"error":"bad_request"}` (Code existiert bereits ungenutzt in `worker/types.ts`) | `tests/worker/index.routes.test.ts` |
| H2 | `hasMore = page.next !== null` — `next: undefined` → Endlosschleife | `undefined` wie `null` behandeln (`!= null` / `??`) | `tests/worker/apiV1.test.ts` (Fuse-Muster) |
| H3 | `evil.spotify.com` passiert den Host-Check | Hosts auf `open.`/`play.`/`www.`/apex einschränken | `tests/frontend/spotifyUrl.test.ts` |
| H4 | User-Ids müssen exakt 22 Base62-Zeichen sein → reale Profil-URLs werden abgelehnt | eigenes, lockereres Muster für Usernames | `tests/frontend/spotifyUrl.test.ts` |

## Deferred (bewusst noch nicht abgedeckt)

- **`playlists`-Store-Routing** (`src/stores/playlists.ts`): braucht
  `fake-indexeddb` plus Zähmung der Import-Zeit-Seiteneffekte
  (`offlineDb.ts` erzeugt localforage-Instanzen beim Import,
  `config/spotify.ts` liest `window.location.origin` beim Modul-Load) —
  eigener Meilenstein.
- **Volle Token-Matrix** (Secrets × Reasons in Reihenfolge): der schmale
  Pfad ist abgedeckt, die Kombinatorik lohnt erst bei echter Churn.
- **Typ-Drift** zwischen `worker/types.ts`, `src/types/spotify.ts` und
  `src/services/scraperApi.ts` (drei Kopien desselben Contracts): besser
  durch Deduplizieren lösen als durch Tests zementieren.
- **Vue-Component-Tests**, Coverage-Schwellen.
- **Live-Test für `getUserPlaylists`**: es fehlt ein stabiler bekannter
  Account, dessen Id den 22-Zeichen-Parser passiert (vgl. H4).
