# Vigil progress

Last updated: 2026-07-29

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

Status: **complete**

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
- [x] Stop after two identical OAuth `401 Unauthorized` responses, document the
  failure, and obtain user approval before changing authentication surfaces.
- [x] Create the disabled workflow through KeeperHub REST using the local
  organization key and idempotency key `vigil-create-rescue-sepolia-v1`.
- [x] Validate workflow `7cnxv04o5w3s2fbrgnf62` with `deepCheck: true` through
  KeeperHub MCP authenticated by the same organization key. KeeperHub returned
  `valid: true` and `nodeCount: 5`.
- [x] Add `npm run workflow:validate` so the proof is repeatable without
  printing or persisting the organization key.
- [x] Create the deliberately at-risk Sepolia position entirely through
  KeeperHub direct execution: deposit `0.01 ETH` through Aave's WETH gateway,
  borrow `28 USDC` at variable rate, and approve a tightly bounded `6 USDC`
  repayment allowance.
- [x] Simulate each setup call before broadcast and append all three confirmed
  execution IDs and hashes to `ledger/txs.json`.
- [x] Verify the live at-risk position: collateral base `4,000,000,000`, debt
  base `2,800,000,700`, health factor `1.178571133928645089`.
- [x] Confirm the Telegram schema accepts either a numeric chat ID or
  `@username`; use `@hanhgia2212`.
- [x] Preflight the exact `repay(USDC, 6000000, 2, account)` call through
  KeeperHub simulation; returned `wouldRevert: false` and `193,179` estimated
  gas.
- [x] Execute the deep-validated workflow against the at-risk position and
  capture the full five-node `get_execution` log.
- [x] Confirm the condition observed HF `1.178564525550636061 < 1.2`.
- [x] Confirm KeeperHub executed the Aave v3 repay step, sponsored the
  transaction, reported `205,376` gas units, and append its execution ID and
  hash to `ledger/txs.json`.
- [x] Verify the post-rescue position: debt base fell from `2,800,016,400` to
  `2,200,028,700`; health factor rose to `1.499980432073454314`.
- [x] Do not retry after the downstream Telegram failure because the repay
  transaction was already confirmed; this prevents a double repayment.
- [x] Configure `VigilKeeperHubBot` as a KeeperHub Telegram connection and bind
  its integration ID explicitly to both notification nodes.
- [x] Resolve private-chat numeric ID `5532543318` after `/start`; Telegram does
  not resolve the personal username as a destination.
- [x] Deliver the rescue summary through notification-recovery execution
  `35bu3yt31ir0xucroy7jb`; Telegram returned message ID `2`.
- [x] Wire the notification-recovery workflow into the executor so exhausted
  retries alert separately and a downstream notification failure never repeats
  an already-confirmed repayment.

Setup proof:

- Collateral: execution `dsar54qwu8n4wn11ph67g`, tx
  `0x77b5273688bf38a7e7973d2d2dc44e6e59802a31da2eb4c645dc8727cf9bac15`
- Borrow: execution `s9ahvqibd4bi14qya6kxe`, tx
  `0xf76617d6b8d298738326506a1b9c751a9f3067960f6fd9ea31ff2858b47f4712`
- Approval: execution `q1lv0soqx5mtzul4gytyn`, tx
  `0x5b25a71b86fc792414427b830674cc0223834734b834aa726af86160b02f2996`

Rescue proof:

- Workflow execution: `3r554lkdru7bn225qdwsz`
- Repay transaction:
  `0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb`
- Full step log: `artifacts/m4/3r554lkdru7bn225qdwsz.json`
- Telegram recovery: execution `35bu3yt31ir0xucroy7jb`, message ID `2`

## M5 — Receipts and chaos

Status: **complete**

- [x] Build canonical JSON serialization with recursively sorted object keys.
- [x] Seal each receipt with SHA-256 computed over the complete payload before
  the `sha256` field is attached.
- [x] Verify hashes independently with `npm run receipt:verify -- <path>` and
  reject any modified receipt.
- [x] Bundle the decision rationale, deterministic policy evidence, complete
  KeeperHub `get_execution` response, execution/workflow IDs, transaction hash,
  gas, sponsorship, before/after health, and Telegram recovery proof.
- [x] Create the M4 rescue receipt at
  `receipts/2026-07-28T16-29-26.213Z.json`.
