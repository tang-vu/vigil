import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { AaveV3Sepolia } from "@bgd-labs/aave-address-book";
import { isHash, type Hash } from "viem";
import { executeWithRetry } from "../src/executor/retry.js";
import { callKeeperHubMcpTool, getMcpText } from "../src/keeperhub/mcp-client.js";
import { appendLedgerEntry } from "../src/ledger.js";
import workflowMetadata from "../workflows/keeperhub.json" with { type: "json" };

const WALLET = "0x81a60018b81dD438c1Fa7C869A7BDf9bf14B4efB";
const TERMINAL_STATUSES = new Set([
  "success",
  "completed",
  "failed",
  "error",
  "cancelled",
]);

interface ExecutionView {
  readonly executionId: string;
  readonly status: string;
  readonly logs: readonly unknown[];
  readonly raw: unknown;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseMcpJson(result: unknown): unknown {
  return JSON.parse(getMcpText(result)) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function unwrap(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    throw new Error("KeeperHub returned a non-object payload");
  }
  return asRecord(record["result"]) ?? record;
}

function readString(
  record: Readonly<Record<string, unknown>>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function findTransactionHash(value: unknown): Hash | undefined {
  if (typeof value === "string") {
    return isHash(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hash = findTransactionHash(item);
      if (hash) {
        return hash;
      }
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  for (const key of ["transactionHash", "txHash", "hash"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && isHash(candidate)) {
      return candidate;
    }
  }
  for (const nested of Object.values(record)) {
    const hash = findTransactionHash(nested);
    if (hash) {
      return hash;
    }
  }
  return undefined;
}

function normalizeExecution(executionId: string, payload: unknown): ExecutionView {
  const record = unwrap(payload);
  const statusRecord = asRecord(record["status"]);
  const logsRecord = asRecord(record["logs"]);
  const logs = Array.isArray(record["logs"])
    ? record["logs"]
    : Array.isArray(logsRecord?.["logs"])
      ? logsRecord["logs"]
      : [];
  return {
    executionId,
    status:
      (statusRecord ? readString(statusRecord, "status") : undefined) ??
      readString(record, "status") ??
      "unknown",
    logs,
    raw: payload,
  };
}

async function persistExecution(view: ExecutionView, attempt: number): Promise<void> {
  const directory = path.resolve("artifacts", "m4");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${view.executionId}.json`),
    `${JSON.stringify({ attempt, capturedAt: new Date().toISOString(), ...view }, null, 2)}\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  if (process.env["M4_RESCUE_EXECUTE"]?.trim().toLowerCase() !== "true") {
    throw new Error("Set M4_RESCUE_EXECUTE=true to authorize the Sepolia rescue proof");
  }
  const apiKey = required("KEEPERHUB_API_KEY");
  if (!apiKey.startsWith("kh_")) {
    throw new Error("KEEPERHUB_API_KEY must be an organization key with the kh_ prefix");
  }
  const baseUrl = new URL(
    process.env["KEEPERHUB_BASE_URL"] ?? "https://app.keeperhub.com",
  );

  let repeatedFailureSignature: string | undefined;
  let repeatedFailureCount = 0;
  const outcome = await executeWithRetry(
    async (attempt) => {
      const started = parseMcpJson(
        await callKeeperHubMcpTool(
          baseUrl,
          apiKey,
          "execute_workflow",
          {
            workflowId: workflowMetadata.rescue.workflowId,
            idempotency_key: `vigil-m4-rescue-usdc-v1-attempt-${attempt}`,
            input: {
              account: WALLET,
              thresholdWad: "1200000000000000000",
              debtAsset: AaveV3Sepolia.ASSETS.USDC.UNDERLYING,
              repayAmountRaw: "6000000",
              telegramChatId: "@hanhgia2212",
            },
          },
        ),
      );
      const startedRecord = unwrap(started);
      const executionId = readString(startedRecord, "executionId", "id");
      if (!executionId) {
        throw new Error(`KeeperHub did not return an execution ID: ${JSON.stringify(started)}`);
      }
      console.info(`Workflow attempt ${attempt}: executionId=${executionId}`);

      let view: ExecutionView;
      for (;;) {
        const payload = parseMcpJson(
          await callKeeperHubMcpTool(baseUrl, apiKey, "get_execution", {
            executionId,
            includeData: true,
            truncateData: 16_384,
          }),
        );
        view = normalizeExecution(executionId, payload);
        console.info(`Workflow ${executionId}: ${view.status}`);
        if (TERMINAL_STATUSES.has(view.status.toLowerCase())) {
          break;
        }
        await delay(2_000);
      }

      await persistExecution(view, attempt);
      const repayLog =
        view.logs.find((log) => asRecord(log)?.["nodeId"] === "repay-debt") ??
        view.raw;
      const transactionHash = findTransactionHash(repayLog);
      if (transactionHash) {
        await appendLedgerEntry({
          executionId,
          transactionHash,
          chainId: 11_155_111,
          type: "rescue",
          confirmedAt: new Date().toISOString(),
          transactionLink: `https://sepolia.etherscan.io/tx/${transactionHash}`,
        });
        console.info(
          `Rescue confirmed and recorded: executionId=${executionId}, transactionHash=${transactionHash}`,
        );
        return view;
      }

      if (!["success", "completed"].includes(view.status.toLowerCase())) {
        throw new Error(`KeeperHub workflow ${executionId} failed: ${JSON.stringify(view.raw)}`);
      }
      throw new Error(
        `KeeperHub workflow ${executionId} completed without a rescue transaction hash`,
      );
    },
    {
      onFailure: (failure, attempt) => {
        const signature = `${failure.kind}:${failure.message}`;
        repeatedFailureCount =
          signature === repeatedFailureSignature ? repeatedFailureCount + 1 : 1;
        repeatedFailureSignature = signature;
        console.error(
          `Workflow attempt ${attempt} classified ${failure.kind}; retryable=${failure.retryable}`,
        );
        if (repeatedFailureCount >= 2) {
          throw new Error(
            "Stopping after the same KeeperHub failure occurred twice; record it and ask before workaround",
          );
        }
      },
    },
  );

  if (!outcome.result) {
    throw new Error(
      `Rescue failed after ${outcome.attempts} attempt(s): ${outcome.terminalFailure?.message ?? "unknown"}`,
    );
  }
  console.info(
    `M4 rescue workflow completed in ${outcome.attempts} attempt(s) with status=${outcome.result.status}`,
  );
}

await main();
