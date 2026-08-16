import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets stored at rest,
 * such as a user's TOTP shared secret. Serialised as `iv:authTag:ciphertext`
 * in hex so the format is self-describing and version-stable.
 *
 * The 32-byte key is derived from a caller-supplied key material with scrypt.
 * Deployments should set a dedicated `MFA_ENCRYPTION_KEY`; in its absence the
 * caller derives material from the JWT secrets so dev still encrypts (never
 * plaintext) without a new required secret.
 */

const IV_BYTES = 12;

function deriveKey(keyMaterial: string): Buffer {
  // Fixed salt: the key material is already high-entropy secret configuration,
  // and a stored random salt would break decryption of previously written rows.
  return scryptSync(keyMaterial, 'yenetta.mfa.secretbox.v1', 32);
}

export function encryptSecret(plaintext: string, keyMaterial: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(serialized: string, keyMaterial: string): string {
  const [ivHex, tagHex, dataHex] = serialized.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted secret');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(keyMaterial),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
