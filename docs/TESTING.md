# Testing

Die App hat genau **eine** Datenquelle: die öffentlichen Seiten auf
`open.spotify.com`. Es gibt keine Spotify-Web-API, keinen Login und keine
Zugangsdaten. Geprüft wird auf drei Ebenen:

1. **Unit-Tests (Vitest)** — Spotify vollständig gemockt, laufen offline und in CI.
2. **Live-Smoke-Tests** — wenige Tests gegen das echte `open.spotify.com`, nur lokal auf Abruf.
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
  (`tests/helpers/workerEnv.ts`). Der Worker nutzt keine Bindings und ignoriert
  `env`, daher ist das verlustfrei; die Laufzeit-Fidelity deckt die manuelle
  Checkliste unten ab.
- Netzwerk ist per Konstruktion unerreichbar: der `fakeFetch`-Helper
  (`tests/helpers/fakeFetch.ts`) **wirft** bei jeder nicht explizit gemockten
  URL. Ein Test, der echtes Netz bräuchte, schlägt laut fehl.

## 2. Live-Smoke-Tests

```bash
npm run test:live
```

- Datei: `tests/live/spotify.live.test.ts` — Playlist über die Embed-Seite,
  eine Messung, ob der Embed pro Track Artwork liefert, und die
  Cover-Auflösung über oEmbed.
- **Nie in CI**: die Default-Config kennt `tests/live/` nicht (strukturell
  ausgeschlossen), zusätzlich `describe.skipIf(CI)`.
- Braucht **freien Egress** zu `open.spotify.com`. Hinter restriktiven Proxies
  schlagen alle fehl — das ist dann Umgebung, nicht Code.
- Da es nur eine Datenquelle gibt, sind das die **einzigen** Tests, die deren
  Drift bemerken können: geändertes Embed-Layout, verschobener
  `__NEXT_DATA__`-Pfad, oEmbed ohne Thumbnails. Die Unit-Suites laufen
  komplett gegen eingefrorene Fixtures und blieben durch all das grün.

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
| `curl -sD - -o /tmp/p.json localhost:8787/api/playlist/37i9dQZF1DXcBWIGoYBM5M` | `200`, `cache-control: public, max-age=900` |
| `jq '{name, tracks:(.tracks\|length), source, coversMissing}' /tmp/p.json` | Name gesetzt, `tracks > 0`, `source: "embed"` |
| `curl -s 'localhost:8787/api/track-covers?ids=<id1>,<id2>'` | `{"covers":{...}}`, `cache-control: public, max-age=2592000` |
| `curl -si localhost:8787/api/track-covers` | `400` + `{"error":"bad_request"}` |
| `curl -si localhost:8787/api/playlist/0000000000000000000000` | `404` oder `502` (je nachdem, ob Spotify 404 liefert) |
| `curl -si -X POST localhost:8787/api/health` | `405` + `{"error":"method_not_allowed"}` |
| `curl -sI localhost:8787/api/health` | `405` — **Quirk**: Method-Check läuft vor der Health-Route |
| `curl -si 'localhost:8787/api/playlist/%E0%A4%A'` | aktuell `500` (HTML, kein JSON) — **Known Hazard H1** |
| `curl -si localhost:8787/api/user/<id>/playlists` | `200` mit Array, oder `502` falls die Profilseite nichts hergibt |

Ohne freien Egress zu `open.spotify.com` liefern die Inhalts-Routen
`502 scrape_failed` — health/400/405/H1 sind auch dann prüfbar.

### 3.2 Vite-Proxy

```bash
npm run dev            # Vite auf :5173, proxied /api → :8787
```

`http://localhost:5173/api/health` im Browser → `{"ok":true}`.

### 3.3 UI-Walkthrough (http://localhost:5173)

1. **Home**: Link-Feld und „Zum Dashboard". **Kein Login-Element** irgendwo.
2. **Paste-to-add**: volle URL, `spotify:playlist:{id}`-URI und bare 22-Zeichen-Id
   nacheinander einfügen — Playlist erscheint jeweils in der Library.
3. **Profil-Link** mit 22-Zeichen-Id → Picker mit „Hinzufügen"-Buttons.
   Ein realer Username (nicht 22 Zeichen) → Fehlermeldung (**Hazard H4**).
