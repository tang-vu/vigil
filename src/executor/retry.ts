import { calculateJitteredBackoffMs } from "../monitor/backoff.js";
import {
  classifyKeeperHubFailure,
  type ClassifiedFailure,
} from "./failure.js";

export const MAX_EXECUTION_ATTEMPTS = 3;

export interface RetryResult<T> {
  readonly result?: T;
  readonly attempts: number;
  readonly terminalFailure?: ClassifiedFailure;
}

export interface RetryOptions {
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly random?: () => number;
  readonly wait?: (delayMs: number) => Promise<void>;
  readonly onFailure?: (
    failure: ClassifiedFailure,
    attempt: number,
  ) => void | Promise<void>;
}

export async function executeWithRetry<T>(
  executeAttempt: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const wait =
    options.wait ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  for (let attempt = 1; attempt <= MAX_EXECUTION_ATTEMPTS; attempt += 1) {
    try {
      return { result: await executeAttempt(attempt), attempts: attempt };
    } catch (error) {
      const failure = classifyKeeperHubFailure(error);
      await options.onFailure?.(failure, attempt);
      if (!failure.retryable || attempt === MAX_EXECUTION_ATTEMPTS) {
        return { attempts: attempt, terminalFailure: failure };
      }

      const delayMs = calculateJitteredBackoffMs(
        attempt - 1,
        {
          baseDelayMs: options.baseDelayMs ?? 1_000,
          maxDelayMs: options.maxDelayMs ?? 30_000,
          jitterRatio: 0.2,
        },
        options.random,
      );
      await wait(delayMs);
    }
  }

  throw new Error("Unreachable retry state");
}

