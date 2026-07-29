# Vigil

**A self-funding Aave liquidation guardian that executes through KeeperHub,
sells risk intelligence over x402, and proves every action.**

Vigil closes the gap between detecting liquidation risk and executing a safe,
observable onchain response. It continuously monitors Aave v3 positions,
applies deterministic safety policy, and uses KeeperHub exclusively for
onchain execution.

## Live proof

- **Real Aave v3 rescue:** health factor increased from approximately `1.1786`
  to `1.5000`.
- **Sepolia transaction:**
  [0xa03a...58bb](https://sepolia.etherscan.io/tx/0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb)
- **KeeperHub rescue execution:** `3r554lkdru7bn225qdwsz`
- **Real x402 payment:** `$0.02` settled in Base USDC.
- **Base transaction:**
  [0x440b...4122](https://basescan.org/tx/0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122)
- **KeeperHub paid-workflow execution:** `vn5ghanemwgvwr6gg5h5i`
- **Automated verification:** `40/40` tests passing.

## The problem

AI agents can identify dangerous DeFi positions, but detection alone does not
prevent liquidation. The difficult last mile includes wallet security, gas
estimation, failed transactions, duplicate retries, RPC failures, and proving
what the agent actually did.

Giving an LLM direct control of a private key is unsafe. Retrying blindly can
repay twice. A successful transaction without a reliable audit trail is hard
to trust, debug, or operate autonomously.

## How Vigil works

1. **Monitor:** reads Aave v3 account data and Chainlink-backed prices, then
   calculates health factor and liquidation risk.
2. **Decide:** evaluates thresholds, cooldowns, spend caps, and an idempotency
   key scoped to the position and block range.
3. **Constrain AI:** the advisory model may veto an action, lower its spending
   cap, or increase its cooldown. It can never turn a policy denial into an
   approval.
4. **Execute:** follows a KeeperHub workflow from health-factor read, through a
   Condition branch, to an Aave partial repayment and Telegram notification.
5. **Recover:** classifies gas, revert, nonce, RPC, and unknown failures from
   KeeperHub step logs. Retries use exponential backoff and stop after three
   attempts.
6. **Prove:** creates a canonical receipt containing the decision rationale,
   full KeeperHub execution log, transaction hash, gas usage, before-and-after
   state, and SHA-256 bundle hash.

All onchain writes go through KeeperHub. Vigil never signs or submits a
transaction with a local private key.

## A self-funding agent

Vigil publishes two read-only products on the KeeperHub marketplace:

- **`vigil-risk-check`** returns health factor, oracle price, liquidation-price
  scenario, and risk signals for an Aave address.
- **`vigil-rescue-quote`** returns a nonnegative, debt-capped partial-repayment
  plan targeting a safer health factor.

Each workflow costs `$0.02`. A second agent discovers the workflow, receives an
HTTP `402` challenge, pays through the KeeperHub agentic wallet in Base USDC,
and receives the result. This turns the same risk engine that protects Vigil's
positions into an agent-to-agent revenue stream.

## Reliability and observability

- Deterministic policy remains authoritative over the LLM.
- Cooldowns and daily/per-action caps limit financial exposure.
- Position-plus-block-range idempotency prevents duplicate rescues.
- Retryable and terminal errors are classified from real execution logs.
- A confirmed repayment is never repeated because a later notification failed.
- `npm run chaos` demonstrates gas, nonce, revert, and dead-RPC recovery paths.
- Every confirmed transaction is immediately appended to the transaction
  ledger with both its hash and KeeperHub execution ID.
- Receipts are deterministic and tamper-evident.

## KeeperHub surfaces used

| KeeperHub surface | How Vigil uses it |
|---|---|
| MCP server | Discovers schemas, manages workflows, and retrieves execution logs |
| Direct execution | Proves wallet connectivity and transaction delivery |
| Workflow builder | Orchestrates reads, Condition branches, repayment, and alerts |
| Aave protocol actions | Executes the partial repayment |
| Audit trail | Classifies failures and builds execution receipts |
| Marketplace MCP | Publishes reusable risk-check and rescue-quote products |
| x402 | Charges agents per workflow invocation |
| Agentic wallet | Pays marketplace challenges without exposing local keys |
| Telegram integration | Delivers rescue and failure summaries |

## Technology

TypeScript, Node.js 20+, viem, Vitest, Aave v3, Chainlink, KeeperHub MCP,
KeeperHub workflows, x402, Base USDC, and Telegram.

## Links

- **Source code:** https://github.com/tang-vu/vigil
- **Demo video:** https://youtu.be/1a25RRZmkJ8
- **Milestone proofs:**
  https://github.com/tang-vu/vigil/blob/main/PROGRESS.md
- **Execution receipt:**
  https://github.com/tang-vu/vigil/blob/main/receipts/2026-07-28T16-29-26.213Z.json
- **Onboarding teardown:**
  https://github.com/tang-vu/vigil/blob/main/docs/teardown.md

Vigil is not a mockup: it has already rescued a real Aave test position through
KeeperHub and completed a real paid agent-to-agent x402 workflow.
