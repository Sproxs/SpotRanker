// Structure-faithful stand-in for the open.spotify.com/embed/playlist/{id}
// page. Mirrors exactly the path worker/providers/embed.ts reads:
// props.pageProps.state.data.entity with coverArt.sources[] and
// trackList[{uri,title,subtitle}]. (Captured-from-live was not possible in the
// authoring environment — network policy blocks open.spotify.com — so this is
// hand-built against the parser's contract; the live smoke test in
// tests/live/ is the canary for real-world drift of the embed markup.)

export const EMBED_ENTITY = {
  name: 'Fixture Playlist',
  title: 'Fixture Playlist',
  subtitle: 'Fixture subtitle',
  coverArt: {
    sources: [
      { url: 'https://i.scdn.co/image/small' },
      { url: 'https://i.scdn.co/image/medium' },
      { url: 'https://i.scdn.co/image/large' },
    ],
  },
  trackList: [
    { uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', title: 'First Song', subtitle: 'Artist One' },
    { uri: 'spotify:track:7GhIk7Il098yCjg4BQjzvb', title: 'Second Song', subtitle: 'Artist Two' },
    // local file: uri ends with ':' → empty id → filtered out by embed.ts
    { uri: 'spotify:local:', title: 'Local File', subtitle: 'Nobody' },
  ],
};

function page(nextData: string): string {
  return [
    '<!DOCTYPE html><html><head><title>Embed</title></head><body>',
    '<div id="root"></div>',
    `<script id="__NEXT_DATA__" type="application/json">${nextData}</script>`,
    '</body></html>',
  ].join('\n');
}

/** Happy path: well-formed page with the entity above. */
export const EMBED_HTML_OK = page(
  JSON.stringify({ props: { pageProps: { state: { data: { entity: EMBED_ENTITY } } } } }),
);

/** No __NEXT_DATA__ script at all → 'Embed __NEXT_DATA__ nicht gefunden'. */
export const EMBED_HTML_NO_SCRIPT =
  '<!DOCTYPE html><html><body><div id="root">nothing here</div></body></html>';

/** Script present but not JSON → 'Embed-JSON konnte nicht geparst werden'. */
export const EMBED_HTML_BAD_JSON = page('{this is not: valid json');

/** Valid JSON but the entity path is missing → 'Embed-Entity fehlt'. */
export const EMBED_HTML_NO_ENTITY = page(
  JSON.stringify({ props: { pageProps: { state: { data: {} } } } }),
);
