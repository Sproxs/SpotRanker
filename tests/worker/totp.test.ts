import { describe, expect, it } from 'vitest';
import { deriveKeyFromCipher, generateTotp } from '../../worker/totp';

// RFC 6238 Appendix B test vectors for HMAC-SHA1, secret "12345678901234567890".
// The RFC lists 8-digit OTPs; the implementation defaults to 6 digits, which by
// construction equals the last 6 digits of the 8-digit value.
const RFC_KEY = new TextEncoder().encode('12345678901234567890');
const RFC_VECTORS: Array<{ time: number; otp8: string }> = [
  { time: 59, otp8: '94287082' },
  { time: 1111111109, otp8: '07081804' },
  { time: 1111111111, otp8: '14050471' },
  { time: 1234567890, otp8: '89005924' },
  { time: 2000000000, otp8: '69279037' },
  { time: 20000000000, otp8: '65353130' },
];

describe('generateTotp (RFC 6238 SHA-1 vectors)', () => {
  for (const { time, otp8 } of RFC_VECTORS) {
    it(`T=${time} → ${otp8.slice(-6)} (6-digit)`, async () => {
      await expect(generateTotp(RFC_KEY, time)).resolves.toBe(otp8.slice(-6));
    });

    it(`T=${time} → ${otp8} (8-digit)`, async () => {
      await expect(generateTotp(RFC_KEY, time, 30, 8)).resolves.toBe(otp8);
    });
  }

  it('pads leading zeros to the requested width', async () => {
    // T=1111111109 8-digit vector starts with 0 → proves padStart is effective.
    await expect(generateTotp(RFC_KEY, 1111111109, 30, 8)).resolves.toBe('07081804');
  });
});

describe('deriveKeyFromCipher', () => {
  it('XORs with ((i % 33) + 9) and joins decimal values as UTF-8', () => {
    // [1, 2, 3] → [1^9, 2^10, 3^11] = [8, 8, 8] → "888"
    expect(deriveKeyFromCipher([1, 2, 3])).toEqual(new TextEncoder().encode('888'));
  });

  it('empty cipher yields an empty key', () => {
    expect(deriveKeyFromCipher([])).toEqual(new Uint8Array(0));
  });

  it('index wraps at 33', () => {
    const cipher = new Array<number>(34).fill(0);
    const derived = deriveKeyFromCipher(cipher);
    const expected = new TextEncoder().encode(
      cipher.map((v, i) => v ^ ((i % 33) + 9)).join(''),
    );
    expect(derived).toEqual(expected);
    // byte 0 and byte 33 use the same XOR constant (9)
    expect(cipher[0] ^ 9).toBe(cipher[33] ^ 9);
  });
});
