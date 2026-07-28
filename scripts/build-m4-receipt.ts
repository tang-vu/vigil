import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { sealReceipt, serializeReceipt } from "../src/receipts/receipt.js";
import type { JsonValue } from "../src/receipts/canonical-json.js";

const EXECUTION_ID = "3r554lkdru7bn225qdwsz";
const ARTIFACT_PATH = path.resolve("artifacts", "m4", `${EXECUTION_ID}.json`);

interface StepLog {
  readonly nodeId?: string;
  readonly output?: Record<string, unknown>;
  readonly completedAt?: string;
}

interface ExecutionArtifact {
  readonly attempt: number;
  readonly logs: StepLog[];
  readonly raw: JsonValue;
}

function requireStep(
  artifact: ExecutionArtifact,
  nodeId: string,
): StepLog {
  const step = artifact.logs.find((candidate) => candidate.nodeId === nodeId);
  if (!step) {
    throw new Error(`Execution artifact is missing step ${nodeId}`);
  }
  return step;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Execution artifact is missing ${field}`);
  }
  return value;
}

async function main(): Promise<void> {
  const artifact = JSON.parse(
    await readFile(ARTIFACT_PATH, "utf8"),
  ) as ExecutionArtifact;
  const readStep = requireStep(artifact, "read-health");
  const conditionStep = requireStep(artifact, "health-condition");
  const repayStep = requireStep(artifact, "repay-debt");
  const repayOutput = repayStep.output ?? {};
  const readResult = (readStep.output?.["result"] ?? {}) as Record<string, unknown>;
  const transactionHash = requireString(
    repayOutput["transactionHash"],
    "repay transactionHash",
  );
  const completedAt = requireString(repayStep.completedAt, "repay completedAt");

  const payload = {
    schemaVersion: "1.0.0",
    receiptId: `vigil:${EXECUTION_ID}`,
    createdAt: completedAt,
    project: "Vigil",
    chainId: 11_155_111,
    decision: {
      account: "0x81a60018b81dD438c1Fa7C869A7BDf9bf14B4efB",
      policyVersion: "v1",
      eligible: true,
      observedHealthFactorWad: requireString(
        readResult["healthFactor"],
        "observed health factor",
      ),
      thresholdWad: "1200000000000000000",
      repayAsset: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      repayAmountRaw: "6000000",
      rationale: [
        "Aave position had non-zero variable debt.",
        "Observed health factor was below the deterministic 1.2 threshold.",
        "Repayment stayed within the pre-approved 6 USDC cap.",
        "No advisory was allowed to loosen deterministic policy.",
      ],
      conditionEvidence: conditionStep as unknown as JsonValue,
    },
    keeperHub: {
      workflowId: "7cnxv04o5w3s2fbrgnf62",
      executionId: EXECUTION_ID,
      executionAttempt: artifact.attempt,
      workflowStatus: "error-after-confirmed-write",
      confirmedWriteNode: "repay-debt",
      notificationRecoveryExecutionId: "35bu3yt31ir0xucroy7jb",
      fullGetExecutionLog: artifact.raw,
    },
    transaction: {
      hash: transactionHash,
      link: requireString(repayOutput["transactionLink"], "transactionLink"),
      gasUsedUnits: requireString(repayOutput["gasUsedUnits"], "gasUsedUnits"),
      effectiveGasPrice: requireString(
        repayOutput["effectiveGasPrice"],
        "effectiveGasPrice",
      ),
      sponsored: repayOutput["sponsored"] === true,
    },
    outcome: {
      preRescueDebtBase: requireString(readResult["totalDebtBase"], "pre-rescue debt"),
      preRescueHealthFactorWad: requireString(
        readResult["healthFactor"],
        "pre-rescue health factor",
      ),
      postRescueDebtBase: "2200028700",
      postRescueHealthFactorWad: "1499980432073454314",
      telegramMessageId: "2",
    },
  } satisfies Record<string, JsonValue>;

  const receipt = sealReceipt(payload);
  const receiptDirectory = path.resolve("receipts");
  const filename = `${completedAt.replaceAll(":", "-")}.json`;
  const receiptPath = path.join(receiptDirectory, filename);
  const temporaryPath = `${receiptPath}.${process.pid}.tmp`;
  await mkdir(receiptDirectory, { recursive: true });
  await writeFile(temporaryPath, serializeReceipt(receipt), {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, receiptPath);
  console.info(`Receipt created: ${receiptPath}`);
  console.info(`SHA-256: ${receipt.sha256}`);
}

await main();
