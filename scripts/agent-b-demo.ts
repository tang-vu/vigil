import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import marketplace from "../workflows/marketplace.json" with { type: "json" };
import { callKeeperHubMcpTool, getMcpText } from "../src/keeperhub/mcp-client.js";
import { appendLedgerEntry } from "../src/ledger.js";

const demoInputs = {
  account: "0x5a93Cd1176ebbbfCeFa915da3eFCBB9bC3ca2C44",
  collateralAsset: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  collateralUnit: "100000000",
} as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function isToolError(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>)["isError"] === true
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseJsonRecord(text: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;
  const record = asRecord(parsed);
  if (!record) {
    throw new Error(`${label} must be a JSON object`);
  }
  return record;
}

function parsePaidWorkflowResponse(text: string): {
  readonly response: Record<string, unknown>;
  readonly workflow: Record<string, unknown>;
  readonly executionId: string;
} {
  const response = parseJsonRecord(text, "KeeperHub wallet response");
  const bodyText = response["bodyText"];
  if (response["paid"] !== true || typeof bodyText !== "string") {
    throw new Error("KeeperHub wallet response was not a paid JSON response");
  }
  const workflow = parseJsonRecord(bodyText, "Paid workflow response body");
  const executionId = workflow["executionId"];
  if (workflow["status"] !== "success" || typeof executionId !== "string") {
    throw new Error(
      `Paid workflow did not succeed: ${JSON.stringify(workflow)}`,
    );
  }
  return { response, workflow, executionId };
}

function parseChallenge(challenge: string): {
  readonly asset: Address;
  readonly amount: bigint;
  readonly payTo: Address;
} {
  const match = challenge.match(
    /"asset":"(0x[a-fA-F0-9]{40})","amount":"([0-9]+)","payTo":"(0x[a-fA-F0-9]{40})"/,
  );
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error("Could not resolve settlement fields from x402 challenge");
  }
  return {
    asset: match[1] as Address,
    amount: BigInt(match[2]),
    payTo: match[3] as Address,
  };
}

function publicAddressFromWalletInfo(text: string): Address {
  const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
  if (!address) {
    throw new Error("KeeperHub wallet info did not include a public address");
  }
  return address as Address;
}

async function confirmAndRecordSettlement(
  executionId: string,
  wallet: Address,
  settlement: ReturnType<typeof parseChallenge>,
): Promise<{
  readonly transactionHash: Hash;
  readonly blockNumber: string;
}> {
  const client = createPublicClient({
    chain: base,
    transport: http(process.env["BASE_RPC_URL"]),
  });
  const tip = await client.getBlockNumber();
  const fromBlock = tip > 300n ? tip - 300n : 0n;
  const logs = await client.getLogs({
    address: settlement.asset,
    event: parseAbiItem(
      "event Transfer(address indexed from, address indexed to, uint256 value)",
    ),
    args: { from: wallet, to: settlement.payTo },
    fromBlock,
    toBlock: tip,
  });
  const transfer = [...logs]
    .reverse()
    .find((log) => log.args.value === settlement.amount);
  if (!transfer) {
    throw new Error(
      "Paid response succeeded, but the matching Base USDC settlement was not found within 300 blocks",
    );
  }
  const receipt = await client.getTransactionReceipt({
    hash: transfer.transactionHash,
  });
  if (receipt.status !== "success") {
    throw new Error(`x402 settlement ${receipt.transactionHash} reverted`);
  }
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  await appendLedgerEntry({
    executionId,
    transactionHash: receipt.transactionHash,
    chainId: 8_453,
    type: "marketplace-x402-payment",
    confirmedAt: new Date(Number(block.timestamp) * 1_000).toISOString(),
    transactionLink: `https://basescan.org/tx/${receipt.transactionHash}`,
    asset: "USDC",
    amountRaw: settlement.amount.toString(),
    blockNumber: receipt.blockNumber.toString(),
    gasUsedUnits: receipt.gasUsed.toString(),
    gasPaidBy: "x402-facilitator",
  });
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
  };
}

