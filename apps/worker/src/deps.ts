import type { ConnectorRegistry } from '@mehwar/connectors';
import type { PrismaClient, TokenVault } from '@mehwar/db';
import type { Storage } from '@mehwar/storage';
import type IORedis from 'ioredis';
import type { Notifier } from './notifier';

/** Everything a processor needs; tests pass fakes. */
export interface WorkerDeps {
  prisma: PrismaClient;
  vault: TokenVault;
  storage: Storage | null;
  connectors: ConnectorRegistry;
  redis: IORedis;
  notifier: Notifier;
  log: (msg: string, extra?: Record<string, unknown>) => void;
}
