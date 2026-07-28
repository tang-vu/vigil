import { describe, expect, it } from "vitest";
import { calculateJitteredBackoffMs } from "../src/monitor/backoff.js";

const options = {
  baseDelayMs: 1_000,
  maxDelayMs: 8_000,
  jitterRatio: 0.2,
} as const;

describe("jittered exponential backoff", () => {
  it("grows exponentially and caps before applying jitter", () => {
    expect(calculateJitteredBackoffMs(0, options, () => 0.5)).toBe(1_000);
    expect(calculateJitteredBackoffMs(1, options, () => 0.5)).toBe(2_000);
    expect(calculateJitteredBackoffMs(2, options, () => 0.5)).toBe(4_000);
    expect(calculateJitteredBackoffMs(3, options, () => 0.5)).toBe(8_000);
    expect(calculateJitteredBackoffMs(20, options, () => 0.5)).toBe(8_000);
    expect(calculateJitteredBackoffMs(20, options, () => 1)).toBe(8_000);
  });

  it("applies deterministic lower and upper jitter bounds", () => {
    expect(calculateJitteredBackoffMs(1, options, () => 0)).toBe(1_600);
    expect(calculateJitteredBackoffMs(1, options, () => 1)).toBe(2_400);
  });

  it("rejects invalid parameters", () => {
    expect(() => calculateJitteredBackoffMs(-1, options)).toThrow(
      "non-negative integer",
    );
    expect(() =>
      calculateJitteredBackoffMs(0, { ...options, jitterRatio: 1.1 }),
    ).toThrow("between 0 and 1");
  });
});
