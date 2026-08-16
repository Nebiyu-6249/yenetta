import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret-cipher';

describe('secret-cipher', () => {
  const key = 'test-key-material';

  it('round-trips a secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptSecret(encryptSecret(secret, key), key)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same', key)).not.toBe(encryptSecret('same', key));
  });

  it('fails to decrypt with the wrong key', () => {
    expect(() => decryptSecret(encryptSecret('secret', key), 'other-key')).toThrow();
  });

  it('rejects a tampered ciphertext (auth tag)', () => {
    const enc = encryptSecret('secret', key);
    const [iv, tag, data] = enc.split(':');
    const flipped = data.slice(0, -1) + (data.slice(-1) === '0' ? '1' : '0');
    expect(() => decryptSecret(`${iv}:${tag}:${flipped}`, key)).toThrow();
  });
});
