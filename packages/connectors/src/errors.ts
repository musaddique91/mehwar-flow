/** Temporary failure (rate limit, 5xx, network). The job should retry later. */
export class RetryableError extends Error {
  readonly retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Credentials are invalid or revoked. The channel needs to be reconnected. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Won't succeed on retry (validation, policy, unsupported media). */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

export class NotConfiguredError extends Error {
  constructor(platform: string) {
    super(`${platform} is not configured on this server`);
    this.name = 'NotConfiguredError';
  }
}
