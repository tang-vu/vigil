import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  verifyReceipt,
  type SignedReceipt,
} from "../src/receipts/receipt.js";

const receiptArgument = process.argv[2];
if (!receiptArgument) {
  throw new Error("Usage: npm run receipt:verify -- <receipt.json>");
}

const receiptPath = path.resolve(receiptArgument);
const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as SignedReceipt;
if (!verifyReceipt(receipt)) {
  throw new Error(`Receipt SHA-256 verification failed: ${receiptPath}`);
}
console.info(`Receipt verified: ${receiptPath}`);
console.info(`SHA-256: ${receipt.sha256}`);
