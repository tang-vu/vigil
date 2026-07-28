import "dotenv/config";
import marketplace from "../workflows/marketplace.json" with { type: "json" };
import rescueQuoteWorkflow from "../workflows/vigil-rescue-quote.json" with { type: "json" };
import riskCheckWorkflow from "../workflows/vigil-risk-check.json" with { type: "json" };
import { callKeeperHubMcpTool, getMcpText } from "../src/keeperhub/mcp-client.js";

interface ListingMetadata {
  readonly workflowId: string;
  readonly slug: string;
  readonly category: string;
  readonly chain: string;
  readonly workflowType: "read";
  readonly priceUsdcPerCall: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputMapping: Readonly<Record<string, unknown>>;
}

interface WorkflowDefinition {
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly nodes: readonly Readonly<Record<string, unknown>>[];
  readonly edges: readonly Readonly<Record<string, unknown>>[];
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`KeeperHub returned non-JSON text: ${text}`);
  }
}

function assertSuccessful(result: unknown, operation: string): unknown {
  if (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>)["isError"] === true
  ) {
    throw new Error(`${operation} failed: ${getMcpText(result)}`);
  }
  return parseJson(getMcpText(result));
}

function isToolError(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>)["isError"] === true
  );
}

async function publish(
  baseUrl: URL,
  apiKey: string,
  listing: ListingMetadata,
  definition: WorkflowDefinition,
): Promise<void> {
  const syncResult = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "update_workflow",
    {
      workflowId: listing.workflowId,
      name: definition.name,
      description: definition.description,
      enabled: definition.enabled,
      nodes: definition.nodes,
      edges: definition.edges,
    },
  );
  assertSuccessful(syncResult, `sync ${listing.slug}`);

  const listingResult = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "get_workflow_listing",
    { slug: listing.slug },
  );
  const alreadyListed = !isToolError(listingResult);
  if (isToolError(listingResult) && !getMcpText(listingResult).includes("404")) {
    throw new Error(
      `check listing ${listing.slug} failed: ${getMcpText(listingResult)}`,
    );
  }

  if (!alreadyListed) {
    const updateResult = await callKeeperHubMcpTool(
      baseUrl,
      apiKey,
      "update_workflow_listing",
      {
        workflowId: listing.workflowId,
        workflowType: listing.workflowType,
        category: listing.category,
        chain: listing.chain,
        priceUsdcPerCall: listing.priceUsdcPerCall,
        inputSchema: listing.inputSchema,
        outputMapping: listing.outputMapping,
      },
    );
    assertSuccessful(updateResult, `configure ${listing.slug}`);
  }

  const validationResult = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "validate_workflow",
    { workflowId: listing.workflowId, deepCheck: true },
  );
  const validation = assertSuccessful(
    validationResult,
    `validate ${listing.slug}`,
  ) as {
    readonly ok?: boolean;
    readonly result?: { readonly valid?: boolean; readonly nodeCount?: number };
  };
  if (validation.ok !== true || validation.result?.valid !== true) {
    throw new Error(
      `${listing.slug} did not pass deep validation: ${JSON.stringify(validation)}`,
    );
  }

  const publishResult = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "list_workflow",
    {
      workflowId: listing.workflowId,
      slug: listing.slug,
      category: listing.category,
      chain: listing.chain,
      workflowType: listing.workflowType,
      inputSchema: listing.inputSchema,
      outputMapping: listing.outputMapping,
    },
  );
  assertSuccessful(publishResult, `publish ${listing.slug}`);
  console.info(
    `Published ${listing.slug}: $${listing.priceUsdcPerCall} USDC, chain=${listing.chain}, nodes=${validation.result.nodeCount ?? "unknown"}`,
  );
}

async function main(): Promise<void> {
  const apiKey = required("KEEPERHUB_API_KEY");
  if (!apiKey.startsWith("kh_")) {
    throw new Error("KEEPERHUB_API_KEY must be an organization key with the kh_ prefix");
  }
  const baseUrl = new URL(
    process.env["KEEPERHUB_BASE_URL"] ?? "https://app.keeperhub.com",
  );

  for (const [listing, definition] of [
    [marketplace.riskCheck, riskCheckWorkflow],
    [marketplace.rescueQuote, rescueQuoteWorkflow],
  ] as readonly (readonly [ListingMetadata, WorkflowDefinition])[]) {
    await publish(baseUrl, apiKey, listing, definition);
  }
}

await main();