- [x] Add `npm run chaos` with controlled gas, stale-nonce, and dead-RPC fault
  injection. All scenarios recover through the capped exponential retry ladder.
- [x] Capture the repeatable demo result in `artifacts/chaos/latest.json`.
- [x] Pass 35 tests, including receipt order invariance, tamper detection,
  non-finite number rejection, nonce classification, and retry caps.

Receipt proof:

- SHA-256:
  `550de5d5729bf3833215bf0583471514dd1e765bfe809556f8c5b86d468d0f20`
- KeeperHub execution: `3r554lkdru7bn225qdwsz`
- Transaction:
  `0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb`

## M6 - KeeperHub marketplace

Status: **complete**

- [x] Build `vigil-risk-check` as a read-only Aave v3 Base workflow computing
  health factor, a single-collateral liquidation-price scenario, and
  deterministic risk-grade signals.
- [x] Build `vigil-rescue-quote` as a read-only Aave v3 Base workflow computing
  a nonnegative, debt-capped repay amount plus the exact pool, asset, amount,
  rate mode, and on-behalf-of plan. It never executes the plan.
- [x] Replace the Pro-only Code action design with free Math, Condition, Aave,
  and Web3 read nodes.
- [x] Deep-validate both live workflows after applying their listing metadata:
  risk check `valid=true`, 10 nodes; rescue quote `valid=true`, 14 nodes.
- [x] Execute both workflows through KeeperHub and poll `get_execution` to
  success with full artifacts.
- [x] Publish both workflows at `$0.02` USDC per call with type `read`,
  category `defi`, and application chain `8453`.
- [x] Verify marketplace discovery finds both slugs.
- [x] Verify `/mcp/w/vigil-risk-check` exposes exactly one typed tool.
- [x] Verify an unpaid Agent B call receives the expected HTTP 402 x402
  challenge.
- [x] Add an Agent B script that discovers, challenges, pays through
  KeeperHub's Turnkey-backed agentic wallet, confirms the Base USDC Transfer,
  and immediately appends the execution ID and transaction hash to the ledger.
- [x] Install `@keeperhub/wallet@0.1.15` and its safety hook without reading or
  printing the generated wallet credential file. The demo invokes its standard
  stdio MCP server directly, so it does not depend on host-specific
  auto-registration.
- [x] Operator explicitly authorized `go mainnet`.
- [x] Provision the official Turnkey-backed agentic wallet without reading,
  printing, or committing its credential material.
- [x] Fund the public agent wallet by direct Base USDC transfer after the
  package-generated Coinbase Onramp URL failed because it omitted `appId`.
- [x] Diagnose the first Sepolia-listing payment attempt as KeeperHub
  `CHAIN_MISMATCH`: the workflow chain was Sepolia while x402 challenged on
  Base. No USDC was debited.
- [x] Move only the paid marketplace products to their production Aave Base
  market after explicit mainnet authorization. The guardian and rescue
  executor remain on Sepolia.
- [x] Execute one real `$0.02` x402 purchase; Agent B received HTTP 200,
  `paid=true`, `protocolUsed=x402`, and workflow execution
  `vn5ghanemwgvwr6gg5h5i`.
- [x] Confirm the Base USDC transfer onchain, append it to `ledger/txs.json`,
  and retain `$2.78` USDC in the agent wallet for demos.
- [x] Detect and fix negative rescue quotes when current HF already exceeds the
  target by applying `max(0, requiredRepay)` before the live-debt cap.
- [x] Re-run live Base proofs: risk check `bdmcgs8gfe7e5dpar91mk`; rescue quote
  `widkbkgmgqzplv1vfikmj`, returning `170.3146097 GHO` for target HF `2.0`.
- [x] Record that the paid marketplace runtime currently ignores a valid
  `outputMapping` and returns only the final node output. The complete mapped
  values remain present in the KeeperHub audit log; both free packaging actions
  advertised by discovery (`Code` and `HTTP Request`) are Pro-only.

Live proof:

- Risk workflow: `7ov7rxn5jz1ldehwsipoj`
- Latest risk execution: `bdmcgs8gfe7e5dpar91mk`
- Risk endpoint: `https://app.keeperhub.com/mcp/w/vigil-risk-check`
- Rescue quote workflow: `ofihzaszujrq8nhki2kti`
- Latest rescue quote execution: `widkbkgmgqzplv1vfikmj`
- Rescue quote endpoint:
  `https://app.keeperhub.com/mcp/w/vigil-rescue-quote`
