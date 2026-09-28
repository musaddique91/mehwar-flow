/** Injection tokens for infrastructure clients (so tests can swap them for fakes). */
export const REDIS = Symbol('REDIS');
export const STORAGE = Symbol('STORAGE');
export const CONNECTORS = Symbol('CONNECTORS');
