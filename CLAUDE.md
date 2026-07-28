# Vigil project rules

These rules are absolute.

- All onchain execution goes through KeeperHub MCP tools or its REST API. Never sign or submit a transaction with a local private key.
- Never write, print, log, or commit private keys, API keys, bearer tokens, or `wallet.json` contents. Secrets belong in `.env`, which is gitignored. Read the organization key from `process.env.KEEPERHUB_API_KEY`.
- Immediately after confirmation, append every executed transaction's hash and KeeperHub execution ID to `ledger/txs.json`.
- Default to Ethereum Sepolia (`11155111`). Use Ethereum mainnet (`1`) or Base (`8453`) only when the user explicitly says `go mainnet`.
- Use TypeScript strict mode, Node.js 20+, `viem` for read-only chain access and math, and Vitest.
- Before an uncertain KeeperHub call, use `tools_documentation` or `list_action_schemas`; do not invent parameters.
- Validate a workflow before creating it. Test it with `execute_workflow` and poll `get_execution` before calling it complete.
- Update `PROGRESS.md` after each milestone. Record every KeeperHub friction point in `docs/teardown.md`.
- Complete milestones M1 through M7 in order and prove each before advancing.
- If the same KeeperHub call fails twice with the same error, stop, record the failure in `docs/teardown.md`, and ask the user before attempting a workaround.

