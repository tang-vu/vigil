export interface BackoffOptions {
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

export function calculateJitteredBackoffMs(
  failureCount: number,
  options: BackoffOptions,
  random: () => number = Math.random,
): number {
  if (!Number.isInteger(failureCount) || failureCount < 0) {
    throw new RangeError("failureCount must be a non-negative integer");
  }
  if (options.baseDelayMs <= 0 || options.maxDelayMs < options.baseDelayMs) {
    throw new RangeError("Backoff delay bounds are invalid");
  }
  if (options.jitterRatio < 0 || options.jitterRatio > 1) {
    throw new RangeError("jitterRatio must be between 0 and 1");
  }

  const exponent = Math.min(failureCount, 30);
  const cappedDelay = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * 2 ** exponent,
  );
  const jitterMultiplier =
    1 - options.jitterRatio + random() * options.jitterRatio * 2;

  return Math.min(
    options.maxDelayMs,
    Math.max(1, Math.round(cappedDelay * jitterMultiplier)),
  );
}
