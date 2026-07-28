import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { WAD } from "../src/aave/math.js";
import { parseTighteningAdvisory } from "../src/policy/advisory.js";
import { evaluatePolicy, type PolicyConfig, type PolicyInput } from "../src/policy/engine.js";
import {
  createPositionBlockIdempotencyKey,
  getBlockRange,
} from "../src/policy/idempotency.js";

const position = {
  chainId: 11_155_111,
  market: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951" as Address,
  account: "0x81a60018b81dD438c1Fa7C869A7BDf9bf14B4efB" as Address,
};

const config: PolicyConfig = {
  rescueThresholdWad: (12n * WAD) / 10n,
  cooldownMs: 15 * 60 * 1_000,
  maxSpendPerRescueRaw: 100_000_000n,
  maxDailySpendRaw: 300_000_000n,
  blockRangeSize: 25n,
};

const eligible: PolicyInput = {
  position,
  blockNumber: 1_024n,
  observedAtMs: 1_000_000,
  totalDebtBase: 1_000n,
  healthFactorWad: (11n * WAD) / 10n,
  proposedSpendRaw: 50_000_000n,
  spentTodayRaw: 0n,
};

describe("deterministic rescue policy", () => {
  it("approves an unhealthy position inside every deterministic cap", () => {
    const decision = evaluatePolicy(eligible, config);

    expect(decision.execute).toBe(true);
    expect(decision.reasons).toEqual([]);
    expect(decision.approvedSpendRaw).toBe(50_000_000n);
  });

  it("rejects debt-free and healthy positions", () => {
    expect(
      evaluatePolicy({ ...eligible, totalDebtBase: 0n }, config).reasons,
    ).toContain("NO_DEBT");
    expect(
      evaluatePolicy(
        { ...eligible, healthFactorWad: config.rescueThresholdWad },
        config,
      ).reasons,
    ).toContain("HEALTHY");
  });

  it("enforces cooldown and both spend caps", () => {
    expect(
      evaluatePolicy(
        { ...eligible, lastRescueAtMs: eligible.observedAtMs - 1_000 },
        config,
      ).reasons,
    ).toContain("COOLDOWN_ACTIVE");
    expect(
      evaluatePolicy({ ...eligible, proposedSpendRaw: 100_000_001n }, config)
        .reasons,
    ).toContain("PER_RESCUE_CAP_EXCEEDED");
    expect(
      evaluatePolicy({ ...eligible, spentTodayRaw: 275_000_000n }, config)
        .reasons,
    ).toContain("DAILY_CAP_EXCEEDED");
  });
});

describe("tightening-only advisory", () => {
  it("parses only the runtime tightening schema", () => {
    expect(
      parseTighteningAdvisory({
        veto: false,
        maxSpendPerRescueRaw: "25000000",
        minimumCooldownMs: 1_800_000,
        rationale: "Volatility is elevated",
      }),
    ).toEqual({
      veto: false,
      maxSpendPerRescueRaw: 25_000_000n,
      minimumCooldownMs: 1_800_000,
      rationale: "Volatility is elevated",
    });
  });

  it("rejects allow and every unknown advisory capability", () => {
    expect(() => parseTighteningAdvisory({ allow: true })).toThrow(
      "not allowed: allow",
    );
    expect(() =>
      parseTighteningAdvisory({ maxSpendPerRescueRaw: 25_000_000 }),
    ).toThrow("decimal string");
  });

  it("can veto an otherwise valid deterministic decision", () => {
    expect(
      evaluatePolicy(eligible, config, {
        veto: true,
        rationale: "Oracle divergence is elevated",
      }),
    ).toMatchObject({
      execute: false,
      reasons: ["ADVISORY_VETO"],
      approvedSpendRaw: 0n,
    });
  });

  it("can reduce spend and extend cooldown, never the reverse", () => {
    const tightened = evaluatePolicy(eligible, config, {
      maxSpendPerRescueRaw: 25_000_000n,
      minimumCooldownMs: config.cooldownMs * 2,
    });
    expect(tightened.execute).toBe(false);
    expect(tightened.reasons).toContain("PER_RESCUE_CAP_EXCEEDED");
    expect(tightened.effectiveMaxSpendPerRescueRaw).toBe(25_000_000n);
    expect(tightened.effectiveCooldownMs).toBe(config.cooldownMs * 2);

    const attemptedLoosening = evaluatePolicy(eligible, config, {
      maxSpendPerRescueRaw: config.maxSpendPerRescueRaw * 2n,
      minimumCooldownMs: 0,
    });
    expect(attemptedLoosening.effectiveMaxSpendPerRescueRaw).toBe(
      config.maxSpendPerRescueRaw,
    );
    expect(attemptedLoosening.effectiveCooldownMs).toBe(config.cooldownMs);
  });

  it("cannot convert any deterministic denial into execution", () => {
    const deniedInputs: PolicyInput[] = [
      { ...eligible, totalDebtBase: 0n },
      { ...eligible, healthFactorWad: 2n * WAD },
      { ...eligible, proposedSpendRaw: 100_000_001n },
      { ...eligible, spentTodayRaw: 275_000_000n },
      { ...eligible, lastRescueAtMs: eligible.observedAtMs - 1 },
    ];

    for (const input of deniedInputs) {
      expect(evaluatePolicy(input, config).execute).toBe(false);
      expect(
        evaluatePolicy(input, config, {
          veto: false,
          maxSpendPerRescueRaw: config.maxSpendPerRescueRaw * 10n,
          minimumCooldownMs: 0,
        }).execute,
      ).toBe(false);
    }
  });
});

describe("position and block-range idempotency", () => {
  it("maps blocks in one range to the same key and changes at the boundary", () => {
    expect(getBlockRange(1_024n, 25n)).toEqual({ start: 1_000n, end: 1_024n });
    const first = createPositionBlockIdempotencyKey(position, 1_000n, 25n);
    const sameRange = createPositionBlockIdempotencyKey(position, 1_024n, 25n);
    const nextRange = createPositionBlockIdempotencyKey(position, 1_025n, 25n);

    expect(first).toBe(sameRange);
    expect(first).not.toBe(nextRange);
    expect(first).toMatch(/^vigil-rescue-[a-f0-9]{32}$/);
  });

  it("changes the key for another account", () => {
    const first = createPositionBlockIdempotencyKey(position, 1_000n, 25n);
    const another = createPositionBlockIdempotencyKey(
      {
        ...position,
        account: "0x0000000000000000000000000000000000000001",
      },
      1_000n,
      25n,
    );
    expect(first).not.toBe(another);
  });
});
