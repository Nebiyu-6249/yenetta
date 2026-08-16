import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Self-contained RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits) plus the RFC
 * 4648 base32 codec authenticator apps expect. Implemented with node:crypto so
 * MFA adds no third-party dependency (supply-chain surface, BUILD_BRIEF security
 * delta). Verified against the RFC 6238 test vectors in totp.test.ts.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Encodes bytes as RFC 4648 base32 without padding (upper-case). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Decodes an RFC 4648 base32 string (padding and casing tolerant). */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generates a fresh base32-encoded TOTP secret (default 20 random bytes). */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

/** RFC 4226 HOTP: a `digits`-length code for a specific counter. */
function hotp(key: Buffer, counter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  // Counter is a 64-bit big-endian integer; JS bit ops are 32-bit, so split.
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  // Dynamic truncation (RFC 4226 §5.3): 4 big-endian bytes, high bit cleared.
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** Computes the TOTP code for a base32 secret at the given time (ms). */
export function totpCode(
  base32Secret: string,
  atMs: number = Date.now(),
  digits: number = TOTP_DIGITS,
  stepSeconds: number = TOTP_STEP_SECONDS,
): string {
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  return hotp(base32Decode(base32Secret), counter, digits);
}

/**
 * Verifies a submitted code, accepting the adjacent time steps within `window`
 * to tolerate clock drift. Uses a constant-time compare to avoid leaking timing.
 */
export function verifyTotp(
  base32Secret: string,
  token: string,
  atMs: number = Date.now(),
  window = 1,
  digits: number = TOTP_DIGITS,
  stepSeconds: number = TOTP_STEP_SECONDS,
): boolean {
  const normalized = token.trim();
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) {
    return false;
  }
  const key = base32Decode(base32Secret);
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  for (let error = -window; error <= window; error++) {
    const candidate = hotp(key, counter + error, digits);
    const a = Buffer.from(candidate);
    const b = Buffer.from(normalized);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

/** Builds the otpauth:// provisioning URI an authenticator app scans. */
export function otpauthUri(base32Secret: string, accountLabel: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
