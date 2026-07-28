import { AaveV3Sepolia } from "@bgd-labs/aave-address-book";
import type { Address } from "viem";
import { getAddress } from "viem";
import { sepolia } from "viem/chains";

function checkedAddress(address: string): Address {
  return getAddress(address);
}

if (AaveV3Sepolia.CHAIN_ID !== sepolia.id) {
  throw new Error(
    `Aave address-book chain mismatch: expected ${sepolia.id}, got ${AaveV3Sepolia.CHAIN_ID}`,
  );
}

export const AAVE_V3_SEPOLIA = {
  chainId: sepolia.id,
  pool: checkedAddress(AaveV3Sepolia.POOL),
  oracle: checkedAddress(AaveV3Sepolia.ORACLE),
  weth: checkedAddress(AaveV3Sepolia.ASSETS.WETH.UNDERLYING),
  aaveWethOracle: checkedAddress(AaveV3Sepolia.ASSETS.WETH.ORACLE),
  chainlinkEthUsdFeed: checkedAddress(
    "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  ),
} as const;
