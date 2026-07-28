import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface TextContent {
  readonly type: "text";
  readonly text: string;
}

function isTextContent(value: unknown): value is TextContent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate["type"] === "text" && typeof candidate["text"] === "string";
}

export async function callKeeperHubMcpTool(
  baseUrl: URL,
  apiKey: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const client = new Client({ name: "vigil", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL("/mcp", baseUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  });

  try {
    // MCP SDK 1.30's concrete transport and Transport interface disagree only
    // on optional-property syntax when exactOptionalPropertyTypes is enabled.
    await client.connect(transport as Parameters<Client["connect"]>[0]);
    return await client.callTool({ name, arguments: args });
  } finally {
    await client.close();
  }
}

export function getMcpText(result: unknown): string {
  if (typeof result !== "object" || result === null) {
    throw new Error("KeeperHub MCP returned a non-object result");
  }

  const content = (result as Record<string, unknown>)["content"];
  if (!Array.isArray(content)) {
    throw new Error("KeeperHub MCP result does not contain a content array");
  }

  const text = content.filter(isTextContent).map((item) => item.text).join("\n");
  if (!text) {
    throw new Error("KeeperHub MCP result did not contain text content");
  }
  return text;
}
