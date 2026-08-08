// RFC 6238 TOTP (HMAC-SHA1) used to sign anonymous Spotify web-player token
// requests. Implemented with Web Crypto only — no npm dependency.
//
// This file plus token.ts is the single place to patch if Spotify changes the
// web-player secret derivation or the TOTP parameters (highest churn risk).

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

/**
 * Standard RFC 6238 TOTP: HMAC-SHA1 over a 30-second counter, 6 digits.
 * `keyBytes` is the raw HMAC key already derived via deriveKeyFromCipher().
 */
export async function generateTotp(
  keyBytes: Uint8Array,
  timeSeconds: number,
  step = 30,
  digits = 6,
): Promise<string> {
  let counter = Math.floor(timeSeconds / step);
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  const hash = await hmacSha1(keyBytes, counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

/**
 * Derive the HMAC key from Spotify's published cipher-byte array.
 *
 * Community transform: XOR each byte with ((index % 33) + 9), join the resulting
 * decimal values into one string, and use that string's UTF-8 bytes as the key.
 * (Reference implementations base32-encode then base32-decode this value before
 * use, an identity round-trip, so we take the UTF-8 bytes directly.)
 */
export function deriveKeyFromCipher(cipher: number[]): Uint8Array {
  const transformed = cipher.map((value, index) => value ^ ((index % 33) + 9));
  const joined = transformed.join('');
  return new TextEncoder().encode(joined);
}
