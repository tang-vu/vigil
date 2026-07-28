import { randomUUID } from "node:crypto";
import type { Address, Hash } from "viem";

export const SEPOLIA_CHAIN_ID = 11_155_111;

export interface TransferRequest {
  readonly chainId: typeof SEPOLIA_CHAIN_ID;
  readonly recipientAddress: Address;
  readonly amount: string;
  readonly simulate?: true;
}

export interface TransferSimulation {
  readonly success: true;
  readonly status: "simulated";
  readonly from: Address;
  readonly to: Address;
  readonly value: string;
  readonly gasEstimate: string;
  readonly simulatedReturnValue: unknown;
  readonly wouldRevert: false;
}

export interface ContractCallRequest {
  readonly chainId: typeof SEPOLIA_CHAIN_ID;
  readonly contractAddress: Address;
  readonly functionName: string;
  readonly functionArgs?: string;
  readonly abi?: string;
  readonly value?: string;
  readonly gasLimitMultiplier?: string;
}

export interface DirectExecutionAccepted {
  readonly executionId: string;
  readonly status: "pending" | "running" | "completed" | "failed";
}

export interface DirectExecutionStatus extends DirectExecutionAccepted {
  readonly type: string;
  readonly transactionHash?: Hash;
  readonly transactionLink?: string;
  readonly gasUsedWei?: string;
  readonly result?: unknown;
  readonly error?: string | null;
  readonly createdAt?: string;
  readonly completedAt?: string;
}

interface KeeperHubErrorBody {
  readonly error?: string;
  readonly code?: string;
  readonly field?: string;
  readonly details?: string;
}

export class KeeperHubHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly body: KeeperHubErrorBody,
  ) {
    super(
      `KeeperHub HTTP ${status}: ${body.error ?? body.code ?? body.details ?? "unknown error"}`,
    );
    this.name = "KeeperHubHttpError";
  }
}

export class KeeperHubDirectExecutionClient {
  public constructor(
    private readonly baseUrl: URL,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public async simulateTransfer(
    request: Omit<TransferRequest, "simulate">,
  ): Promise<TransferSimulation> {
    return this.request<TransferSimulation>("/api/execute/transfer", {
      method: "POST",
      body: JSON.stringify({ ...request, simulate: true satisfies boolean }),
    });
  }

  public async executeTransfer(
    request: Omit<TransferRequest, "simulate">,
    idempotencyKey: string = randomUUID(),
  ): Promise<DirectExecutionAccepted> {
    return this.request<DirectExecutionAccepted>("/api/execute/transfer", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(request),
    });
  }

  public async simulateContractCall(
    request: ContractCallRequest,
  ): Promise<TransferSimulation> {
    return this.request<TransferSimulation>("/api/execute/contract-call", {
      method: "POST",
      body: JSON.stringify({ ...request, simulate: true satisfies boolean }),
    });
  }

  public async executeContractCall(
    request: ContractCallRequest,
    idempotencyKey: string = randomUUID(),
  ): Promise<DirectExecutionAccepted> {
    return this.request<DirectExecutionAccepted>("/api/execute/contract-call", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(request),
    });
  }

  public async getStatus(executionId: string): Promise<{
    readonly status: DirectExecutionStatus;
    readonly pollIntervalSeconds: number;
  }> {
    const response = await this.rawRequest(
      `/api/execute/${encodeURIComponent(executionId)}/status`,
      { method: "GET" },
    );
    const pollIntervalHeader = response.headers.get("X-Poll-Interval-Hint");
    const pollIntervalSeconds = Math.max(0, Number(pollIntervalHeader ?? "2") || 2);

    return {
      status: (await response.json()) as DirectExecutionStatus,
      pollIntervalSeconds,
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.rawRequest(path, init);
    return (await response.json()) as T;
  }

  private async rawRequest(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as KeeperHubErrorBody;
      throw new KeeperHubHttpError(response.status, body);
    }
    return response;
  }
}
