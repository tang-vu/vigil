import { createHash } from "node:crypto";
import type { Address } from "viem";

export interface PositionIdentity {
  readonly chainId: number;
  readonly market: Address;
  readonly account: Address;
}

export interface BlockRange {
  readonly start: bigint;
  readonly end: bigint;
}

export function getBlockRange(
  blockNumber: bigint,
  blockRangeSize: bigint,
): BlockRange {
  if (blockNumber < 0n) {
    throw new RangeError("blockNumber must be non-negative");
  }
  if (blockRangeSize <= 0n) {
    throw new RangeError("blockRangeSize must be positive");
  }

  const start = (blockNumber / blockRangeSize) * blockRangeSize;
  return { start, end: start + blockRangeSize - 1n };
}

export function createPositionBlockIdempotencyKey(
  position: PositionIdentity,
  blockNumber: bigint,
  blockRangeSize: bigint,
): string {
  const range = getBlockRange(blockNumber, blockRangeSize);
  const canonical = [
    "vigil",
    "rescue",
    "v1",
    String(position.chainId),
    position.market.toLowerCase(),
    position.account.toLowerCase(),
    range.start.toString(),
    range.end.toString(),
  ].join(":");
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `vigil-rescue-${digest.slice(0, 32)}`;
}

