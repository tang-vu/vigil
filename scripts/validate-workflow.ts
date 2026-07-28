import "dotenv/config";
import workflowMetadata from "../workflows/keeperhub.json" with { type: "json" };
import { callKeeperHubMcpTool, getMcpText } from "../src/keeperhub/mcp-client.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  const apiKey = required("KEEPERHUB_API_KEY");
  if (!apiKey.startsWith("kh_")) {
    throw new Error("KEEPERHUB_API_KEY must be an organization key with the kh_ prefix");
  }

  const baseUrl = new URL(
    process.env["KEEPERHUB_BASE_URL"] ?? "https://app.keeperhub.com",
  );
  const result = await callKeeperHubMcpTool(
    baseUrl,
    apiKey,
    "validate_workflow",
    {
      workflowId: workflowMetadata.rescue.workflowId,
      deepCheck: true,
    },
  );

  const text = getMcpText(result);
  const parsed = JSON.parse(text) as {
    readonly ok?: boolean;
    readonly result?: { readonly valid?: boolean; readonly nodeCount?: number };
  };
  if (parsed.ok !== true || parsed.result?.valid !== true) {
    throw new Error(`Workflow validation failed: ${text}`);
  }

  console.info(
    `KeeperHub validated workflow ${workflowMetadata.rescue.workflowId}: valid=true, nodes=${parsed.result.nodeCount ?? "unknown"}`,
  );
}

await main();
