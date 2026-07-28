import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface WorkflowNode {
  readonly data: {
    readonly config: Record<string, unknown>;
  };
}

interface WorkflowDefinition {
  readonly enabled: boolean;
  readonly nodes: readonly WorkflowNode[];
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

describe("KeeperHub marketplace workflows", () => {
  it.each(["vigil-risk-check", "vigil-rescue-quote"])(
    "keeps %s enabled, manual, and strictly read-only",
    async (name) => {
      const workflow = JSON.parse(
        await readFile(`workflows/${name}.json`, "utf8"),
      ) as WorkflowDefinition;
      const actionTypes = workflow.nodes
        .map((node) => node.data.config["actionType"])
        .filter((value): value is string => typeof value === "string");

      expect(workflow.enabled).toBe(true);
      expect(actionTypes).not.toContain("aave-v3/repay");
      expect(actionTypes).not.toContain("web3/write-contract");
      expect(actionTypes).not.toContain("web3/transfer-funds");
      expect(actionTypes.every((type) => {
        return (
          type === "Condition" ||
          type === "math/aggregate" ||
          type === "web3/read-contract" ||
          type.startsWith("aave-v3/get-")
        );
      })).toBe(true);
    },
  );

  it("uses only node templates or non-string literals in output mappings", async () => {
    const metadata = JSON.parse(
      await readFile("workflows/marketplace.json", "utf8"),
    ) as Record<string, { readonly outputMapping: unknown }>;

    for (const listing of Object.values(metadata)) {
      expect(
        collectStrings(listing.outputMapping).every((value) =>
          value.startsWith("{{@"),
        ),
      ).toBe(true);
    }
  });
});
