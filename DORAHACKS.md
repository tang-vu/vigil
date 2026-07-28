# Vigil — DoraHacks submission

## Repository

https://github.com/tang-vu/vigil

## One-line pitch

Vigil is a self-funding Aave liquidation guardian that rescues positions only
through KeeperHub, sells paid risk checks over x402, and emits tamper-evident
execution receipts.

## Best transaction proof

The core product transaction is the KeeperHub-executed Aave v3 rescue:

- transaction:
  `0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb`
- explorer:
  https://sepolia.etherscan.io/tx/0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb
- KeeperHub execution: `3r554lkdru7bn225qdwsz`
- outcome: health factor increased from approximately `1.1786` to `1.5000`.

The monetization proof is a second real transaction:

- Base USDC x402 payment:
  `0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122`
- explorer:
  https://basescan.org/tx/0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122
- paid workflow execution: `vn5ghanemwgvwr6gg5h5i`
- amount: `$0.02` Base USDC.

## Demo video outline

1. Show the architecture and the tightening-only policy boundary.
2. Run 40 tests and strict TypeScript checks.
3. Run one live Aave/Chainlink monitor snapshot.
4. Verify the real rescue receipt and open the Sepolia transaction.
5. Run chaos scenarios for gas, nonce, and dead-RPC recovery.
6. Show Agent B discovering `vigil-risk-check`, receiving 402, paying through
   KeeperHub's agentic wallet, and receiving the workflow execution result.
7. Open the Base x402 transfer and finish on the transaction ledger.

The exact three-minute commands and narration are in
[`docs/demo-script.md`](./docs/demo-script.md).

## KeeperHub surfaces used

- hosted MCP and direct execution;
- workflow builder and Condition branches;
- Aave v3 protocol actions;
- full `get_execution` audit logs;
- marketplace listings and per-workflow MCP endpoints;
- x402 Base USDC settlement;
- KeeperHub agentic wallet; and
- Telegram notification integration.

## Submission assets

- milestone proofs: [`PROGRESS.md`](./PROGRESS.md)
- rescue receipt:
  [`receipts/2026-07-28T16-29-26.213Z.json`](./receipts/2026-07-28T16-29-26.213Z.json)
- Agent B paid proof:
  [`artifacts/m6/agent-b-marketplace-proof.json`](./artifacts/m6/agent-b-marketplace-proof.json)
- onboarding teardown: [`docs/teardown.md`](./docs/teardown.md)
- PR-ready KeeperHub fix:
  [`docs/keeperhub-pr-proposal.md`](./docs/keeperhub-pr-proposal.md)
