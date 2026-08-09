// Anonymous Spotify web-player access-token manager.
//
// Mints a token without any user login by signing the token request with a TOTP
// derived from the current web-player secret (see secrets.ts / totp.ts). Tokens
// are cached in module scope for the isolate's lifetime and refreshed shortly
// before expiry. Anonymous tokens can read public playlists and profiles.

import { getSecrets } from './secrets';
import { deriveKeyFromCipher, generateTotp } from './totp';

const TOKEN_URL = 'https://open.spotify.com/api/token';
const SERVER_TIME_URL = 'https://open.spotify.com/';

// A realistic desktop browser UA — Spotify's token endpoint rejects obviously
// non-browser clients.
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export class TokenError extends Error {}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

interface TokenResponse {
  accessToken?: string;
  accessTokenExpirationTimestampMs?: number;
  isAnonymous?: boolean;
}

let cachedToken: CachedToken | null = null;

/** Spotify's TOTP validation compares against edge-server time, not ours. */
async function fetchServerTimeSeconds(): Promise<number> {
  try {
    const res = await fetch(SERVER_TIME_URL, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const ms = Date.parse(dateHeader);
      if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    }
    console.warn(
      JSON.stringify({ evt: 'server_time_fallback', status: res.status, reason: 'no date header' }),
    );
  } catch (e) {
    // Worth logging: if open.spotify.com is unreachable from this egress IP,
    // this is the first (otherwise silent) symptom and token minting will fail next.
    console.warn(
      JSON.stringify({
        evt: 'server_time_fallback',
        reason: e instanceof Error ? e.message : String(e),
      }),
    );
  }
  return Math.floor(Date.now() / 1000);
}

async function requestToken(
  otp: string,
  version: number,
  reason: string,
): Promise<TokenResponse | null> {
  const url = new URL(TOKEN_URL);
  url.searchParams.set('reason', reason);
  url.searchParams.set('productType', 'web-player');
  url.searchParams.set('totp', otp);
  url.searchParams.set('totpServer', otp);
  url.searchParams.set('totpVer', String(version));

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Referer: 'https://open.spotify.com/',
      Origin: 'https://open.spotify.com',
      'App-Platform': 'WebPlayer',
    },
  });
  if (!res.ok) {
    // The prime suspect when playlists silently degrade: a non-ok here is
    // indistinguishable from a malformed body upstream, so surface it.
    let body = '';
    try {
      body = (await res.text()).trim().slice(0, 200);
    } catch {
      // body unreadable — status alone still tells us most of the story
    }
    console.error(
      JSON.stringify({ evt: 'token_mint_rejected', status: res.status, version, reason, body }),
    );
    return null;
  }
  return (await res.json()) as TokenResponse;
}

/** Mint (or reuse a cached) anonymous web-player access token. */
export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - 30_000) {
    return cachedToken.accessToken;
  }

  const secrets = await getSecrets();
  if (secrets.length === 0) throw new TokenError('Keine TOTP-Secrets verfügbar');

  const serverTime = await fetchServerTimeSeconds();

  // Try each known secret version (newest first); for each, attempt
  // reason=transport then reason=init, until one returns a usable token.
  let lastError = '';
  for (const secret of secrets) {
    const key = deriveKeyFromCipher(secret.cipher);
    const otp = await generateTotp(key, serverTime);

    for (const reason of ['transport', 'init']) {
      try {
        const data = await requestToken(otp, secret.version, reason);
        if (data?.accessToken && typeof data.accessTokenExpirationTimestampMs === 'number') {
          cachedToken = {
            accessToken: data.accessToken,
            expiresAtMs: data.accessTokenExpirationTimestampMs,
          };
          return cachedToken.accessToken;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  throw new TokenError(`Anonymes Token konnte nicht erstellt werden${lastError ? ': ' + lastError : ''}`);
}

/** Drop the cached token so the next getToken() re-mints (e.g. after a 401). */
export function invalidateToken(): void {
  cachedToken = null;
}
