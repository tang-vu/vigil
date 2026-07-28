# Vigil three-minute demo script

This scene list is designed for one continuous screen recording. Keep the
terminal large enough that transaction hashes and execution IDs are legible.
The paid scene spends exactly `$0.02` Base USDC and automatically records the
settlement.

## 0:00-0:20 — The problem and architecture

Show the README architecture diagram.

Narration:

> Agents can detect liquidation risk, but the dangerous part is reliable
> execution. Vigil monitors Aave, applies deterministic policy, rescues only
> through KeeperHub, sells the same intelligence to other agents, and makes
> every action auditable.

## 0:20-0:40 — Safety suite

Run:

```powershell
npm test
npm run typecheck
```

Call out `40 passed`, strict TypeScript, policy invariants, retry caps, receipt
tamper detection, and the nonnegative quote test.

## 0:40-1:05 — Live monitoring and policy

Run:

```powershell
$env:MONITOR_ONCE="true"
npm run monitor
```

Show the Aave health factor and fresh Chainlink price. Open
`src/policy/engine.ts` beside the output and point to the cooldown, spend caps,
and idempotency key.

Narration:

> The LLM cannot approve anything. It can only veto, reduce spend, or increase
> cooldown. KeeperHub receives a request only after deterministic policy passes.

## 1:05-1:35 — Real rescue and receipt

Do not rerun the rescue transaction. Show the committed proof:

```powershell
npm run receipt:verify -- receipts/2026-07-28T16-29-26.213Z.json
Get-Content ledger/txs.json | ConvertFrom-Json | Where-Object type -eq "rescue" | Format-List
Start-Process "https://sepolia.etherscan.io/tx/0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb"
```

Narration:

> KeeperHub read health factor 1.1786, followed the true Condition branch,
> repaid Aave, and raised HF to 1.5000. The complete step log, gas, rationale,
> before/after state, Telegram recovery, and SHA-256 are bundled in this receipt.

## 1:35-1:55 — Reliability under failure

Run:

```powershell
npm run chaos
```

Point to the gas, stale-nonce, and dead-RPC scenarios recovering through the
capped exponential ladder. Mention that a confirmed repay is never repeated
because a downstream notification fails.

## 1:55-2:35 — The money shot: Agent B buys risk intelligence

First show the free discovery and 402 challenge:

```powershell
npm run agent-b:demo
```

Then, only with explicit approval to spend another `$0.02`, run:

```powershell
$env:VIGIL_ALLOW_MAINNET_PAYMENT="true"
npm run agent-b:demo -- --pay
```

The script:

1. discovers `vigil-risk-check`;
2. verifies the one-tool `/mcp/w/vigil-risk-check` endpoint;
3. receives HTTP 402;
4. pays Base USDC with KeeperHub's agentic wallet;
5. receives HTTP 200 plus the workflow execution ID; and
6. confirms and appends the settlement transaction to the ledger.

If no second payment is approved, show the existing proof instead:

```powershell
Get-Content artifacts/m6/agent-b-marketplace-proof.json
Start-Process "https://basescan.org/tx/0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122"
```

## 2:35-3:00 — Close with proof density

Run:

```powershell
Get-Content ledger/txs.json | ConvertFrom-Json | Select-Object type,executionId,transactionHash
Get-Content PROGRESS.md | Select-String "Status:"
```

Narration:

> Vigil uses KeeperHub for direct execution, workflow orchestration, Aave
> actions, audit logs, marketplace MCP, x402, agentic wallet payment, and
> Telegram delivery. It is useful today, monetizable by agents, and designed
> around the failures that make autonomous onchain execution hard.
