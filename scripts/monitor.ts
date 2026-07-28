import "dotenv/config";
import { AaveV3Sepolia } from "@bgd-labs/aave-address-book";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { readPositionSnapshot } from "../src/aave/monitor.js";
import { pollPosition } from "../src/monitor/poller.js";

function requiredAddress(name: string): Address {
  const value = process.env[name]?.trim();
  if (!value || !isAddress(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }
  return getAddress(value);
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const rpcUrl =
  process.env["SEPOLIA_RPC_URL"]?.trim() ??
  "https://ethereum-sepolia-rpc.publicnode.com";
const account = requiredAddress("AAVE_ACCOUNT_ADDRESS");
const intervalMs = positiveInteger("MONITOR_INTERVAL_MS", 15_000);
const maxBackoffMs = positiveInteger("MONITOR_MAX_BACKOFF_MS", 120_000);
const maxFeedAgeSeconds = BigInt(
  positiveInteger("CHAINLINK_MAX_AGE_SECONDS", 3_600),
);
const monitorOnce = process.env["MONITOR_ONCE"]?.trim().toLowerCase() === "true";

if (AaveV3Sepolia.CHAIN_ID !== sepolia.id) {
  throw new Error("The official Aave address book does not match Sepolia");
}

const client = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl, { timeout: 15_000 }),
});
const abortController = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => abortController.abort());
}

const readSnapshot = () =>
  readPositionSnapshot(client, account, { maxFeedAgeSeconds });
const printSnapshot = (snapshot: Awaited<ReturnType<typeof readSnapshot>>): void => {
  console.info(
    JSON.stringify(snapshot, (_, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
};

if (monitorOnce) {
  printSnapshot(await readSnapshot());
} else {
  await pollPosition(readSnapshot, {
    intervalMs,
    maxBackoffMs,
    signal: abortController.signal,
    onSnapshot: printSnapshot,
    onError: (error, nextDelayMs) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: error instanceof Error ? error.message : String(error),
          retryInMs: nextDelayMs,
        }),
      );
    },
  });
}
