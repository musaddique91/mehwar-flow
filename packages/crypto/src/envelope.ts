import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Envelope encryption with AES-256-GCM.
 *
 * - A master key (KEK) lives outside the database (env / secret manager) and is versioned.
 * - Every organization gets its own random data key (DEK). The DEK is stored in the DB only in
 *   "wrapped" form (encrypted by the KEK).
 * - Secrets (OAuth access/refresh tokens, client secrets) are encrypted with the org DEK and
 *   bound to their owner via AAD, so a ciphertext copied to another row/org fails to decrypt.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FORMAT_VERSION = 'v1';

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export interface MasterKeyRing {
  /** Version used for wrapping new data keys. */
  currentVersion: number;
  keys: Map<number, Buffer>;
}

/**
 * Parses a key ring definition such as `"1:<base64>,2:<base64>"`.
 * Each key must decode to exactly 32 bytes.
 */
export function parseMasterKeyRing(spec: string, currentVersion: number): MasterKeyRing {
  const keys = new Map<number, Buffer>();
  for (const entry of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const sep = entry.indexOf(':');
    if (sep <= 0) throw new CryptoError('Master key entries must look like "<version>:<base64>"');
    const version = Number(entry.slice(0, sep));
    if (!Number.isInteger(version) || version <= 0) {
      throw new CryptoError(`Invalid master key version "${entry.slice(0, sep)}"`);
    }
    const key = Buffer.from(entry.slice(sep + 1), 'base64');
    if (key.length !== KEY_BYTES) {
      throw new CryptoError(`Master key v${version} must be ${KEY_BYTES} bytes (base64 encoded)`);
    }
    if (keys.has(version)) throw new CryptoError(`Duplicate master key version ${version}`);
    keys.set(version, key);
  }
  if (!keys.has(currentVersion)) {
    throw new CryptoError(`Current master key version ${currentVersion} is not in the key ring`);
  }
  return { currentVersion, keys };
}

export function generateKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  if (key.length !== KEY_BYTES) throw new CryptoError('Key must be 32 bytes');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

function open(key: Buffer, sealed: string, aad: string): Buffer {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new CryptoError('Unsupported ciphertext format');
  }
  const [, ivB64, tagB64, dataB64] = parts as [string, string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
    throw new CryptoError('Malformed ciphertext');
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  } catch {
    throw new CryptoError('Decryption failed (wrong key, wrong context or tampered data)');
  }
}

export interface WrappedDataKey {
  wrappedKey: string;
  keyVersion: number;
}

/** Creates a new random data key and returns both the plaintext key and its wrapped form. */
export function createDataKey(
  ring: MasterKeyRing,
  ownerId: string,
): WrappedDataKey & { key: Buffer } {
  const key = generateKey();
  return { key, ...wrapDataKey(ring, key, ownerId) };
}

export function wrapDataKey(ring: MasterKeyRing, key: Buffer, ownerId: string): WrappedDataKey {
  const kek = ring.keys.get(ring.currentVersion)!;
  return {
    wrappedKey: seal(kek, key, `dek:${ownerId}`),
    keyVersion: ring.currentVersion,
  };
}

export function unwrapDataKey(
  ring: MasterKeyRing,
  wrapped: WrappedDataKey,
  ownerId: string,
): Buffer {
  const kek = ring.keys.get(wrapped.keyVersion);
  if (!kek) throw new CryptoError(`Master key v${wrapped.keyVersion} is not available`);
  return open(kek, wrapped.wrappedKey, `dek:${ownerId}`);
}

/**
 * Re-wraps a data key with the current master key. Used when rotating the KEK: secrets encrypted
 * with the data key remain valid, only the small wrapped key row changes.
 */
export function rewrapDataKey(
  ring: MasterKeyRing,
  wrapped: WrappedDataKey,
  ownerId: string,
): WrappedDataKey {
  if (wrapped.keyVersion === ring.currentVersion) return wrapped;
  return wrapDataKey(ring, unwrapDataKey(ring, wrapped, ownerId), ownerId);
}

export function encryptSecret(dataKey: Buffer, plaintext: string, context: string): string {
  return seal(dataKey, Buffer.from(plaintext, 'utf8'), context);
}

export function decryptSecret(dataKey: Buffer, sealed: string, context: string): string {
  return open(dataKey, sealed, context).toString('utf8');
}

/** Constant-time string comparison for tokens/hashes. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
