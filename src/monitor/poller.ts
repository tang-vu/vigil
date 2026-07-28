import { setTimeout as delay } from "node:timers/promises";
import type { PositionSnapshot } from "../aave/monitor.js";
import { calculateJitteredBackoffMs } from "./backoff.js";

export interface PollerOptions {
  readonly intervalMs: number;
  readonly maxBackoffMs: number;
  readonly signal?: AbortSignal;
  readonly random?: () => number;
  readonly onSnapshot: (snapshot: PositionSnapshot) => void | Promise<void>;
  readonly onError: (error: unknown, nextDelayMs: number) => void | Promise<void>;
}

export async function pollPosition(
  readSnapshot: () => Promise<PositionSnapshot>,
  options: PollerOptions,
): Promise<void> {
  let failureCount = 0;

  while (!options.signal?.aborted) {
    let nextDelayMs: number;
    try {
      const snapshot = await readSnapshot();
      failureCount = 0;
      await options.onSnapshot(snapshot);
      nextDelayMs = calculateJitteredBackoffMs(
        0,
        {
          baseDelayMs: options.intervalMs,
          maxDelayMs: options.intervalMs,
          jitterRatio: 0.1,
        },
        options.random,
      );
    } catch (error) {
      nextDelayMs = calculateJitteredBackoffMs(
        failureCount,
        {
          baseDelayMs: options.intervalMs,
          maxDelayMs: options.maxBackoffMs,
          jitterRatio: 0.2,
        },
        options.random,
      );
      failureCount += 1;
      await options.onError(error, nextDelayMs);
    }

    try {
      await delay(nextDelayMs, undefined, { signal: options.signal });
    } catch (error) {
      if (options.signal?.aborted) {
        return;
      }
      throw error;
    }
  }
}

