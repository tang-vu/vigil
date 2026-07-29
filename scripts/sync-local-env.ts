import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

const envPath = path.resolve(".env");
const safeDefaults = {
  BASE_RPC_URL: "https://mainnet.base.org",
  VIGIL_ALLOW_MAINNET_PAYMENT: "false",
  MIMO_BASE_URL: "https://api.xiaomimimo.com/v1",
  TELEGRAM_CHAT_ID: "0",
} as const;

function variableNames(contents: string): Set<string> {
  const names = new Set<string>();
  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/u);
    if (match?.[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

async function main(): Promise<void> {
  const contents = await readFile(envPath, "utf8");
  const existing = variableNames(contents);
  const missingDefaults = Object.entries(safeDefaults).filter(
    ([name]) => !existing.has(name),
  );

  if (missingDefaults.length > 0) {
    const prefix = contents.endsWith("\n") ? "" : "\n";
    const block = [
      "",
      "# Added by npm run env:sync. No secret values are generated here.",
      ...missingDefaults.map(([name, value]) => `${name}=${value}`),
      "",
    ].join("\n");
    await appendFile(envPath, `${prefix}${block}`, "utf8");
  }

  console.info(
    missingDefaults.length === 0
      ? "Local .env already contains every safe default."
      : `Added safe defaults: ${missingDefaults.map(([name]) => name).join(", ")}`,
  );
  if (!existing.has("MIMO_API_KEY")) {
    console.info(
      "MIMO_API_KEY remains unset. Add a newly rotated key manually; env:sync never writes secrets.",
    );
  }
}

await main();
