// Shared error types and HTTP identity for the scraper.
//
// Everything here used to live inside the (now removed) Spotify Web API layer.
// The scraper talks only to open.spotify.com, so these no longer belong to any
// single provider.

export class ProviderError extends Error {
  /** HTTP status when the failure came from a response (absent for throws). */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** The resource does not exist or is not public. Never worth a retry. */
export class NotFoundError extends ProviderError {}

/** A provider failed in a way the caller should surface as 502. */
export class ScrapeError extends Error {}

// open.spotify.com serves a different (JS-only) page to obviously non-browser
// clients, so requests carry a realistic desktop UA.
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
