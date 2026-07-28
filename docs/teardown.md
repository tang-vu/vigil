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

## 2026-07-28 — Aave asset oracle is not necessarily AggregatorV3

**Observed:** The official Aave address book exposes
`AaveV3Sepolia.ASSETS.WETH.ORACLE`, but calling Chainlink's
`latestRoundData()` interface against it reverted. The field is Aave's configured
price source, not a promise that the contract implements
`AggregatorV3Interface`.

**Resolution:** Vigil keeps Aave's price-source address distinct from the
Chainlink ETH/USD proxy. The monitor verifies the Chainlink proxy onchain via
`description()`, `decimals()`, and `latestRoundData()` and rejects any
description other than `ETH / USD`.

**Proposed improvement:** Address-book typings or docs should distinguish direct
Chainlink proxies from adapters, static feeds, and other Aave oracle sources.

## 2026-07-28 — Validate-before-create is impossible in the live MCP schema

**Observed:** The live `validate_workflow` tool requires an existing
`workflowId`. The live `create_workflow` tool is the operation that first
produces that ID.

**Impact:** An MCP-only builder cannot follow a literal
`validate_workflow -> create_workflow` sequence for a new definition. The safest
available sequence appears to be create disabled, validate by ID, update if
needed, then execute manually—but that reverses the documented discipline.

**Proposed improvement:** Let `validate_workflow` accept either `workflowId` or
an inline `{nodes, edges}` definition. Alternatively add
`validate_workflow_definition`.

## 2026-07-28 — Protocol action search hides chain support

**Observed:** `search_protocol_actions` returned the Aave v3 actions and field
schemas but no supported-chain list. The plugin documentation omits Sepolia,
yet a live `aave-v3/get-user-account-data` call succeeded on Sepolia.

**Impact:** Builders cannot know whether a write action is safe to configure for
a testnet without probing it.

**Proposed improvement:** Include `supportedChains` per action in
`search_protocol_actions`, sourced from the same registry used at execution.

## 2026-07-28 — OAuth permits execution reads/writes but workflow create returns 401

**Observed:** In the same OAuth-authenticated MCP session, Vigil successfully
called wallet integration tools, a sponsored Sepolia transfer, direct contract
reads, and Aave protocol reads. Two identical `create_workflow` calls then
returned:

```text
API call failed: 401 Unauthorized - {"error":"Unauthorized"}
```

Both calls used the same body and idempotency key
`vigil-create-rescue-sepolia-v1`. Per project discipline, Vigil stopped after
the second identical error and did not switch to REST or attempt another
credential path.

**Impact:** Authentication appears valid for multiple MCP surfaces but not for
workflow creation, and the response does not say whether the cause is an OAuth
scope, organization role, expired token, endpoint guard, or CSRF/auth middleware
mismatch.

**Proposed improvement:** Return a machine-readable reason such as
`oauth_scope_missing`, `org_role_forbidden`, or `token_expired`, and include the
required remediation. Add a `tools_capabilities` or auth-diagnostics tool that
reports read, execute, workflow-write, integration-write, and marketplace
permissions before a builder reaches a write call.

### Follow-up: organization-key authentication succeeds on the same MCP endpoint

After the required stop and explicit user approval, Vigil retried the workflow
write through the documented REST API with the organization's `kh_` key. The
disabled workflow was created as `7cnxv04o5w3s2fbrgnf62`. Calling
`validate_workflow` with `deepCheck: true` through the same hosted MCP endpoint,
but authenticated with that organization key, returned `valid: true` for all
five nodes.

This narrows the issue to the OAuth credential path rather than the workflow
definition, organization, or hosted service generally. A concise auth
capability diagnostic would have saved the reauthorization and repeated call.

## 2026-07-28 — Aave action discovery omits reserve liquidity

**Observed:** The Aave action registry reported DAI as a borrow action input on
Sepolia, and onchain reserve configuration showed it active, unpaused, and
borrow-enabled. KeeperHub's dry-run correctly prevented broadcast, but returned
only `Panic(17)`. A separate read showed the DAI reserve had roughly 0.022 DAI
of underlying liquidity, far below the requested 14 DAI.

**Impact:** Protocol/action discovery can identify an available action without
showing whether the selected reserve can currently satisfy it. The raw Solidity
panic is also much less actionable than an insufficient-liquidity explanation.

