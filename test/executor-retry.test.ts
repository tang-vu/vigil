import { describe, expect, it, vi } from "vitest";
import { classifyKeeperHubFailure } from "../src/executor/failure.js";
import {
  MAX_EXECUTION_ATTEMPTS,
  executeWithRetry,
} from "../src/executor/retry.js";

describe("KeeperHub failure classification", () => {
  it.each([
    ["replacement transaction underpriced", "gas", true],
    ["nonce too low", "nonce", true],
    ["execution reverted: insufficient allowance", "revert", false],
    ["RPC gateway timeout", "rpc", true],
    ["unexpected executor response", "unknown", true],
  ] as const)("classifies %s", (message, kind, retryable) => {
    expect(classifyKeeperHubFailure(new Error(message))).toMatchObject({
      kind,
      retryable,
    });
  });
});

describe("capped execution retry", () => {
  it("recovers from transient RPC failures with exponential delays", async () => {
    const execute = vi
      .fn<(_: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error("RPC timeout"))
      .mockRejectedValueOnce(new Error("503 gateway"))
      .mockResolvedValue("confirmed");
    const wait = vi.fn<(_: number) => Promise<void>>().mockResolvedValue();

    await expect(
      executeWithRetry(execute, { wait, random: () => 0.5 }),
    ).resolves.toEqual({ result: "confirmed", attempts: 3 });
    expect(wait.mock.calls).toEqual([[1_000], [2_000]]);
  });

  it("does not retry a deterministic revert", async () => {
    const execute = vi
      .fn<(_: number) => Promise<string>>()
      .mockRejectedValue(new Error("execution reverted"));

    const result = await executeWithRetry(execute);
    expect(result).toMatchObject({
      attempts: 1,
      terminalFailure: { kind: "revert", retryable: false },
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("caps retryable failures at three attempts", async () => {
    const execute = vi
      .fn<(_: number) => Promise<string>>()
      .mockRejectedValue(new Error("RPC timeout"));
    const result = await executeWithRetry(execute, {
      wait: async () => undefined,
      random: () => 0.5,
    });

    expect(result.attempts).toBe(MAX_EXECUTION_ATTEMPTS);
    expect(result.terminalFailure?.kind).toBe("rpc");
    expect(execute).toHaveBeenCalledTimes(MAX_EXECUTION_ATTEMPTS);
  });
});
