import { describe, expect, it } from "vitest";
import {
  UINT256_MAX,
  WAD,
  assertValidChainlinkRound,
  calculateHealthFactorWad,
  calculateSingleCollateralLiquidationPrice,
} from "../src/aave/math.js";

describe("Aave position math", () => {
  it("matches a known 1.6 health factor fixture", () => {
    const collateralBase = 2_000n * 10n ** 8n;
    const debtBase = 1_000n * 10n ** 8n;

    expect(calculateHealthFactorWad(collateralBase, debtBase, 8_000n)).toBe(
      16n * 10n ** 17n,
    );
  });

  it("returns uint256 max for a debt-free account like Aave", () => {
    expect(calculateHealthFactorWad(500n, 0n, 8_000n)).toBe(UINT256_MAX);
  });

  it("matches Aave's half-up percent and wad division rounding", () => {
    expect(calculateHealthFactorWad(1n, 3n, 5_000n)).toBe(
      333_333_333_333_333_333n,
    );
  });

  it("calculates a single-collateral liquidation price scenario", () => {
    const ethUsd = 2_000n * 10n ** 8n;
    const healthFactor = 16n * 10n ** 17n;

    expect(
      calculateSingleCollateralLiquidationPrice(ethUsd, healthFactor),
    ).toBe(1_250n * 10n ** 8n);
  });

  it("does not claim a liquidation price for a debt-free account", () => {
    expect(
      calculateSingleCollateralLiquidationPrice(2_000n * 10n ** 8n, UINT256_MAX),
    ).toBeNull();
  });

  it("rejects invalid thresholds and negative balances", () => {
    expect(() => calculateHealthFactorWad(-1n, 1n, 8_000n)).toThrow(
      "non-negative",
    );
    expect(() => calculateHealthFactorWad(1n, 1n, 10_001n)).toThrow(
      "between 0 and 10,000",
    );
  });
});

describe("Chainlink round validation", () => {
  const validRound = {
    roundId: 10n,
    answer: 2_000n * 10n ** 8n,
    updatedAt: 9_900n,
    answeredInRound: 10n,
  };

  it("accepts a fresh completed round", () => {
    expect(() =>
      assertValidChainlinkRound(validRound, 10_000n, 300n),
    ).not.toThrow();
  });

  it("rejects stale, incomplete, future, and non-positive rounds", () => {
    expect(() =>
      assertValidChainlinkRound(validRound, 10_201n, 300n),
    ).toThrow("stale");
    expect(() =>
      assertValidChainlinkRound(
        { ...validRound, answeredInRound: 9n },
        10_000n,
        300n,
      ),
    ).toThrow("incomplete");
    expect(() =>
      assertValidChainlinkRound(
        { ...validRound, updatedAt: 10_001n },
        10_000n,
        300n,
      ),
    ).toThrow("updatedAt");
    expect(() =>
      assertValidChainlinkRound(
        { ...validRound, answer: 0n },
        10_000n,
        300n,
      ),
    ).toThrow("positive");
  });

  it("uses WAD precision", () => {
    expect(WAD).toBe(1_000_000_000_000_000_000n);
  });
});