**Resolution:** Vigil did not repeat or broadcast the failing call. It selected
USDC only after reading its active flags, Aave oracle price, and underlying
liquidity, then generated a new request and idempotency key.

**Proposed improvement:** Add an optional preflight payload to protocol search
results with reserve status, liquidity, price, decimals, and supported chains.
Decode or enrich reserve-liquidity panics as
`AAVE_INSUFFICIENT_RESERVE_LIQUIDITY` with requested and available amounts.

## 2026-07-28 — Validator does not classify Aave repay as a write action

**Observed:** The persisted rescue workflow contains
`actionType: "aave-v3/repay"`. Its default `workflowType: "read"` passed deep
validation. After correcting the metadata to `workflowType: "write"`, the same
five-node definition failed with:

```text
missing-write-action-for-write-workflow
workflowType is "write" but no node has a write actionType
```

The validator also emitted no `write-action-on-read-workflow` warning in the
original state.

**Impact:** A private Aave rescue cannot simultaneously carry correct write
metadata and pass the mandatory validation gate, even though the live action
registry labels repay as credentialed and state-changing.

**Resolution:** Vigil keeps this private, unlisted rescue at the server default
classification, validates it, and proves the actual write from KeeperHub's full
execution log and confirmed transaction. The separate marketplace workflows
remain genuinely read-only.

**Proposed improvement:** Source both validator checks from the same protocol
action registry used by `search_protocol_actions`, including an explicit
`mutability: "read" | "write"` field for every action.

## 2026-07-28 — Telegram schema says credential-free, runtime requires a token

**Observed:** `list_action_schemas({ category: "telegram" })` reports
`requiresCredentials: false` and lists only `chatId`, `message`, and
`parseMode`. The rescue's Telegram node accepted `@hanhgia2212`, but runtime
failed with:

```text
Telegram bot token is required. Please configure it in the integration settings.
```

The Aave repay immediately before it had already confirmed onchain.

**Impact:** A workflow can pass deep validation and execute an irreversible
write before discovering a missing notification credential. A naive
workflow-level retry would then repeat the repayment just to retry Telegram.

**Resolution:** Vigil treats a confirmed write-step hash as terminal for the
financial action, records it immediately, and never retries the whole workflow
for a downstream notification failure.

**Proposed improvement:** Mark Telegram `requiresCredentials: true`, expose its
integration selector in required fields, and have `validate_workflow` reject a
Telegram node when no bot credential is configured. Add per-node replay or a
notification-only retry facility.

### Follow-up: the undocumented integration ID fixes credential resolution

After creating a Telegram connection, it appeared in `list_integrations`, but
the same validated node still returned "bot token is required". KeeperHub's
quickstart says notification nodes must select a Connection. Adding the
connection's `integrationId` to the Telegram node fixed token resolution,
despite that field being absent from both required and optional live schema
fields.

The next failure, `Bad Request: chat not found`, came from using a private
account's `@username`. After the user started the bot, Vigil resolved the
numeric private chat ID and the recovery workflow succeeded as execution
`35bu3yt31ir0xucroy7jb`, returning Telegram message ID `2`.

**Additional proposed improvement:** Add `integrationId` to the action schema
and clarify that `@username` is suitable for addressable channels/supergroups;
private users should use the numeric chat ID obtained after starting the bot.

## 2026-07-28 — Aggregate transaction hash list omitted a confirmed write

**Observed:** The full `get_execution` step log contains the successful Aave
repay transaction
`0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb`,
including executed calldata, sponsorship, gas, and explorer link. Both
`status.transactionHashes` and `logs.execution.transactionHashes` are empty.

**Impact:** Consumers relying on the documented aggregate audit field can miss
a confirmed transaction whenever a later workflow node fails.

**Proposed improvement:** Populate aggregate transaction hashes incrementally
after each successful write node, independent of the final workflow status.

## 2026-07-28 - Code action availability is missing from discovery

**Observed:** `list_action_schemas` advertises `code/run-code` with its full
schema and `requiresCredentials: false`. Creating the first marketplace design
then returned HTTP 402 `upgrade_required` for feature `action.code`.

**Impact:** An agent can spend time producing and validating a design around an
action it cannot create on the current plan. The schema response gives no plan
or entitlement signal.

**Resolution:** Vigil did not retry the same request. Both marketplace
workflows were redesigned with free `math/aggregate`, `Condition`, Aave read,
and `web3/read-contract` nodes.

