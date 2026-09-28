import {
  createDataKey,
  decryptSecret,
  encryptSecret,
  parseMasterKeyRing,
  unwrapDataKey,
  type MasterKeyRing,
  type WrappedDataKey,
} from '@mehwar/crypto';
import type { PrismaClient } from '@prisma/client';
import { withSystemTransaction } from './tenant';

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Token vault shared by the API and the worker. Secrets are encrypted with the organization's
 * data key, which is stored wrapped by the master key ring. Contexts bind a ciphertext to its row.
 */
export class TokenVault {
  private readonly cache = new Map<string, { key: Buffer; expires: number }>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly ring: MasterKeyRing,
  ) {}

  static fromEnv(prisma: PrismaClient, keys: string, currentVersion: number): TokenVault {
    return new TokenVault(prisma, parseMasterKeyRing(keys, currentVersion));
  }

  newOrganizationKey(organizationId: string): WrappedDataKey {
    const { wrappedKey, keyVersion } = createDataKey(this.ring, organizationId);
    return { wrappedKey, keyVersion };
  }

  async encrypt(organizationId: string, plaintext: string, context: string): Promise<string> {
    return encryptSecret(
      await this.dataKey(organizationId),
      plaintext,
      `${organizationId}:${context}`,
    );
  }

  async decrypt(organizationId: string, sealed: string, context: string): Promise<string> {
    return decryptSecret(
      await this.dataKey(organizationId),
      sealed,
      `${organizationId}:${context}`,
    );
  }

  private async dataKey(organizationId: string): Promise<Buffer> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expires > Date.now()) return cached.key;
    const org = await withSystemTransaction(this.prisma, (tx) =>
      tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { wrappedDataKey: true, dataKeyVersion: true },
      }),
    );
    const key = unwrapDataKey(
      this.ring,
      { wrappedKey: org.wrappedDataKey, keyVersion: org.dataKeyVersion },
      organizationId,
    );
    this.cache.set(organizationId, { key, expires: Date.now() + CACHE_TTL_MS });
    return key;
  }
}

/** Credential contexts, so an access token can never be decrypted as another row's token. */
export const credentialContext = {
  access: (channelId: string) => `channel:${channelId}:access`,
  refresh: (channelId: string) => `channel:${channelId}:refresh`,
};
