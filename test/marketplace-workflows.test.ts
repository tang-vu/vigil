import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface WorkflowNode {
  readonly id: string;
  readonly data: {
    readonly config: Record<string, unknown>;
  };
}

interface WorkflowDefinition {
  readonly enabled: boolean;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly {
    readonly source: string;
    readonly target: string;
  }[];
}

const MARKETPLACE_CHAIN_ID = "8453";

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
      const networks = workflow.nodes
        .map((node) => node.data.config["network"])
        .filter((network) => network !== undefined);
      expect(networks.length).toBeGreaterThan(0);
      expect(networks.every((network) => network === MARKETPLACE_CHAIN_ID)).toBe(
        true,
      );
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

  it("keeps marketplace settlement/application metadata on authorized Base", async () => {
    const metadata = JSON.parse(
      await readFile("workflows/marketplace.json", "utf8"),
    ) as Record<string, { readonly chain: string; readonly workflowType: string }>;

    for (const listing of Object.values(metadata)) {
      expect(listing.chain).toBe(MARKETPLACE_CHAIN_ID);
      expect(listing.workflowType).toBe("read");
    }
  });

  it("floors rescue quotes at zero before capping them to live debt", async () => {
    const workflow = JSON.parse(
      await readFile("workflows/vigil-rescue-quote.json", "utf8"),
    ) as WorkflowDefinition;
    const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));

    expect(nodes.get("repay-raw-floor")?.data.config).toMatchObject({
      actionType: "math/aggregate",
      operation: "max",
      explicitValues: "{{@repay-raw-ceil:Repay Raw Rounded Up.result}},0",
    });
    expect(nodes.get("repay-raw-cap")?.data.config["explicitValues"]).toBe(
      "{{@repay-raw-floor:Nonnegative Repay Amount.result}},{{@read-debt:Read Debt Reserve.currentVariableDebtTokenBalance}}",
    );
    expect(workflow.edges).toContainEqual({
      id: "edge-raw-ceil-floor",
      source: "repay-raw-ceil",
      target: "repay-raw-floor",
    });
    expect(workflow.edges).toContainEqual({
      id: "edge-raw-floor-cap",
      source: "repay-raw-floor",
      target: "repay-raw-cap",
    });
  });
});
