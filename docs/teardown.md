# KeeperHub onboarding teardown

This document records firsthand friction while building Vigil. Each issue includes
evidence and a proposed improvement so it can become bounty-quality feedback.

## 2026-07-28 — Connected MCP claim did not match the active Codex session

**Observed:** The project brief said the KeeperHub MCP server was connected, but
`codex mcp list` reported no configured MCP servers and the current agent tool
inventory exposed no KeeperHub tools.

**Impact:** A builder cannot immediately run the required
`tools_documentation -> get_wallet_integration -> execute_transfer` sequence.

**Action taken:** Added the official hosted endpoint
`https://app.keeperhub.com/mcp` using the documented OAuth route. Authorization
still requires an explicit browser approval.

**Proposed improvement:** Add a copyable `codex mcp add` example beside the
existing Claude Code example, plus a diagnostic snippet that distinguishes
"configured", "OAuth pending", and "connected but wallet missing".

### Follow-up: authorization does not refresh an active Codex tool inventory

After browser authorization, `codex mcp list` correctly changed from
`Not logged in` to `OAuth`. The already-running agent session still returned
zero results when discovering KeeperHub tools, because its tool inventory was
created before the server was connected.

**Proposed improvement:** Document that first-time Codex users must restart or
refresh the agent session after adding and authorizing the MCP server. Ideally,
surface an automatic "MCP connected — reload tools" action after the OAuth
callback succeeds.

## 2026-07-28 — Testnet mismatch for the headline Aave flow

**Observed:** KeeperHub's quickstart recommends Sepolia and marks chain ID
`11155111` stable, but the Aave v3 plugin page currently lists only Ethereum,
Base, Arbitrum, and Optimism. Chainlink explicitly lists Sepolia.

**Impact:** A builder following the recommended testnet path cannot assume that
the documented `aave-v3/repay` action supports Sepolia.

**Next verification:** After MCP authentication, call
`search_protocol_actions` and `list_action_schemas` and treat their live result
as authoritative.

**Proposed improvement:** Put a per-action supported-chain matrix in
`search_protocol_actions`, and add a prominent testnet availability note to the
Aave plugin page and hackathon quickstart.

## 2026-07-28 — MCP direct transfer omits REST simulation

**Observed:** The Direct Execution REST API documents a `simulate: true`
preflight for transfers. The live MCP `execute_transfer` schema exposes chain,
recipient, amount, optional token address, and idempotency key, but no simulation
flag.

**Impact:** An MCP-first builder cannot follow the documented
simulate-then-broadcast sequence without switching surfaces. Vigil therefore
checks chain status, wallet identity, and balance before calling the MCP write,
but this is less complete than an execution simulation.

**Proposed improvement:** Add `simulate?: boolean` to the MCP direct-execution
tools, or expose dedicated `simulate_transfer`,
`simulate_contract_call`, and `simulate_check_and_execute` tools.

## 2026-07-28 — Wallet funding gate worked as intended

The verified organization wallet had `0 wei` on Ethereum Sepolia. Vigil stopped
before calling `execute_transfer`, avoiding a guaranteed failed execution. The
quickstart links a faucet, but an actionable wallet response could also include
the target testnet, current native balance, and a faucet link when balance is
zero.
