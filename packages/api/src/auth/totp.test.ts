import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from './totp';

// RFC 6238 shared secret "12345678901234567890" (ASCII) in base32.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('base32 codec', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from('The quick brown fox', 'utf8');
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });

  it('decodes the RFC test secret back to ASCII', () => {
    expect(base32Decode(RFC_SECRET).toString('ascii')).toBe('12345678901234567890');
  });
});

describe('totpCode', () => {
  // RFC 6238 Appendix B vectors for SHA1 (truncated to 6 digits).
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
  ])('matches the RFC 6238 vector at T=%i', (seconds, expected) => {
    expect(totpCode(RFC_SECRET, seconds * 1000)).toBe(expected);
  });
});

describe('verifyTotp', () => {
  it('accepts the current code', () => {
    const now = Date.now();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now), now)).toBe(true);
  });

  it('accepts a code from the adjacent step (clock drift)', () => {
    const now = Date.now();
    const prev = totpCode(RFC_SECRET, now - 30_000);
    expect(verifyTotp(RFC_SECRET, prev, now, 1)).toBe(true);
  });

  it('rejects a code two steps away', () => {
    const now = Date.now();
    const stale = totpCode(RFC_SECRET, now - 90_000);
    expect(verifyTotp(RFC_SECRET, stale, now, 1)).toBe(false);
  });

  it('rejects malformed input', () => {
    const now = Date.now();
    expect(verifyTotp(RFC_SECRET, 'abcdef', now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBe(false);
  });
});

describe('generateTotpSecret + otpauthUri', () => {
  it('generates a decodable base32 secret', () => {
    const secret = generateTotpSecret();
    expect(() => base32Decode(secret)).not.toThrow();
    expect(base32Decode(secret).length).toBe(20);
  });

  it('builds a scannable provisioning URI', () => {
    const uri = otpauthUri('ABCDEFGH', '+251900000001', 'Yenetta');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=ABCDEFGH');
    expect(uri).toContain('issuer=Yenetta');
  });
});
