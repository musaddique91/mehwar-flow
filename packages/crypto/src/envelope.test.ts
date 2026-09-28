import { describe, expect, it } from 'vitest';
import {
  createDataKey,
  CryptoError,
  decryptSecret,
  encryptSecret,
  generateKey,
  parseMasterKeyRing,
  rewrapDataKey,
  unwrapDataKey,
} from './envelope';

const k1 = generateKey().toString('base64');
const k2 = generateKey().toString('base64');

describe('master key ring', () => {
  it('parses versioned keys', () => {
    const ring = parseMasterKeyRing(`1:${k1}, 2:${k2}`, 2);
    expect(ring.currentVersion).toBe(2);
    expect(ring.keys.size).toBe(2);
  });

  it('rejects short keys, bad versions and a missing current version', () => {
    expect(() => parseMasterKeyRing('1:c2hvcnQ=', 1)).toThrow(CryptoError);
    expect(() => parseMasterKeyRing(`x:${k1}`, 1)).toThrow(CryptoError);
    expect(() => parseMasterKeyRing(`1:${k1}`, 2)).toThrow(CryptoError);
    expect(() => parseMasterKeyRing(`1:${k1},1:${k2}`, 1)).toThrow(CryptoError);
  });
});

describe('envelope encryption', () => {
  const ring = parseMasterKeyRing(`1:${k1}`, 1);

  it('round-trips a secret through a wrapped data key', () => {
    const dek = createDataKey(ring, 'org-a');
    const sealed = encryptSecret(dek.key, 'ya29.access-token', 'channel:1:access');
    expect(sealed).not.toContain('ya29');

    const key = unwrapDataKey(ring, dek, 'org-a');
    expect(decryptSecret(key, sealed, 'channel:1:access')).toBe('ya29.access-token');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const { key } = createDataKey(ring, 'org-a');
    expect(encryptSecret(key, 'same', 'ctx')).not.toBe(encryptSecret(key, 'same', 'ctx'));
  });

  it('fails when the context (AAD) does not match', () => {
    const { key } = createDataKey(ring, 'org-a');
    const sealed = encryptSecret(key, 'secret', 'channel:1:access');
    expect(() => decryptSecret(key, sealed, 'channel:2:access')).toThrow(CryptoError);
  });

  it('fails when the data key is unwrapped for another owner', () => {
    const dek = createDataKey(ring, 'org-a');
    expect(() => unwrapDataKey(ring, dek, 'org-b')).toThrow(CryptoError);
  });

  it('detects tampering', () => {
    const { key } = createDataKey(ring, 'org-a');
    const sealed = encryptSecret(key, 'secret', 'ctx');
    const parts = sealed.split('.');
    const data = Buffer.from(parts[3]!, 'base64');
    data[0] = data[0]! ^ 0xff;
    parts[3] = data.toString('base64');
    expect(() => decryptSecret(key, parts.join('.'), 'ctx')).toThrow(CryptoError);
    expect(() => decryptSecret(key, 'v0.a.b.c', 'ctx')).toThrow(CryptoError);
  });

  it('supports master key rotation without re-encrypting secrets', () => {
    const dek = createDataKey(ring, 'org-a');
    const sealed = encryptSecret(dek.key, 'refresh-token', 'ctx');

    const rotated = parseMasterKeyRing(`1:${k1},2:${k2}`, 2);
    const rewrapped = rewrapDataKey(rotated, dek, 'org-a');
    expect(rewrapped.keyVersion).toBe(2);

    const onlyNew = parseMasterKeyRing(`2:${k2}`, 2);
    const key = unwrapDataKey(onlyNew, rewrapped, 'org-a');
    expect(decryptSecret(key, sealed, 'ctx')).toBe('refresh-token');
    expect(() => unwrapDataKey(onlyNew, dek, 'org-a')).toThrow(/not available/);
  });
});