async function payWithKeeperHubWallet(
  slug: string,
  challenge: string,
): Promise<{
  readonly response: Record<string, unknown>;
  readonly workflow: Record<string, unknown>;
  readonly executionId: string;
  readonly settlement: {
    readonly transactionHash: Hash;
    readonly blockNumber: string;
  };
}> {
  const client = new Client({ name: "vigil-agent-b", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      "-p",
      "@keeperhub/wallet@0.1.15",
      "keeperhub-wallet-mcp",
    ],
    stderr: "inherit",
  });

  try {
    await client.connect(transport);
    const walletInfo = await client.callTool({ name: "info", arguments: {} });
    if (isToolError(walletInfo)) {
      throw new Error(`KeeperHub wallet info failed: ${getMcpText(walletInfo)}`);
    }
    const wallet = publicAddressFromWalletInfo(getMcpText(walletInfo));
    const result = await client.callTool({
      name: "call_workflow",
      arguments: {
        slug,
        body: demoInputs,
        paymentHint: "x402",
        responseFormat: "json",
      },
    });
    if (isToolError(result)) {
      throw new Error(`KeeperHub wallet payment failed: ${getMcpText(result)}`);
    }
    const paid = parsePaidWorkflowResponse(getMcpText(result));
    const settlement = await confirmAndRecordSettlement(
      paid.executionId,
      wallet,
      parseChallenge(challenge),
    );
    console.info(
      `Paid workflow succeeded and settlement was recorded: execution=${paid.executionId}, tx=${settlement.transactionHash}`,
    );
    return { ...paid, settlement };
  } finally {
    await client.close();
  }
}

async function verifyPerWorkflowEndpoint(
  baseUrl: URL,
  apiKey: string,
  slug: string,
): Promise<void> {
  const client = new Client({ name: "vigil-agent-b-endpoint", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`/mcp/w/${slug}`, baseUrl),
    {
      requestInit: {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  );

  try {
    await client.connect(transport as Parameters<Client["connect"]>[0]);
    const tools = await client.listTools();
    if (tools.tools.length !== 1 || tools.tools[0]?.name !== slug) {
      throw new Error(
        `Expected one typed ${slug} tool, received ${JSON.stringify(tools.tools.map((tool) => tool.name))}`,
      );
    }
    console.info(`Per-workflow MCP endpoint exposes exactly one typed ${slug} tool.`);
  } finally {
    await client.close();
  }
}

async function saveProof(proof: Readonly<Record<string, unknown>>): Promise<void> {
  const directory = path.resolve("artifacts", "m6");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "agent-b-marketplace-proof.json"),
    `${JSON.stringify(proof, null, 2)}\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  const apiKey = required("KEEPERHUB_API_KEY");
  const baseUrl = new URL(
    process.env["KEEPERHUB_BASE_URL"] ?? "https://app.keeperhub.com",
  );
  const slug = marketplace.riskCheck.slug;

  const discovery = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "search_workflows",
    {
      query: "vigil",
      category: "defi",
      chain: "8453",
      workflowType: "read",
      sort: "recent",
    },
  );
  const discoveryText = getMcpText(discovery);
  if (!discoveryText.includes(slug)) {
    throw new Error(`${slug} was not found in KeeperHub marketplace search`);
  }
  console.info(`Agent B discovered ${slug} at $0.02 USDC.`);
  await verifyPerWorkflowEndpoint(baseUrl, apiKey, slug);

  const challenge = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "call_workflow",
    { slug, inputs: demoInputs },
  );
  if (!isToolError(challenge) || !getMcpText(challenge).includes("402")) {
    throw new Error(
      `Expected an x402 payment challenge, received: ${getMcpText(challenge)}`,
    );
  }
  console.info("Agent B received the expected HTTP 402 x402 challenge.");
  const proof = {
    capturedAt: new Date().toISOString(),
    slug,
    discovery: "found",
    perWorkflowEndpoint: `/mcp/w/${slug}`,
    typedToolCount: 1,
    challenge: getMcpText(challenge),
    paid: false,
  };

  if (!process.argv.includes("--pay")) {
    await saveProof(proof);
    console.info(
      "Payment intentionally stopped. Re-run with --pay only after the operator explicitly says \"go mainnet\".",
    );
    return;
  }
  if (process.env["VIGIL_ALLOW_MAINNET_PAYMENT"] !== "true") {
    throw new Error(
      "--pay also requires VIGIL_ALLOW_MAINNET_PAYMENT=true after explicit \"go mainnet\" approval",
    );
  }

  const paidResponse = await payWithKeeperHubWallet(
    slug,
    getMcpText(challenge),
  );
  await saveProof({ ...proof, paid: true, paidResponse });
}

await main();