4. **Library-Grid**: Offline-Badge nach dem ersten Öffnen; ✕ entfernt den
   Eintrag; Suchfeld filtert.
5. **Tier-Editor**: Kacheln erscheinen sofort mit 🎵-Platzhalter, die Cover
   füllen sich **nach und nach** auf (Batches à 20). Seite neu laden → Cover
   sind sofort da (aus IndexedDB).
6. **Deep-Link**: `/dashboard?add=<playlist-url>` → wird automatisch hinzugefügt.
7. **Ranking-Schutz**: Tracks einordnen, „Aktualisieren" drücken → Einordnung
   bleibt erhalten, auch wenn die neue Liste kürzer ist.

## 4. Diagnose in Produktion

`wrangler.jsonc` hat `observability.enabled`, die Logs stehen also im
Cloudflare-Dashboard (oder live via `npx wrangler tail`).

| Event | Bedeutung |
|---|---|
| `scrape_failed` | Die Quelle hat nicht geliefert. `reason` ist die Klasse, `message` der Originalfehler. |

| `reason` | Ursache | Nächster Schritt |
|---|---|---|
| `upstream` | `open.spotify.com` hat mit Fehler geantwortet, oder die Seite war nicht parsebar | Bei „`__NEXT_DATA__` nicht gefunden" / „Entity fehlt" hat Spotify das Seitenlayout geändert — `worker/providers/embed.ts` bzw. `userPage.ts` anpassen. |
| `network` | fetch selbst fehlgeschlagen | DNS/TLS/Subrequest-Limit; meist transient. |

Cover-Fehler tauchen hier **nicht** auf: sie sind pro Track optional und werden
still zu `null`. Bleiben Cover dauerhaft leer, ist entweder oEmbed nicht
erreichbar oder es liefert keine `thumbnail_url` mehr — mit
`curl 'https://open.spotify.com/oembed?url=spotify:track:<id>'` prüfbar.

## Known Hazards

Tests mit Präfix `KNOWN HAZARD:` asserten das **Ist**-Verhalten. Beim Fix
schlägt der jeweilige Test an und die Assertion wird auf das Soll gedreht.

| # | Ist | Soll | Test |
|---|---|---|---|
| H1 | `decodeURIComponent` wirft außerhalb des try/catch → unbehandelte Exception (workerd: 500-HTML) | `400` + `{"error":"bad_request"}` | `tests/worker/index.routes.test.ts` |
| H3 | `evil.spotify.com` passiert den Host-Check | Hosts auf `open.`/`play.`/`www.`/apex einschränken | `tests/frontend/spotifyUrl.test.ts` |
| H4 | User-Ids müssen exakt 22 Base62-Zeichen sein → reale Profil-URLs werden abgelehnt | eigenes, lockereres Muster für Usernames | `tests/frontend/spotifyUrl.test.ts` |

*(H2 — die Paginierungs-Endlosschleife — ist mit dem v1-Provider entfallen.)*

## Bekannte Grenzen der Quelle

Keine Fehler, sondern Eigenschaften des Embed-Pfads:

- **Trackzahl gekappt.** Die Embed-Seite liefert typischerweise ~100 Einträge;
  längere Playlists werden abgeschnitten. `trackCount` ist die Länge der
  gelieferten Liste, nicht die echte Gesamtzahl.
- **Kein Besitzername** — die Karte zeigt „Unbekannt".
- **Keine Album-Namen** pro Track (nur Cover über oEmbed).
- **Private Playlists** sind grundsätzlich nicht erreichbar.

## Deferred (bewusst noch nicht abgedeckt)

- **`playlists`-Store-Tests**: brauchen `fake-indexeddb` plus Zähmung der
  Import-Zeit-Seiteneffekte von `offlineDb.ts` — eigener Meilenstein. Damit
  wäre auch `backfillCovers` direkt testbar (heute nur über den Endpunkt).
- **Typ-Drift** zwischen `worker/types.ts` und `src/types/spotify.ts`: besser
  durch Deduplizieren lösen als durch Tests zementieren.
- **Vue-Component-Tests**, Coverage-Schwellen.
