export const WAD = 10n ** 18n;
export const BASIS_POINTS = 10_000n;
const HALF_BASIS_POINTS = BASIS_POINTS / 2n;
export const UINT256_MAX = (1n << 256n) - 1n;

export function calculateHealthFactorWad(
  totalCollateralBase: bigint,
  totalDebtBase: bigint,
  liquidationThresholdBps: bigint,
): bigint {
  if (totalCollateralBase < 0n || totalDebtBase < 0n) {
    throw new RangeError("Collateral and debt must be non-negative");
  }
  if (
    liquidationThresholdBps < 0n ||
    liquidationThresholdBps > BASIS_POINTS
  ) {
    throw new RangeError("Liquidation threshold must be between 0 and 10,000 bps");
  }
  if (totalDebtBase === 0n) {
    return UINT256_MAX;
  }

  const collateralAfterThreshold =
    (totalCollateralBase * liquidationThresholdBps + HALF_BASIS_POINTS) /
    BASIS_POINTS;
  return (
    (collateralAfterThreshold * WAD + totalDebtBase / 2n) / totalDebtBase
  );
}

/**
 * Estimates the liquidation price when one collateral asset is stressed and
 * all debt, liquidation thresholds, and other collateral values remain fixed.
 * For multi-collateral positions this is a scenario estimate, not a universal
 * liquidation price.
 */
export function calculateSingleCollateralLiquidationPrice(
  currentPrice: bigint,
  healthFactorWad: bigint,
): bigint | null {
  if (currentPrice <= 0n) {
    throw new RangeError("Current price must be positive");
  }
  if (healthFactorWad === UINT256_MAX) {
    return null;
  }
  if (healthFactorWad <= 0n) {
    return 0n;
  }
  return (currentPrice * WAD) / healthFactorWad;
}

export interface ChainlinkRound {
  readonly roundId: bigint;
  readonly answer: bigint;
  readonly updatedAt: bigint;
  readonly answeredInRound: bigint;
}

export function assertValidChainlinkRound(
  round: ChainlinkRound,
  nowSeconds: bigint,
  maxAgeSeconds: bigint,
): void {
  if (round.answer <= 0n) {
    throw new Error("Chainlink answer must be positive");
  }
  if (round.updatedAt <= 0n || round.updatedAt > nowSeconds) {
    throw new Error("Chainlink updatedAt is invalid");
  }
  if (round.answeredInRound < round.roundId) {
    throw new Error("Chainlink round is incomplete");
  }
  if (nowSeconds - round.updatedAt > maxAgeSeconds) {
    throw new Error("Chainlink round is stale");
  }
}