- Paid Agent B execution: `vn5ghanemwgvwr6gg5h5i`
- x402 transaction:
  `0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122`
- BaseScan:
  <https://basescan.org/tx/0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122>
- Payment: `20,000` raw Base USDC (`$0.02`) from Agent B to the workflow owner;
  facilitator paid the gas.
- Current risk proof: HF `1.810762178545984082`; liquidation-price scenario
  `12909024592558.094` in Aave Base oracle units.
- Latest quote: `170314609700000000000` raw GHO (`170.3146097 GHO`) to target
  HF `2.0`.
- Local suite: 40 tests; all four KeeperHub workflows deep-validate.

## M7 - Ship

Status: **complete**

- [x] Rewrite the README around the shipped product with a Mermaid architecture
  diagram, eight-step quickstart, safety model, live links, commands, and a
  KeeperHub-surface-to-judging-criteria table.
- [x] Add a timed three-minute demo script with exact PowerShell commands,
  narration, live-payment guard, and a no-extra-spend fallback using the
  committed x402 proof.
- [x] Add `DORAHACKS.md` with repository link, best rescue transaction, x402
  monetization transaction, video outline, KeeperHub surfaces, and submission
  asset links.
- [x] Finalize the onboarding teardown with an executive summary and prioritized
  fixes grounded in the real M1-M6 build path.
- [x] Prepare a small PR-ready KeeperHub improvement: expose plan entitlement
  metadata in `list_action_schemas`, with implementation sketch and acceptance
  tests.
- [x] Keep the paid demo repeatable and compliant: a future Agent B payment
  confirms the challenge-matched Base USDC event and immediately records its
  transaction hash and KeeperHub execution ID.
- [x] Prepare final DoraHacks form copy, attach the public YouTube demo, and
  export a matching 480×480 Vigil logo below the 2 MB upload limit.
- [x] Finalize track, KeeperHub-surface, transaction-network, and honest
  unfinished-work answers for the DoraHacks submission form.

Submission package:

- Repository: <https://github.com/tang-vu/vigil>
- README: `README.md`
- DoraHacks copy: `DORAHACKS.md`
- DoraHacks Details: `docs/dorahacks-details.md`
- BUIDL logo: `demo/vigil-logo-480.png`
- Demo script: `docs/demo-script.md`
- Teardown: `docs/teardown.md`
- PR proposal: `docs/keeperhub-pr-proposal.md`

## Demo media production

Status: **complete**

- [x] Build seven 1080p submission scenes from deterministic JSON.
- [x] Add MiMo V2.5 TTS generation using a built-in English voice.
- [x] Add MiMo V2.5 ASR verification for every generated scene with a minimum
  72% word-similarity gate.
- [x] Add FFmpeg loudness normalization, scene fades, H.264/AAC encoding, and
  burned SRT captions.
- [x] Visually inspect the opening and x402 scenes after rasterization.
- [x] Smoke-test the complete media path at 1920×1080 without calling MiMo.
- [x] Audit `.env` by variable name only and add missing non-secret Base, MiMo
  URL, payment guard, and Telegram defaults through `npm run env:sync`.
- [x] Refuse to use the API key pasted into chat; it must be revoked because it
  is no longer secret.
- [x] Place a newly rotated `MIMO_API_KEY` only in gitignored `.env` and render
  the final video without printing credentials.
- [x] Pass MiMo ASR verification for all seven scenes; minimum word similarity
  `83.67%`.
- [x] Inspect a seven-frame final contact sheet and standardize output to
  1920×1080 H.264 plus mono AAC at 48 kHz.
- [x] Package the final `155.23`-second, `10.84` MB video, burned captions,
  sidecar SRT, and SHA-256 in the repository.

Final media proof:

- Video: `demo/vigil-keeperhub-demo.mp4`
- Captions: `demo/vigil-keeperhub-demo.srt`
- ASR artifact: `artifacts/video/asr-validation.json`
- SHA-256:
  `60f1e2ec95e5e9bb17b2d10a97d5a754284384abf7ec5608da806695dfb08485`

## Onboarding UX bounty website

