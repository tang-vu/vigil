# Vigil progress

Last updated: 2026-07-28

## M1 — Connectivity

Status: **complete**

- [x] Confirmed the repository contains no existing implementation or `CLAUDE.md`.
- [x] Read the official KeeperHub Hackathon Quickstart, MCP server, Direct Execution, Aave v3, and Chainlink documentation.
- [x] Configured the official remote MCP endpoint in Codex.
- [x] Complete KeeperHub OAuth authorization (`codex mcp list` reports `OAuth`).
- [x] Restart/refresh the Codex session; KeeperHub tools are active.
- [x] Verify the organization wallet with `get_wallet_integration`.
- [x] Confirm Ethereum Sepolia (`11155111`) is a stable testnet using
  `list_action_schemas`.
- [x] Recheck the funded org wallet read-only: `0.05 ETH`.
- [x] Execute a `0.000001 ETH` self-transfer on Sepolia through KeeperHub MCP
  `execute_transfer`, protected by idempotency key
  `vigil-m1-connectivity-20260728-01`.
- [x] Poll `get_direct_execution_status` to `completed` and immediately append
  the execution ID and transaction hash to `ledger/txs.json`.
- [x] Confirm KeeperHub reported `success: true`, `sponsored: true`,
  `retryCount: 0`, and `74,745` gas units.

Proof:

- KeeperHub execution: `mnjfr6ce08z6ngks5xo5x`
- Transaction:
  `0x7d6c187670e37ba3838be47baa5951b49c89fcf6af83f2dccab794e2b26b1c3e`
- Explorer:
  <https://sepolia.etherscan.io/tx/0x7d6c187670e37ba3838be47baa5951b49c89fcf6af83f2dccab794e2b26b1c3e>

## M2 — Aave monitor

Status: **complete**

- [x] Pin the official `@bgd-labs/aave-address-book` and assert its Sepolia
  chain ID at startup.
- [x] Read Aave v3 Sepolia Pool `getUserAccountData` and Chainlink ETH/USD
  `latestRoundData` at one block through `viem` multicall.
- [x] Validate positive price, completed round, timestamp, maximum feed age,
  and expected `ETH / USD` feed description.
- [x] Implement fixed-point health-factor math and explicitly label the
  single-collateral liquidation price as a scenario rather than a universal
  portfolio liquidation price.
- [x] Implement continuous polling with jitter on successful intervals and
  capped exponential backoff after failures.
- [x] Add one-shot mode for repeatable demos and CI diagnostics.
- [x] Verify both reads independently through KeeperHub
  `execute_contract_call` using view functions.
- [x] Run a live snapshot against the KeeperHub org wallet at Sepolia block
  `11369199`; Aave returned a debt-free position and Chainlink returned
  ETH/USD `1869.5`.
- [x] Pass 12 Vitest fixtures covering Aave math, Chainlink safety checks, and
  deterministic backoff bounds.

Live contract proof:

- Aave v3 Sepolia Pool: `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`
- Chainlink ETH/USD: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Aave onchain health factor and Vigil's calculated health factor both returned
  `type(uint256).max` for the debt-free account.

## M3 — Safety policy

Status: **complete**

- [x] Implement deterministic rescue eligibility from debt, health factor,
  cooldown, per-rescue spend, and daily spend.
- [x] Derive a stable SHA-256 idempotency key from chain, Aave market, account,
  and block range.
- [x] Define a tightening-only advisory with no `allow` capability.
- [x] Runtime-validate advisory JSON with an allowlist; reject `allow`, unknown
  fields, unsafe numbers, and malformed caps.
- [x] Merge constraints monotonically: minimum spend cap, maximum cooldown, and
  advisory veto.
- [x] Document why the LLM is context-only and never an execution authority in
  `README.md`.
- [x] Pass 10 policy tests, including the invariant that advisory input cannot
  convert any deterministic denial into execution.

Current suite: 22 tests across Aave math, Chainlink validation, retry backoff,
policy caps, runtime advisory validation, and idempotency.

## M4 — KeeperHub rescue workflow

Status: **blocked by repeated KeeperHub `401 Unauthorized` on workflow creation**

- [x] Discover live `aave-v3/repay` and read schemas with
  `search_protocol_actions`.
- [x] Prove `aave-v3/get-user-account-data` works on Sepolia despite the plugin
  page omitting Sepolia.
- [x] Discover exact Manual trigger, Condition, Telegram, and workflow edge
  schemas.
- [x] Prepare the disabled workflow definition with
  trigger -> Aave read -> Condition (`sourceHandle: "true"`) -> repay ->
  Telegram.
- [x] Implement gas/revert/RPC/unknown failure classification and a maximum
  three-attempt retry ladder.
- [x] User approved the safest available validation exception: create disabled,
  validate by ID, then execute manually.
- [x] Set the Telegram notification target to `@hanhgia2212`.
- [ ] Create the disabled workflow. Two identical calls using idempotency key
  `vigil-create-rescue-sepolia-v1` returned `401 Unauthorized`; stopped before
  workaround as required.
- [ ] Obtain a Telegram `chatId` for the notification step.
- [ ] Prepare a deliberately at-risk Aave Sepolia position through KeeperHub.
- [ ] Validate, execute, poll full logs, classify/retry failures, and record the
  confirmed rescue transaction.
