import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeWithRetry } from "../src/executor/retry.js";
import type { ClassifiedFailure } from "../src/executor/failure.js";

interface ChaosScenario {
  readonly name: string;
  readonly injectedFailures: readonly Error[];
  readonly recovery: string;
}

interface ChaosResult {
  readonly name: string;
  readonly recovered: boolean;
  readonly attempts: number;
  readonly classifications: ClassifiedFailure[];
  readonly backoffMs: number[];
  readonly recovery: string;
}

const scenarios: readonly ChaosScenario[] = [
  {
    name: "bad-gas-params",
    injectedFailures: [new Error("max fee per gas less than block base fee")],
    recovery: "discard bad override and let KeeperHub re-estimate gas",
  },
  {
    name: "wrong-nonce-assumption",
    injectedFailures: [new Error("nonce too low after stale local assumption")],
    recovery: "discard local nonce and defer ordering to KeeperHub",
  },
  {
    name: "dead-rpc-failover",
    injectedFailures: [
      new Error("RPC connection refused: primary endpoint dead"),
      new Error("503 gateway timeout from secondary endpoint"),
    ],
    recovery: "retry with exponential backoff until healthy RPC routing returns",
  },
];

async function runScenario(scenario: ChaosScenario): Promise<ChaosResult> {
  const classifications: ClassifiedFailure[] = [];
  const backoffMs: number[] = [];
  const outcome = await executeWithRetry(
    async (attempt) => {
      const failure = scenario.injectedFailures[attempt - 1];
      if (failure) {
        throw failure;
      }
      return "recovered";
    },
    {
      random: () => 0.5,
      wait: async (delayMs) => {
        backoffMs.push(delayMs);
      },
      onFailure: (failure) => {
        classifications.push(failure);
      },
    },
  );

  return {
    name: scenario.name,
    recovered: outcome.result === "recovered",
    attempts: outcome.attempts,
    classifications,
    backoffMs,
    recovery: scenario.recovery,
  };
}

async function main(): Promise<void> {
  const results = await Promise.all(scenarios.map(runScenario));
  if (results.some((result) => !result.recovered)) {
    throw new Error("Chaos ladder did not recover every injected failure");
  }

  const artifact = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    mode: "controlled-fault-injection",
    onchainTransactions: 0,
    results,
  };
  const artifactDirectory = path.resolve("artifacts", "chaos");
  const artifactPath = path.join(artifactDirectory, "latest.json");
  const temporaryPath = `${artifactPath}.${process.pid}.tmp`;
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, artifactPath);

  for (const result of results) {
    console.info(
      `${result.name}: recovered=true attempts=${result.attempts} classes=${result.classifications.map((item) => item.kind).join(",")} backoffMs=${result.backoffMs.join(",") || "none"}`,
    );
  }
  console.info(`Chaos artifact: ${artifactPath}`);
}

await main();
