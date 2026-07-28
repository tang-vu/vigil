import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Hash } from "viem";

export interface LedgerEntry {
  readonly executionId: string;
  readonly transactionHash: Hash;
  readonly chainId: 11_155_111;
  readonly type:
    | "m1-connectivity-transfer"
    | "setup-collateral"
    | "setup-borrow"
    | "setup-approval"
    | "rescue";
  readonly confirmedAt: string;
  readonly transactionLink?: string;
  readonly gasUsedWei?: string;
}

export async function appendLedgerEntry(
  entry: LedgerEntry,
  ledgerPath = path.resolve("ledger", "txs.json"),
): Promise<void> {
  await mkdir(path.dirname(ledgerPath), { recursive: true });

  let entries: LedgerEntry[] = [];
  try {
    const existing = JSON.parse(await readFile(ledgerPath, "utf8")) as unknown;
    if (!Array.isArray(existing)) {
      throw new Error(`${ledgerPath} must contain a JSON array`);
    }
    entries = existing as LedgerEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (
    entries.some(
      (candidate) =>
        candidate.executionId === entry.executionId ||
        candidate.transactionHash.toLowerCase() === entry.transactionHash.toLowerCase(),
    )
  ) {
    return;
  }

  entries.push(entry);
  const temporaryPath = `${ledgerPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, ledgerPath);
}
