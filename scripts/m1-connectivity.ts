import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { loadM1Config } from "../src/config.js";
import {
  KeeperHubDirectExecutionClient,
  SEPOLIA_CHAIN_ID,
  type DirectExecutionStatus,
} from "../src/keeperhub/direct-execution.js";
import { appendLedgerEntry } from "../src/ledger.js";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

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

async function main(): Promise<void> {
  const config = loadM1Config();
  const client = new KeeperHubDirectExecutionClient(config.baseUrl, config.apiKey);
  const request = {
    chainId: SEPOLIA_CHAIN_ID,
    recipientAddress: config.recipientAddress,
    amount: config.amount,
  } as const;

  const simulation = await client.simulateTransfer(request);
  console.info(
    `Simulation passed: from=${simulation.from}, gasEstimate=${simulation.gasEstimate}, wouldRevert=${simulation.wouldRevert}`,
  );

  if (!config.execute) {
    console.info("Dry-run only. Set M1_EXECUTE=true after verifying the recipient and wallet funding.");
    return;
  }

  const accepted = await client.executeTransfer(request);
  const confirmed = await pollUntilTerminal(client, accepted.executionId);
  if (confirmed.status !== "completed") {
    throw new Error(
      `KeeperHub execution ${confirmed.executionId} failed: ${confirmed.error ?? "unknown error"}`,
    );
  }
  if (!confirmed.transactionHash) {
    throw new Error(`KeeperHub execution ${confirmed.executionId} completed without a transaction hash`);
  }

  await appendLedgerEntry({
    executionId: confirmed.executionId,
    transactionHash: confirmed.transactionHash,
    chainId: SEPOLIA_CHAIN_ID,
    type: "m1-connectivity-transfer",
    confirmedAt: confirmed.completedAt ?? new Date().toISOString(),
    ...(confirmed.transactionLink ? { transactionLink: confirmed.transactionLink } : {}),
    ...(confirmed.gasUsedWei ? { gasUsedWei: confirmed.gasUsedWei } : {}),
  });
  console.info(
    `Confirmed and recorded: executionId=${confirmed.executionId}, transactionHash=${confirmed.transactionHash}`,
  );
}

await main();

