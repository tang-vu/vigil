import { UINT256_MAX } from "../aave/math.js";
import {
  createPositionBlockIdempotencyKey,
  type PositionIdentity,
} from "./idempotency.js";

export interface PolicyConfig {
  readonly rescueThresholdWad: bigint;
  readonly cooldownMs: number;
  readonly maxSpendPerRescueRaw: bigint;
  readonly maxDailySpendRaw: bigint;
  readonly blockRangeSize: bigint;
}

export interface PolicyInput {
  readonly position: PositionIdentity;
  readonly blockNumber: bigint;
  readonly observedAtMs: number;
  readonly totalDebtBase: bigint;
  readonly healthFactorWad: bigint;
  readonly proposedSpendRaw: bigint;
  readonly spentTodayRaw: bigint;
  readonly lastRescueAtMs?: number;
}

/**
 * Untrusted advisory output. There is intentionally no `allow` field.
 * Every accepted field moves the deterministic policy in a stricter direction.
 */
export interface TighteningAdvisory {
  readonly veto?: boolean;
  readonly maxSpendPerRescueRaw?: bigint;
  readonly minimumCooldownMs?: number;
  readonly rationale?: string;
}

export type PolicyReason =
  | "NO_DEBT"
  | "HEALTHY"
  | "COOLDOWN_ACTIVE"
  | "PER_RESCUE_CAP_EXCEEDED"
  | "DAILY_CAP_EXCEEDED"
  | "ADVISORY_VETO";

export interface PolicyDecision {
  readonly execute: boolean;
  readonly reasons: readonly PolicyReason[];
  readonly approvedSpendRaw: bigint;
  readonly idempotencyKey: string;
  readonly effectiveMaxSpendPerRescueRaw: bigint;
  readonly effectiveCooldownMs: number;
  readonly advisoryRationale?: string;
}

function assertConfig(config: PolicyConfig): void {
  if (config.rescueThresholdWad <= 0n) {
    throw new RangeError("rescueThresholdWad must be positive");
  }
  if (!Number.isSafeInteger(config.cooldownMs) || config.cooldownMs < 0) {
    throw new RangeError("cooldownMs must be a non-negative safe integer");
  }
  if (
    config.maxSpendPerRescueRaw < 0n ||
    config.maxDailySpendRaw < config.maxSpendPerRescueRaw
  ) {
    throw new RangeError("Spend caps are invalid");
  }
  if (config.blockRangeSize <= 0n) {
    throw new RangeError("blockRangeSize must be positive");
  }
}

function tightenMaxSpend(
  deterministicCap: bigint,
  advisoryCap: bigint | undefined,
): bigint {
  if (advisoryCap === undefined) {
    return deterministicCap;
  }
  if (advisoryCap < 0n) {
    throw new RangeError("Advisory spend cap must be non-negative");
  }
  return advisoryCap < deterministicCap ? advisoryCap : deterministicCap;
}

function tightenCooldown(
  deterministicCooldownMs: number,
  advisoryCooldownMs: number | undefined,
): number {
  if (advisoryCooldownMs === undefined) {
    return deterministicCooldownMs;
  }
  if (!Number.isSafeInteger(advisoryCooldownMs) || advisoryCooldownMs < 0) {
    throw new RangeError("Advisory cooldown must be a non-negative safe integer");
  }
  return Math.max(deterministicCooldownMs, advisoryCooldownMs);
}

export function evaluatePolicy(
  input: PolicyInput,
  config: PolicyConfig,
  advisory: TighteningAdvisory = {},
): PolicyDecision {
  assertConfig(config);
  if (
    input.blockNumber < 0n ||
    input.totalDebtBase < 0n ||
    input.healthFactorWad < 0n ||
    input.proposedSpendRaw < 0n ||
    input.spentTodayRaw < 0n
  ) {
    throw new RangeError("Policy inputs must be non-negative");
  }
  if (!Number.isSafeInteger(input.observedAtMs) || input.observedAtMs < 0) {
    throw new RangeError("observedAtMs must be a non-negative safe integer");
  }
  if (
    input.lastRescueAtMs !== undefined &&
    (!Number.isSafeInteger(input.lastRescueAtMs) || input.lastRescueAtMs < 0)
  ) {
    throw new RangeError("lastRescueAtMs must be a non-negative safe integer");
  }

  const effectiveMaxSpendPerRescueRaw = tightenMaxSpend(
    config.maxSpendPerRescueRaw,
    advisory.maxSpendPerRescueRaw,
  );
  const effectiveCooldownMs = tightenCooldown(
    config.cooldownMs,
    advisory.minimumCooldownMs,
  );
  const reasons: PolicyReason[] = [];

  if (input.totalDebtBase === 0n || input.healthFactorWad === UINT256_MAX) {
    reasons.push("NO_DEBT");
  } else if (input.healthFactorWad >= config.rescueThresholdWad) {
    reasons.push("HEALTHY");
  }

  if (
    input.lastRescueAtMs !== undefined &&
    input.observedAtMs - input.lastRescueAtMs < effectiveCooldownMs
  ) {
    reasons.push("COOLDOWN_ACTIVE");
  }
  if (input.proposedSpendRaw > effectiveMaxSpendPerRescueRaw) {
    reasons.push("PER_RESCUE_CAP_EXCEEDED");
  }
  if (
    input.spentTodayRaw + input.proposedSpendRaw >
    config.maxDailySpendRaw
  ) {
    reasons.push("DAILY_CAP_EXCEEDED");
  }
  if (advisory.veto === true) {
    reasons.push("ADVISORY_VETO");
  }

  const execute = reasons.length === 0;
  return {
    execute,
    reasons,
    approvedSpendRaw: execute ? input.proposedSpendRaw : 0n,
    idempotencyKey: createPositionBlockIdempotencyKey(
      input.position,
      input.blockNumber,
      config.blockRangeSize,
    ),
    effectiveMaxSpendPerRescueRaw,
    effectiveCooldownMs,
    ...(advisory.rationale
      ? { advisoryRationale: advisory.rationale.slice(0, 500) }
      : {}),
  };
}
