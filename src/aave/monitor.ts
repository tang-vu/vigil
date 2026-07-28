import type { Address, PublicClient } from "viem";
import { formatUnits } from "viem";
import { aavePoolAbi, chainlinkAggregatorV3Abi } from "./abi.js";
import { AAVE_V3_SEPOLIA } from "./addresses.js";
import {
  UINT256_MAX,
  assertValidChainlinkRound,
  calculateHealthFactorWad,
  calculateSingleCollateralLiquidationPrice,
} from "./math.js";

export interface PositionSnapshot {
  readonly account: Address;
  readonly blockNumber: bigint;
  readonly observedAt: string;
  readonly totalCollateralBase: bigint;
  readonly totalDebtBase: bigint;
  readonly availableBorrowsBase: bigint;
  readonly currentLiquidationThresholdBps: bigint;
  readonly ltvBps: bigint;
  readonly healthFactorWad: bigint;
  readonly calculatedHealthFactorWad: bigint;
  readonly healthFactor: string | null;
  readonly feedDescription: string;
  readonly wethUsdPrice: string;
  readonly wethLiquidationPriceScenario: string | null;
  readonly chainlinkRoundId: bigint;
  readonly chainlinkUpdatedAt: bigint;
}

export interface ReadPositionOptions {
  readonly maxFeedAgeSeconds: bigint;
  readonly now?: Date;
}

export async function readPositionSnapshot(
  client: PublicClient,
  account: Address,
  options: ReadPositionOptions,
): Promise<PositionSnapshot> {
  const blockNumber = await client.getBlockNumber();
  const [accountData, feedDescription, feedDecimals, latestRound] =
    await client.multicall({
    allowFailure: false,
    blockNumber,
    contracts: [
      {
        address: AAVE_V3_SEPOLIA.pool,
        abi: aavePoolAbi,
        functionName: "getUserAccountData",
        args: [account],
      },
      {
        address: AAVE_V3_SEPOLIA.chainlinkEthUsdFeed,
        abi: chainlinkAggregatorV3Abi,
        functionName: "description",
      },
      {
        address: AAVE_V3_SEPOLIA.chainlinkEthUsdFeed,
        abi: chainlinkAggregatorV3Abi,
        functionName: "decimals",
      },
      {
        address: AAVE_V3_SEPOLIA.chainlinkEthUsdFeed,
        abi: chainlinkAggregatorV3Abi,
        functionName: "latestRoundData",
      },
    ],
    });

  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThresholdBps,
    ltvBps,
    healthFactorWad,
  ] = accountData;
  const [roundId, answer, , updatedAt, answeredInRound] = latestRound;
  const now = options.now ?? new Date();
  assertValidChainlinkRound(
    { roundId, answer, updatedAt, answeredInRound },
    BigInt(Math.floor(now.getTime() / 1_000)),
    options.maxFeedAgeSeconds,
  );
  if (feedDescription !== "ETH / USD") {
    throw new Error(`Unexpected Chainlink feed description: ${feedDescription}`);
  }

  const calculatedHealthFactorWad = calculateHealthFactorWad(
    totalCollateralBase,
    totalDebtBase,
    currentLiquidationThresholdBps,
  );
  const liquidationPrice = calculateSingleCollateralLiquidationPrice(
    answer,
    healthFactorWad,
  );

  return {
    account,
    blockNumber,
    observedAt: now.toISOString(),
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThresholdBps,
    ltvBps,
    healthFactorWad,
    calculatedHealthFactorWad,
    healthFactor:
      healthFactorWad === UINT256_MAX ? null : formatUnits(healthFactorWad, 18),
    feedDescription,
    wethUsdPrice: formatUnits(answer, feedDecimals),
    wethLiquidationPriceScenario:
      liquidationPrice === null ? null : formatUnits(liquidationPrice, feedDecimals),
    chainlinkRoundId: roundId,
    chainlinkUpdatedAt: updatedAt,
  };
}
