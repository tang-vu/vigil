import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  sha256Json,
  type JsonValue,
} from "../src/receipts/canonical-json.js";
import {
  sealReceipt,
  verifyReceipt,
  type SignedReceipt,
} from "../src/receipts/receipt.js";

describe("receipt canonicalization and hashing", () => {
  it("hashes objects independently of insertion order", () => {
    const left = { b: 2, a: { y: true, x: "vigil" } } satisfies JsonValue;
    const right = { a: { x: "vigil", y: true }, b: 2 } satisfies JsonValue;

    expect(canonicalJson(left)).toBe('{"a":{"x":"vigil","y":true},"b":2}');
    expect(sha256Json(left)).toBe(sha256Json(right));
  });

  it("detects receipt tampering", () => {
    const receipt = sealReceipt({
      executionId: "exec_1",
      transactionHash: "0xabc",
      gasUsedUnits: "205376",
    });
    expect(verifyReceipt(receipt)).toBe(true);

    const tampered = {
      ...receipt,
      gasUsedUnits: "205377",
    } as SignedReceipt;
    expect(verifyReceipt(tampered)).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(/non-finite/);
  });
});
