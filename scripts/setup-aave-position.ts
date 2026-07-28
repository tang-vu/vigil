import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { AaveV3Sepolia } from "@bgd-labs/aave-address-book";
import {
  createPublicClient,
  getAddress,
  http,
  parseAbi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import {
  KeeperHubDirectExecutionClient,
  SEPOLIA_CHAIN_ID,
  type ContractCallRequest,
  type DirectExecutionStatus,
} from "../src/keeperhub/direct-execution.js";
import { appendLedgerEntry, type LedgerEntry } from "../src/ledger.js";

const WALLET = getAddress("0x81a60018b81dD438c1Fa7C869A7BDf9bf14B4efB");
const COLLATERAL_ETH = "0.01";
const BORROW_USDC_RAW = "28000000";
const REPAY_ALLOWANCE_RAW = "6000000";
const TERMINAL_STATUSES = new Set(["completed", "failed"]);

const accountDataAbi = parseAbi([
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);
const depositAbi = JSON.stringify(
  parseAbi([
    "function depositETH(address pool, address onBehalfOf, uint16 referralCode) payable",
  ]),
);
const borrowAbi = JSON.stringify(
  parseAbi([
    "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  ]),
);
const approveAbi = JSON.stringify(
  parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function isEnabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

async function pollUntilTerminal(
  client: KeeperHubDirectExecutionClient,
  executionId: string,
): Promise<DirectExecutionStatus> {
  for (;;) {
    const { status, pollIntervalSeconds } = await client.getStatus(executionId);
    console.info(`KeeperHub execution ${executionId}: ${status.status}`);
    if (TERMINAL_STATUSES.has(status.status)) {
      return status;
    }
    await delay(pollIntervalSeconds * 1_000);
  }
}

async function simulateExecuteAndRecord(
  client: KeeperHubDirectExecutionClient,
  request: ContractCallRequest,
  idempotencyKey: string,
  type: LedgerEntry["type"],
): Promise<void> {
  const simulation = await client.simulateContractCall(request);
  if (!simulation.success || simulation.wouldRevert) {
    throw new Error(`KeeperHub simulation failed for ${type}`);
  }
  console.info(
    `Simulation passed for ${type}: gasEstimate=${simulation.gasEstimate}`,
  );

  const accepted = await client.executeContractCall(request, idempotencyKey);
  const confirmed = await pollUntilTerminal(client, accepted.executionId);
  if (confirmed.status !== "completed") {
    throw new Error(
      `KeeperHub execution ${confirmed.executionId} failed: ${confirmed.error ?? "unknown error"}`,
    );
  }
  if (!confirmed.transactionHash) {
    throw new Error(
      `KeeperHub execution ${confirmed.executionId} completed without a transaction hash`,
    );
  }

  await appendLedgerEntry({
    executionId: confirmed.executionId,
    transactionHash: confirmed.transactionHash,
    chainId: SEPOLIA_CHAIN_ID,
    type,
    confirmedAt: confirmed.completedAt ?? new Date().toISOString(),
    ...(confirmed.transactionLink ? { transactionLink: confirmed.transactionLink } : {}),
    ...(confirmed.gasUsedWei ? { gasUsedWei: confirmed.gasUsedWei } : {}),
  });
  console.info(
    `Confirmed and recorded ${type}: executionId=${confirmed.executionId}, transactionHash=${confirmed.transactionHash}`,
  );
}

async function readAccountData(rpcUrl: string): Promise<{
  readonly collateralBase: bigint;
  readonly debtBase: bigint;
  readonly availableBorrowsBase: bigint;
  readonly liquidationThresholdBps: bigint;
  readonly ltvBps: bigint;
  readonly healthFactorWad: bigint;
}> {
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const result = await client.readContract({
    address: AaveV3Sepolia.POOL,
    abi: accountDataAbi,
    functionName: "getUserAccountData",
    args: [WALLET],
  });
  return {
    collateralBase: result[0],
    debtBase: result[1],
    availableBorrowsBase: result[2],
    liquidationThresholdBps: result[3],
    ltvBps: result[4],
    healthFactorWad: result[5],
  };
}

async function main(): Promise<void> {
  const apiKey = required("KEEPERHUB_API_KEY");
  if (!apiKey.startsWith("kh_")) {
    throw new Error("KEEPERHUB_API_KEY must be an organization key with the kh_ prefix");
  }
  if (!isEnabled("M4_SETUP_EXECUTE")) {
    throw new Error("Set M4_SETUP_EXECUTE=true to authorize the Sepolia setup transactions");
  }

  const baseUrl = new URL(
    process.env["KEEPERHUB_BASE_URL"] ?? "https://app.keeperhub.com",
  );
  const rpcUrl =
    process.env["SEPOLIA_RPC_URL"] ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const client = new KeeperHubDirectExecutionClient(baseUrl, apiKey);

  const before = await readAccountData(rpcUrl);
  if (before.debtBase !== 0n) {
    throw new Error("Refusing setup: the KeeperHub wallet already has Aave debt");
  }

  if (before.collateralBase === 0n) {
    await simulateExecuteAndRecord(
      client,
      {
        chainId: SEPOLIA_CHAIN_ID,
        contractAddress: AaveV3Sepolia.WETH_GATEWAY as Address,
        functionName: "depositETH",
        functionArgs: JSON.stringify([AaveV3Sepolia.POOL, WALLET, "0"]),
        abi: depositAbi,
        value: COLLATERAL_ETH,
        gasLimitMultiplier: "1.2",
      },
      "vigil-m4-deposit-eth-collateral-v1",
      "setup-collateral",
    );
  } else {
    console.info("Collateral already confirmed; resuming setup without another deposit");
  }

  const collateralized = await readAccountData(rpcUrl);
  console.info(
    `Aave collateral ready: collateralBase=${collateralized.collateralBase}, availableBorrowsBase=${collateralized.availableBorrowsBase}, ltvBps=${collateralized.ltvBps}, liquidationThresholdBps=${collateralized.liquidationThresholdBps}`,
  );

  await simulateExecuteAndRecord(
    client,
    {
      chainId: SEPOLIA_CHAIN_ID,
      contractAddress: AaveV3Sepolia.POOL,
      functionName: "borrow",
      functionArgs: JSON.stringify([
        AaveV3Sepolia.ASSETS.USDC.UNDERLYING,
        BORROW_USDC_RAW,
        "2",
        "0",
        WALLET,
      ]),
      abi: borrowAbi,
      gasLimitMultiplier: "1.2",
    },
    "vigil-m4-borrow-usdc-v1",
    "setup-borrow",
  );

  await simulateExecuteAndRecord(
    client,
    {
      chainId: SEPOLIA_CHAIN_ID,
      contractAddress: AaveV3Sepolia.ASSETS.USDC.UNDERLYING,
      functionName: "approve",
      functionArgs: JSON.stringify([AaveV3Sepolia.POOL, REPAY_ALLOWANCE_RAW]),
      abi: approveAbi,
      gasLimitMultiplier: "1.2",
    },
    "vigil-m4-approve-usdc-repay-v1",
    "setup-approval",
  );

  const atRisk = await readAccountData(rpcUrl);
  console.info(
    `At-risk position ready: collateralBase=${atRisk.collateralBase}, debtBase=${atRisk.debtBase}, healthFactorWad=${atRisk.healthFactorWad}`,
  );
}

await main();
