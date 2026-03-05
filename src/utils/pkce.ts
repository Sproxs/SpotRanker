/**
 * PKCE (Proof Key for Code Exchange) utilities for Spotify OAuth 2.0.
 *
 * Uses the Web Crypto API — no external dependencies required.
 * All outputs are Base64-URL-encoded (no padding) per RFC 7636.
 */

/**
 * Generate a cryptographically random code verifier string.
 * Length must be 43–128 characters (RFC 7636 §4.1).
 * We use 64 random bytes → 86 Base64URL chars.
 */
export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return base64UrlEncode(bytes);
}

/**
 * Generate a random `state` parameter for CSRF protection.
 * 32 random bytes → 43 Base64URL chars.
 */
export function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

/**
 * Derive the PKCE code challenge from the verifier (SHA-256 + Base64URL).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64-URL-encode a Uint8Array (no padding, URL-safe alphabet).
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
