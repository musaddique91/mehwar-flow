import { Injectable } from '@nestjs/common';
import type { WrappedDataKey } from '@mehwar/crypto';
import { TokenVault } from '@mehwar/db';

/** Nest-facing wrapper around the shared {@link TokenVault} (also used by the worker). */
@Injectable()
export class VaultService {
  constructor(private readonly vault: TokenVault) {}

  newOrganizationKey(organizationId: string): WrappedDataKey {
    return this.vault.newOrganizationKey(organizationId);
  }

  encrypt(organizationId: string, plaintext: string, context: string): Promise<string> {
    return this.vault.encrypt(organizationId, plaintext, context);
  }

  decrypt(organizationId: string, sealed: string, context: string): Promise<string> {
    return this.vault.decrypt(organizationId, sealed, context);
  }
}
