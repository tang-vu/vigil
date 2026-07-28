import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { AaveV3Sepolia } from "@bgd-labs/aave-address-book";
import { callKeeperHubMcpTool, getMcpText } from "../src/keeperhub/mcp-client.js";
import workflowMetadata from "../workflows/keeperhub.json" with { type: "json" };

const ACCOUNT = "0x81a60018b81dD438c1Fa7C869A7BDf9bf14B4efB";
const TERMINAL = new Set(["success", "completed", "failed", "error", "cancelled"]);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseResult(result: unknown): Record<string, unknown> {
  if (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>)["isError"] === true
  ) {
    throw new Error(getMcpText(result));
  }
  const payload = JSON.parse(getMcpText(result)) as unknown;
  const record = asRecord(payload);
  if (!record) {
    throw new Error("KeeperHub returned a non-object payload");
  }
  return asRecord(record["result"]) ?? record;
}

function statusOf(payload: Readonly<Record<string, unknown>>): string {
  const status = payload["status"];
  if (typeof status === "string") {
    return status;
  }
  return typeof asRecord(status)?.["status"] === "string"
    ? (asRecord(status)?.["status"] as string)
    : "unknown";
}

async function prove(
  baseUrl: URL,
  apiKey: string,
  slug: string,
  workflowId: string,
  input: Readonly<Record<string, unknown>>,
): Promise<void> {
  const started = parseResult(
    await callKeeperHubMcpTool(baseUrl, apiKey, "execute_workflow", {
      workflowId,
      idempotency_key: `vigil-m6-${slug}-proof-v2`,
      input,
    }),
  );
  const executionId =
    typeof started["executionId"] === "string"
      ? started["executionId"]
      : typeof started["id"] === "string"
        ? started["id"]
        : undefined;
  if (!executionId) {
    throw new Error(`${slug} execution did not return an execution ID`);
  }

  let finalPayload: Record<string, unknown> | undefined;
  for (let poll = 0; poll < 60; poll += 1) {
    const payload = parseResult(
      await callKeeperHubMcpTool(baseUrl, apiKey, "get_execution", {
        executionId,
        includeData: true,
        truncateData: 16_384,
      }),
    );
    const status = statusOf(payload);
    console.info(`${slug} ${executionId}: ${status}`);
    if (TERMINAL.has(status.toLowerCase())) {
      if (!["success", "completed"].includes(status.toLowerCase())) {
        throw new Error(`${slug} proof failed: ${JSON.stringify(payload)}`);
      }
      finalPayload = payload;
      break;
    }
    await delay(1_000);
  }
  if (!finalPayload) {
    throw new Error(`${slug} proof timed out`);
  }

  const directory = path.resolve("artifacts", "m6");
  await mkdir(directory, { recursive: true });
  const artifact = path.join(directory, `${slug}-${executionId}.json`);
  await writeFile(
    artifact,
    `${JSON.stringify(
      { slug, executionId, capturedAt: new Date().toISOString(), execution: finalPayload },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.info(`Saved ${artifact}`);
}

async function main(): Promise<void> {
  const apiKey = required("KEEPERHUB_API_KEY");
  const baseUrl = new URL(
    process.env["KEEPERHUB_BASE_URL"] ?? "https://app.keeperhub.com",
  );

  await prove(
    baseUrl,
    apiKey,
    "vigil-risk-check",
    workflowMetadata.riskCheck.workflowId,
    {
      account: ACCOUNT,
      collateralAsset: AaveV3Sepolia.ASSETS.WETH.UNDERLYING,
      collateralUnit: "1000000000000000000",
    },
  );
  await prove(
    baseUrl,
    apiKey,
    "vigil-rescue-quote",
    workflowMetadata.rescueQuote.workflowId,
    {
      account: ACCOUNT,
      debtAsset: AaveV3Sepolia.ASSETS.USDC.UNDERLYING,
      debtAssetUnit: "1000000",
      targetHealthFactorWad: "1800000000000000000",
    },
  );
}

await main();
