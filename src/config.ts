import type { Address } from "viem";
import { getAddress, isAddress } from "viem";

const DEFAULT_KEEPERHUB_BASE_URL = "https://app.keeperhub.com";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export interface M1Config {
  readonly apiKey: string;
  readonly baseUrl: URL;
  readonly recipientAddress: Address;
  readonly amount: string;
  readonly execute: boolean;
}

export function loadM1Config(): M1Config {
  const apiKey = required("KEEPERHUB_API_KEY");
  if (!apiKey.startsWith("kh_")) {
    throw new Error("KEEPERHUB_API_KEY must be an organization key with the kh_ prefix");
  }

  const recipient = required("M1_RECIPIENT_ADDRESS");
  if (!isAddress(recipient)) {
    throw new Error("M1_RECIPIENT_ADDRESS must be a valid EVM address");
  }

  const amount = process.env["M1_TRANSFER_AMOUNT"]?.trim() ?? "0.000001";
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    throw new Error("M1_TRANSFER_AMOUNT must be a positive decimal string");
  }

  return {
    apiKey,
    baseUrl: new URL(process.env["KEEPERHUB_BASE_URL"] ?? DEFAULT_KEEPERHUB_BASE_URL),
    recipientAddress: getAddress(recipient),
    amount,
    execute: parseBoolean(process.env["M1_EXECUTE"]),
  };
}