Status: **private production deployed; public access pending approval**

- [x] Create a Sites project and persist its opaque project ID without
  credentials in `.openai/hosting.json`.
- [x] Build a responsive KeeperHub First Transaction Lab in Next.js.
- [x] Add a six-step, schema-first path from MCP connection to confirmed
  transaction hash plus KeeperHub execution ID.
- [x] Add a local-progress checklist and copy-safe prompts that never request
  private keys.
- [x] Add an eight-scenario error doctor separating official behavior from
  friction observed during Vigil's real build.
- [x] Link the real Aave rescue, Base x402 settlement, teardown, and PR-ready
  improvement proposal.
- [x] Pass the existing 40 tests, strict agent build, production site build,
  and dependency audit with zero known vulnerabilities.
- [x] Visually inspect desktop and emulated 390 px mobile layouts with no
  horizontal overflow.
- [x] Push exact source states to Sites and preserve failed version history:
  version 1 lacked `dist`; version 2 had raw Next.js output but not the required
  `dist/server/index.js` runtime entrypoint.
- [x] Move the deployment build to vinext, pass its 100% compatibility scan,
  produce `dist/server/index.js`, package `.openai/hosting.json`, and verify
  the production server locally over HTTP.
- [x] Save version 3 and deploy it successfully to the owner-only production
  environment.
- [x] Push the cinematic execution-replay source at commit `d276d89`, save it
  as Sites version 4, and deploy it successfully without widening the
  owner-only access policy.
- [ ] After explicit approval, change access from owner-only to public, deploy
  the final saved version, and add the public URL to the submission.

Owner-only production URL:

https://vigil-first-tx-lab.hanhgia2212.chatgpt.site

### Vercel mirror

Status: **public production deployed**

- [x] Confirm the lab has no application backend, database, private API, or
  server-side secret dependency; interactive progress remains in browser
  `localStorage`.
- [x] Verify the existing Vercel CLI session.
- [x] Keep the Sites vinext build intact while configuring Vercel to use the
  standard Next.js build.
- [x] Exclude local secrets, wallet exports, dependencies, and build artifacts
  from CLI uploads.
- [x] Validate the Next.js production build, strict TypeScript, 40 tests, and
  dependency audit before deployment.
- [x] Commit and push the Vercel-specific deployment configuration.
- [x] Deploy publicly through the authenticated Vercel CLI and verify the
  production alias returns HTTP 200 with the expected application content.
- [x] Elevate the public experience with a cinematic replay of the real M4
  KeeperHub execution, including the Aave health-factor recovery from `1.1786`
  to `1.5000`.
- [x] Turn the downstream Telegram failure into a forensic safety story:
  confirmed repayment, retry interlock, separate notification recovery, and
  the canonical receipt seal are visible in one timeline.
- [x] Add ambient signal fields, health-orbit telemetry, execution-node states,
  and an interactive replay while retaining a restrained security-console
  visual language.
- [x] Add responsive layouts for the replay and receipt vault, preserve a
  `390 px` viewport with zero horizontal overflow, and disable animation for
  visitors who prefer reduced motion.
- [x] Re-run strict TypeScript, the Next.js production build, all `40` tests,
  the vinext compatibility/build gates, and the dependency audit.
- [x] Publish deployment `dpl_kT9XhV3KkTvHfJb8b8os9Dpran97` through the
  Vercel REST deployment path after the Windows CLI uploader stalled, then
  verify the canonical production alias returns HTTP `200` with the new hero
  and receipt narrative.
- [x] Add a judge-focused 60-second guided proof mode that moves through the
  real risk trigger, duplicate-write interlock, notification recovery, and
  x402 business proof without inventing demo data.
- [x] Add a wide-screen live-evidence dock, pointer-reactive telemetry field,
  top-level scroll progress, and intersection-driven cinematic reveals.
- [x] Preserve keyboard close, visible focus states, reduced-motion behavior,
  coarse-pointer fallbacks, and a zero-overflow `390 px` mobile layout for the
  new interaction layer.
- [x] Visually inspect Judge Mode in both closed and open states on desktop and
  mobile, then re-run strict TypeScript, `40` tests, Next production build,
  vinext compatibility, and the zero-vulnerability dependency audit.

Public production URL:

https://vigil-first-tx-lab.vercel.app
