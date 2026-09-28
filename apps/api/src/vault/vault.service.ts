import { Inject, Injectable } from '@nestjs/common';
import {
  createDataKey,
  decryptSecret,
  encryptSecret,
  parseMasterKeyRing,
  unwrapDataKey,
  type MasterKeyRing,
  type WrappedDataKey,
} from '@mehwar/crypto';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Token vault: encrypts third-party secrets with the organization's data key. Plaintext secrets
 * never leave the backend and are never logged.
 */
@Injectable()
export class VaultService {
  private readonly ring: MasterKeyRing;
  private readonly cache = new Map<string, { key: Buffer; expires: number }>();

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    this.ring = parseMasterKeyRing(config.MASTER_KEYS, config.MASTER_KEY_CURRENT_VERSION);
  }

  /** Creates the wrapped data key for a new organization. */
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
    const org = await this.prisma.tenant(organizationId).organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { wrappedDataKey: true, dataKeyVersion: true },
    });
    const key = unwrapDataKey(
      this.ring,
      { wrappedKey: org.wrappedDataKey, keyVersion: org.dataKeyVersion },
      organizationId,
    );
    this.cache.set(organizationId, { key, expires: Date.now() + CACHE_TTL_MS });
    return key;
  }
}
