import {
  canonicalJson,
  sha256Json,
  type JsonValue,
} from "./canonical-json.js";

export type ReceiptPayload = Readonly<Record<string, JsonValue>>;

export interface SignedReceipt extends ReceiptPayload {
  readonly sha256: string;
}

export function sealReceipt(payload: ReceiptPayload): SignedReceipt {
  return { ...payload, sha256: sha256Json(payload) };
}

export function verifyReceipt(receipt: SignedReceipt): boolean {
  const { sha256, ...payload } = receipt;
  return sha256Json(payload) === sha256;
}

export function serializeReceipt(receipt: SignedReceipt): string {
  if (!verifyReceipt(receipt)) {
    throw new Error("Refusing to serialize a receipt with an invalid SHA-256");
  }
  return `${canonicalJson(receipt)}\n`;
}
