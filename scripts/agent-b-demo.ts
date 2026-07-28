import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import marketplace from "../workflows/marketplace.json" with { type: "json" };
import { callKeeperHubMcpTool, getMcpText } from "../src/keeperhub/mcp-client.js";

const demoInputs = {
  account: "0x81a60018b81dD438c1Fa7C869A7BDf9bf14B4efB",
  collateralAsset: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  collateralUnit: "1000000000000000000",
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

async function payWithKeeperHubWallet(slug: string): Promise<string> {
  const client = new Client({ name: "vigil-agent-b", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "-p", "@keeperhub/wallet", "keeperhub-wallet-mcp"],
    stderr: "inherit",
  });

  try {
    await client.connect(transport);
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
    const text = getMcpText(result);
    console.info(`Paid result: ${text}`);
    return text;
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
      chain: "11155111",
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

  const paidResponse = await payWithKeeperHubWallet(slug);
  await saveProof({ ...proof, paid: true, paidResponse });
}

await main();