**Proposed improvement:** Add availability metadata to every discovered action,
such as `minimumPlan`, `availableToOrg`, and an upgrade URL. Validation should
also report unavailable actions before create/update.

## 2026-07-28 - Static output strings fail listing validation

**Observed:** Listing metadata initially included legitimate static strings
such as `chainId: "11155111"` and a risk-policy description. The deep validator
treated every string value as though it were a node reference and emitted
`unknown-output-mapping-node`, naming the entire literal as the missing node ID.

**Impact:** Read workflows cannot return ordinary string constants in a mapped
result. This especially hurts quote workflows that need to return a function
name or action type alongside dynamic calldata fields.

**Resolution:** Vigil uses JSON numbers/booleans for static values and only
node templates for strings. The rescue quote reads the Aave pool address
onchain so the destination remains dynamic and verifiable. Human-readable
method semantics remain in the workflow description.

**Proposed improvement:** Only parse values matching the documented
`{{@nodeId:Label.field}}` grammar as node references. Accept any other JSON
literal unchanged, and add validator fixtures for addresses, chain IDs,
function signatures, and explanatory text.

## 2026-07-28 - A listed disabled workflow returns 503 before x402

**Observed:** `list_workflow` successfully published a disabled, manual,
read-only workflow and marketplace search discovered it at `$0.02`. Calling it
returned `503 Workflow temporarily unavailable` instead of the expected 402
challenge because the owner workflow was disabled.

**Impact:** A creator can publish a listing that looks buyable but cannot be
called. Neither listing nor deep validation warned about the disabled state.

**Resolution:** Vigil enabled only the two manual, read-only marketplace
workflows. The state-changing rescue workflow remains disabled.

**Proposed improvement:** `list_workflow` should reject disabled workflows or
return a prominent warning. The marketplace should display availability and
exclude disabled listings from normal discovery.

## 2026-07-28 - OAuth and organization-key MCP can resolve different orgs

**Observed:** `update_workflow_listing` through the connected OAuth MCP returned
401 for a workflow that was accessible through the documented organization
`kh_` bearer on the same MCP endpoint. The local bearer call succeeded without
changing the request body.

**Impact:** A builder can mistake authentication/org scoping for a malformed
marketplace request, particularly because read-only public marketplace tools
still work on the OAuth connection.

**Resolution:** Vigil uses the local, gitignored organization key only through
the MCP transport for organization-scoped publishing and execution. It never
prints or persists the key.

**Proposed improvement:** Include the active organization ID in MCP connection
diagnostics and make 401 responses distinguish expired OAuth, wrong
organization, and missing permission.

## 2026-07-29 - Agentic wallet installer skips Codex registration

**Observed:** `@keeperhub/wallet@0.1.15` installed skills and MCP entries for
Claude Code and OpenCode, but did not detect or register the active Codex host.
The package does provide a standards-compliant stdio MCP server.

**Impact:** A Codex builder can complete the documented install command and
still not see the wallet tools after restart, even though KeeperHub's broader
wallet comparison describes Codex-compatible alternatives and the MCP server
itself works with any compatible client.

**Resolution:** `scripts/agent-b-demo.ts` connects directly to
`npx -y -p @keeperhub/wallet keeperhub-wallet-mcp`. This preserves the official
Turnkey-backed payment path without reading `wallet.json` or depending on
host-specific config discovery.

**Proposed improvement:** Detect Codex's MCP configuration during `skill
install`, print an explicit manual command when detection fails, and add Codex
to the install verification matrix.

## 2026-07-29 - Agentic wallet onboarding docs disagree on provisioning

**Observed:** The KeeperHub docs describe two commands (`skill install`, then
`keeperhub-wallet add`), while the current `@keeperhub/wallet` repository says
versioned installation auto-provisions on the first wallet tool call and no
manual add step is needed.

**Impact:** Builders cannot tell whether running `add` is required, obsolete,
or risks creating a second wallet. That uncertainty is especially costly when
the old wallet may already have been funded.

**Resolution:** Vigil pins and records the observed package version
`0.1.15`, installs the skill once, and defers first provisioning/payment until
the explicit Base-mainnet authorization gate.

**Proposed improvement:** Version the docs alongside the package, show the
minimum package version for each flow, and make `add` idempotently return the
existing wallet unless an explicit `--new` flag is supplied.
