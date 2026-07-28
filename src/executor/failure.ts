export type ExecutionFailureKind = "gas" | "revert" | "rpc" | "unknown";

export interface ClassifiedFailure {
  readonly kind: ExecutionFailureKind;
  readonly retryable: boolean;
  readonly message: string;
}

const GAS_PATTERN =
  /out of gas|intrinsic gas|underpriced|fee too low|max fee|gas limit/i;
const REVERT_PATTERN =
  /revert|execution reverted|call exception|insufficient allowance|transfer amount exceeds/i;
const RPC_PATTERN =
  /rpc|timeout|timed out|network|socket|gateway|503|429|rate limit/i;

export function classifyKeeperHubFailure(error: unknown): ClassifiedFailure {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  if (GAS_PATTERN.test(message)) {
    return { kind: "gas", retryable: true, message };
  }
  if (REVERT_PATTERN.test(message)) {
    return { kind: "revert", retryable: false, message };
  }
  if (RPC_PATTERN.test(message)) {
    return { kind: "rpc", retryable: true, message };
  }
  return { kind: "unknown", retryable: true, message };
}

