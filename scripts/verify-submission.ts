import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Hash } from "viem";
import {
  verifyReceipt,
  type SignedReceipt,
} from "../src/receipts/receipt.js";

const RESCUE_TX =
  "0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb";
const X402_TX =
  "0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122";
const REPOSITORY_URL = "https://github.com/tang-vu/vigil";
const DEMO_URL = "https://youtu.be/1a25RRZmkJ8";
const RESCUE_EXPLORER_URL = `https://sepolia.etherscan.io/tx/${RESCUE_TX}`;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface LedgerEntry {
  readonly executionId: string;
  readonly transactionHash: Hash;
  readonly chainId: number;
  readonly type: string;
  readonly amountRaw?: string;
}

interface RescueReceipt extends SignedReceipt {
  readonly decision: {
    readonly account: string;
  };
  readonly keeperHub: {
    readonly executionId: string;
  };
  readonly transaction: {
    readonly hash: Hash;
  };
}

interface PaidProof {
  readonly paid: boolean;
  readonly challenge: string;
  readonly settlement: {
    readonly network: string;
    readonly asset: string;
    readonly amountRaw: string;
    readonly transactionHash: Hash;
    readonly to: string;
  };
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Submission evidence invalid: ${message}`);
  }
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

const receiptPath = "receipts/2026-07-28T16-29-26.213Z.json";
const paidProofPath = "artifacts/m6/agent-b-marketplace-proof.json";
const videoPath = "demo/vigil-keeperhub-demo.mp4";

const [
  receiptText,
  ledgerText,
  paidProofText,
  video,
  videoChecksumText,
  submissionText,
  ignoreText,
] = await Promise.all([
  readFile(receiptPath, "utf8"),
  readFile("ledger/txs.json", "utf8"),
  readFile(paidProofPath, "utf8"),
  readFile(videoPath),
  readFile("demo/vigil-keeperhub-demo.sha256", "utf8"),
  readFile("DORAHACKS.md", "utf8"),
  readFile(".gitignore", "utf8"),
]);

const receipt = parseJson<RescueReceipt>(receiptText, "rescue receipt");
const ledger = parseJson<LedgerEntry[]>(ledgerText, "transaction ledger");
const paidProof = parseJson<PaidProof>(paidProofText, "paid x402 proof");

invariant(verifyReceipt(receipt), "rescue receipt SHA-256 does not verify");
invariant(
  ADDRESS_PATTERN.test(receipt.decision.account),
  "receipt does not contain a valid rescue account",
);
invariant(
  sameHex(receipt.transaction.hash, RESCUE_TX),
  "receipt points to an unexpected rescue transaction",
);

const rescueLedgerEntry = ledger.find((entry) => entry.type === "rescue");
invariant(rescueLedgerEntry, "ledger has no rescue entry");
invariant(
  rescueLedgerEntry.executionId === receipt.keeperHub.executionId,
  "rescue execution ID differs between receipt and ledger",
);
invariant(
  sameHex(rescueLedgerEntry.transactionHash, receipt.transaction.hash),
  "rescue transaction differs between receipt and ledger",
);
invariant(rescueLedgerEntry.chainId === 11_155_111, "rescue is not on Sepolia");

invariant(paidProof.paid === true, "x402 artifact is not a paid proof");
invariant(
  paidProof.settlement.network === "eip155:8453",
  "x402 settlement is not on Base",
);
invariant(paidProof.settlement.asset === "USDC", "x402 settlement is not USDC");
invariant(
  paidProof.settlement.amountRaw === "20000",
  "x402 settlement is not the documented $0.02 USDC amount",
);
invariant(
  sameHex(paidProof.settlement.transactionHash, X402_TX),
  "paid proof points to an unexpected x402 transaction",
);

const challengeRecipient = paidProof.challenge.match(
  /"payTo":"(0x[a-fA-F0-9]{40})"/,
)?.[1];
invariant(challengeRecipient, "x402 challenge has no payTo address");
invariant(
  sameHex(challengeRecipient, paidProof.settlement.to),
  "x402 challenge recipient differs from the confirmed transfer recipient",
);
invariant(
  sameHex(paidProof.settlement.to, receipt.decision.account),
  "x402 revenue does not settle to the KeeperHub rescue account",
);

const paymentLedgerEntry = ledger.find(
  (entry) => entry.type === "marketplace-x402-payment",
);
invariant(paymentLedgerEntry, "ledger has no marketplace x402 payment");
invariant(paymentLedgerEntry.chainId === 8_453, "x402 ledger entry is not on Base");
invariant(
  paymentLedgerEntry.amountRaw === paidProof.settlement.amountRaw,
  "x402 amount differs between paid proof and ledger",
);
invariant(
  sameHex(paymentLedgerEntry.transactionHash, paidProof.settlement.transactionHash),
  "x402 transaction differs between paid proof and ledger",
);

const expectedVideoChecksum = videoChecksumText.trim().split(/\s+/)[0];
const actualVideoChecksum = createHash("sha256").update(video).digest("hex");
invariant(expectedVideoChecksum, "video checksum file is empty");
invariant(
  actualVideoChecksum === expectedVideoChecksum.toLowerCase(),
  "demo video SHA-256 does not match its checksum",
);
invariant((await stat(videoPath)).size > 0, "demo video is empty");

for (const requiredLink of [
  REPOSITORY_URL,
  DEMO_URL,
  RESCUE_EXPLORER_URL,
]) {
  invariant(
    submissionText.includes(requiredLink),
    `DORAHACKS.md is missing required link ${requiredLink}`,
  );
}
invariant(
  ignoreText.split(/\r?\n/).includes(".env"),
  ".gitignore does not exclude .env",
);

console.info(
  JSON.stringify(
    {
      status: "verified",
      receiptSha256: receipt.sha256,
      rescue: {
        executionId: receipt.keeperHub.executionId,
        transactionHash: receipt.transaction.hash,
        chainId: rescueLedgerEntry.chainId,
      },
      economicLoop: {
        revenueRecipientMatchesRescueAccount: true,
        recipient: receipt.decision.account,
        settlementTransactionHash: paidProof.settlement.transactionHash,
        settlementChainId: paymentLedgerEntry.chainId,
        amountRawUsdc: paidProof.settlement.amountRaw,
      },
      demo: {
        sha256: actualVideoChecksum,
        requiredSubmissionLinks: 3,
      },
    },
    null,
    2,
  ),
);
