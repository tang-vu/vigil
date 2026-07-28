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
  readonly nodes: WorkflowNode[];
  readonly edges: Array<{
    readonly source: string;
    readonly target: string;
    readonly sourceHandle?: string;
  }>;
}

describe("Vigil rescue workflow definition", () => {
  it("keeps writes disabled and gates repay behind the true condition branch", async () => {
    const workflow = JSON.parse(
      await readFile("workflows/vigil-rescue.json", "utf8"),
    ) as WorkflowDefinition;
    const actionTypes = new Map(
      workflow.nodes.map((node) => [node.id, node.data.config["actionType"]]),
    );

    expect(workflow.enabled).toBe(false);
    expect(actionTypes.get("read-health")).toBe(
      "aave-v3/get-user-account-data",
    );
    expect(actionTypes.get("health-condition")).toBe("Condition");
    expect(actionTypes.get("repay-debt")).toBe("aave-v3/repay");
    expect(actionTypes.get("notify-telegram")).toBe("telegram/send-message");
    expect(workflow.edges).toContainEqual({
      source: "health-condition",
      target: "repay-debt",
      sourceHandle: "true",
      id: "edge-condition-repay",
    });
    expect(
      workflow.edges.some(
        (edge) =>
          edge.source === "health-condition" &&
          edge.target === "repay-debt" &&
          edge.sourceHandle !== "true",
      ),
    ).toBe(false);
  });
});

