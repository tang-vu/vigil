"use client";

import { useEffect, useMemo, useState } from "react";

type LabStep = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  code: string;
  note: string;
  links?: Array<{ label: string; href: string }>;
};

type Diagnosis = {
  label: string;
  signal: string;
  cause: string;
  checks: string[];
  fix: string;
  status: "documented" | "observed";
};

const steps: LabStep[] = [
  {
    number: "01",
    eyebrow: "CONNECT",
    title: "Add the hosted MCP server",
    description:
      "Use OAuth for an interactive local session. Keep organization API keys for headless or CI environments, and never paste them into source.",
    action: "Run in your terminal",
    code: "claude mcp add --transport http keeperhub https://app.keeperhub.com/mcp",
    note: "Then run /mcp in Claude Code and complete the browser OAuth flow.",
    links: [
      {
        label: "Official MCP guide",
        href: "https://docs.keeperhub.com/ai-tools/mcp-server",
      },
    ],
  },
  {
    number: "02",
    eyebrow: "DISCOVER",
    title: "Read the live contract before acting",
    description:
      "KeeperHub tools and action schemas are the source of truth. Discover required fields and chain status at runtime instead of copying stale parameters.",
    action: "Ask your agent",
    code: "Call tools_documentation for direct execution, then list_action_schemas. Report required fields and stable testnets before proposing any write.",
    note: "This prevents parameter guessing and surfaces schema drift before a transaction.",
  },
  {
    number: "03",
    eyebrow: "PREFLIGHT",
    title: "Verify the organization wallet",
    description:
      "Write actions require the organization wallet integration. Confirm it first; do not debug transaction parameters until this check passes.",
    action: "Ask your agent",
    code: "Call get_wallet_integration. Return only the public address, integration status, and supported write readiness. Never expose credential material.",
    note: "No local private key is required or permitted in this path.",
  },
  {
    number: "04",
    eyebrow: "FUND",
    title: "Choose a stable testnet and fund gas",
    description:
      "Start with Ethereum Sepolia or Base Sepolia. Fund the public organization wallet with native gas before testing a token transfer.",
    action: "Stable testnets",
    code: "Ethereum Sepolia: 11155111\nBase Sepolia: 84532",
    note: "Confirm the final network and public recipient before requesting any write.",
    links: [
      {
        label: "Sepolia ETH faucet",
        href: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
      },
      {
        label: "Circle testnet USDC",
        href: "https://faucet.circle.com/",
      },
    ],
  },
  {
    number: "05",
    eyebrow: "EXECUTE",
    title: "Land a reversible dust transaction",
    description:
      "Use KeeperHub direct execution for the first proof. Keep the amount tiny, state the chain explicitly, and require confirmation of the exact resolved request.",
    action: "Copy-safe agent prompt",
    code: "Using the schema you just discovered, call execute_transfer on Sepolia (11155111) for a dust amount to <RECIPIENT>. Show the resolved network, asset, amount, and recipient before executing. Do not sign locally.",
    note: "Replace <RECIPIENT>. Never place an API key, wallet export, or secret in this prompt.",
  },
  {
    number: "06",
    eyebrow: "PROVE",
    title: "Poll confirmation and save both IDs",
    description:
      "Execution is not complete when a request is accepted. Poll the direct execution until terminal status and capture the transaction hash plus execution ID.",
    action: "Ask your agent",
    code: "Poll get_direct_execution_status until confirmed or failed. On confirmation, record the transaction hash and KeeperHub execution ID together in the project ledger.",
    note: "A transaction hash without its KeeperHub execution trail is incomplete evidence.",
  },
];

const diagnoses: Diagnosis[] = [
  {
    label: "Not logged in / wrong organization",
    signal: "MCP calls return authentication errors or show an unexpected org.",
    cause:
      "The browser OAuth session and the agent's active MCP connection can point at different organization state.",
    checks: [
      "Confirm the active organization in the KeeperHub dashboard.",
      "Remove and re-add the MCP server, then complete OAuth again.",
      "For CI, verify that the kh_ key belongs to the intended organization.",
    ],
    fix:
      "Reconnect after switching organizations. Do not keep retrying calls against a stale OAuth session.",
    status: "documented",
  },
  {
    label: "Write action says wallet missing",
    signal: "Reads work, but execute_transfer or a workflow write cannot start.",
    cause:
      "Web3 writes require the organization wallet integration; a recipient or walletId parameter cannot replace it.",
    checks: [
      "Call get_wallet_integration before inspecting write parameters.",
      "Confirm the returned public address matches the wallet you funded.",
      "Check native gas on the selected chain.",
    ],
    fix:
      "Configure or repair the organization wallet integration, then rerun the preflight. Never add a local private key.",
    status: "documented",
  },
  {
    label: "Invalid parameters / schema drift",
    signal: "A call fails with 400 or an unknown-field / missing-field error.",
    cause:
      "An example may be stale, or an action-specific field shape was assumed instead of discovered.",
    checks: [
      "Call tools_documentation for the exact tool.",
      "Call list_action_schemas for workflow actions and current chain status.",
      "Compare value types as well as field names.",
    ],
    fix:
      "Rebuild the request from the returned schema. Stop after two identical errors and record the friction before attempting a workaround.",
    status: "documented",
  },
  {
    label: "Insufficient gas or faucet confusion",
    signal: "Simulation or submission reports insufficient funds.",
    cause:
      "The organization wallet lacks native gas on the application chain, or funds were sent to a different network.",
    checks: [
      "Verify the public wallet address from get_wallet_integration.",
      "Verify the exact chain ID: 11155111 or 84532.",
      "Check native balance before token balance.",
    ],
    fix:
      "Fund native gas on the exact testnet, wait for confirmation, then repeat the balance check before executing.",
    status: "observed",
  },
  {
    label: "Action returns upgrade_required",
    signal: "A schema is discoverable, but workflow creation or update returns HTTP 402.",
    cause:
      "Action discovery currently does not expose organization plan entitlement for every advertised action.",
    checks: [
      "Capture the action type, required plan, and rejected operation.",
      "Do not retry the same mutation unchanged.",
      "Check whether a core-plan action can express the same safe behavior.",
    ],
    fix:
      "Keep the last validated graph and document the entitlement gap. Vigil proposes minimumPlan and availableToOrg fields in schema discovery.",
    status: "observed",
  },
  {
    label: "x402 CHAIN_MISMATCH",
    signal: "A Base USDC challenge is valid, but a testnet-listed workflow is rejected by the first-party wallet.",
    cause:
      "The payment settlement chain can be coupled to the workflow application chain even though they serve different purposes.",
    checks: [
      "Compare the challenge network with the workflow listing chain.",
      "Confirm that no payment was debited before retrying anything.",
      "Keep write workflows on testnet unless mainnet was explicitly authorized.",
    ],
    fix:
      "For a proven read-only product, align its application chain with Base only after explicit approval. The platform fix is to route by the challenge settlement network.",
    status: "observed",
  },
  {
    label: "Paid result ignores outputMapping",
    signal: "The paid call succeeds but returns only the final node's raw output.",
    cause:
      "The marketplace runtime may not apply the workflow's advertised output mapping after execution.",
    checks: [
      "Retain the paid execution ID.",
      "Inspect get_execution for all source values.",
      "Compare the listing output schema with the HTTP 200 body.",
    ],
    fix:
      "Preserve the audit trail and disclose the response limitation. The proposed platform fix applies outputMapping before returning the paid result.",
    status: "observed",
  },
  {
    label: "Paid call has no settlement hash",
    signal: "The wallet reports paid=true and x402 success without transaction details.",
    cause:
      "The first-party wallet response may omit the onchain settlement object.",
    checks: [
      "Record payer, recipient, asset, amount, and challenge network.",
      "Query the public token Transfer event without reading wallet secrets.",
      "Verify the transaction receipt before writing the ledger.",
    ],
    fix:
      "Reconstruct the exact challenge-matched transfer from public logs. KeeperHub should return chain, asset, amount, parties, hash, and receipt status directly.",
    status: "observed",
  },
];

const improvements = [
  {
    id: "01",
    title: "One preflight response",
    copy:
      "Return auth, active org, wallet address, gas balance, chain maturity, and faucet links before the first write.",
  },
  {
    id: "02",
    title: "Entitlements in discovery",
    copy:
      "Expose minimumPlan, availableToOrg, and upgradeRequired in list_action_schemas before workflow mutation.",
  },
  {
    id: "03",
    title: "Payment rail independence",
    copy:
      "Route x402 payment by the challenge network instead of coupling settlement to the workflow application chain.",
  },
  {
    id: "04",
    title: "Typed paid results",
    copy:
      "Apply outputMapping after execution and generate the per-workflow MCP response schema from the same contract.",
  },
  {
    id: "05",
    title: "Settlement as first-class proof",
    copy:
      "Return transaction hash, chain, asset, amount, payer, payee, facilitator, and receipt status from paid calls.",
  },
];

function ShieldMark() {
  return (
    <svg aria-hidden="true" className="shield-mark" viewBox="0 0 72 88">
      <path d="M36 2 67 15v27c0 25-14 42-31 52C19 84 5 67 5 42V15Z" />
      <path className="shield-eye" d="M20 47q16-18 32 0-16 18-32 0Z" />
      <circle className="shield-pupil" cx="36" cy="47" r="6" />
    </svg>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button className="copy-button" onClick={copy} type="button">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function Home() {
  const [completed, setCompleted] = useState<boolean[]>(() =>
    steps.map(() => false),
  );
  const [selectedIssue, setSelectedIssue] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("keeperhub-lab-progress");
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === steps.length &&
          parsed.every((item) => typeof item === "boolean")
        ) {
          setCompleted(parsed);
        }
      } catch {
        window.localStorage.removeItem("keeperhub-lab-progress");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(
        "keeperhub-lab-progress",
        JSON.stringify(completed),
      );
    }
  }, [completed, hydrated]);

  const completedCount = completed.filter(Boolean).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const diagnosis = diagnoses[selectedIssue] ?? diagnoses[0];

  const statusCopy = useMemo(() => {
    if (completedCount === 0) return "Ready for preflight";
    if (completedCount === steps.length) return "Evidence-ready";
    return `${completedCount} of ${steps.length} checks complete`;
  }, [completedCount]);

  function toggleStep(index: number) {
    setCompleted((current) =>
      current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
    );
  }

  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Vigil home">
          <ShieldMark />
          <span>
            <strong>VIGIL</strong>
            <small>FIRST TX LAB</small>
          </span>
        </a>
        <div className="nav-links">
          <a href="#lab">Lab</a>
          <a href="#doctor">Error doctor</a>
          <a href="#proof">Proof</a>
          <a
            className="nav-cta"
            href="https://github.com/tang-vu/vigil"
            rel="noreferrer"
            target="_blank"
          >
            GitHub ↗
          </a>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="kicker">
            <span className="live-dot" />
            Built from a real KeeperHub integration
          </div>
          <h1>
            Your first onchain action should take{" "}
            <span>minutes, not a teardown.</span>
          </h1>
          <p className="hero-lede">
            A guided zero-to-confirmed-transaction path with a safe preflight,
            copy-ready agent prompts, and an error doctor grounded in failures
            Vigil actually hit.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#lab">
              Start the preflight
              <span>↓</span>
            </a>
            <a
              className="secondary-button"
              href="https://sepolia.etherscan.io/tx/0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb"
              rel="noreferrer"
              target="_blank"
            >
              Inspect a real rescue ↗
            </a>
          </div>
          <div className="hero-trust">
            <span>NO LOCAL KEYS</span>
            <span>SCHEMA-FIRST</span>
            <span>TESTNET-FIRST</span>
            <span>HASH + EXECUTION ID</span>
          </div>
        </div>

        <div className="terminal-card" aria-label="First transaction path">
          <div className="terminal-bar">
            <span className="terminal-lights">
              <i />
              <i />
              <i />
            </span>
            <span>keeperhub / first-transaction</span>
            <span className="terminal-safe">SAFE PATH</span>
          </div>
          <div className="terminal-body">
            <div className="terminal-line">
              <span>01</span>
              <i className="ok">✓</i>
              <p>
                MCP <small>connected</small>
              </p>
            </div>
            <div className="terminal-line">
              <span>02</span>
              <i className="ok">✓</i>
              <p>
                schema <small>discovered live</small>
              </p>
            </div>
            <div className="terminal-line">
              <span>03</span>
              <i className="ok">✓</i>
              <p>
                wallet <small>organization integration</small>
              </p>
            </div>
            <div className="terminal-line">
              <span>04</span>
              <i className="ok">✓</i>
              <p>
                network <small>Sepolia · 11155111</small>
              </p>
            </div>
            <div className="terminal-line active">
              <span>05</span>
              <i>→</i>
              <p>
                execute <small>through KeeperHub only</small>
              </p>
            </div>
            <div className="terminal-result">
              <span>confirmed</span>
              <strong>tx hash + execution ID</strong>
              <div className="hash-line" />
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Vigil proof summary">
        <div className="shell proof-grid">
          <div>
            <span className="metric-value">1.1786 → 1.5000</span>
            <span className="metric-label">Aave health factor</span>
          </div>
          <div>
            <span className="metric-value">2</span>
            <span className="metric-label">real onchain proofs</span>
          </div>
          <div>
            <span className="metric-value">40 / 40</span>
            <span className="metric-label">tests passing</span>
          </div>
          <div>
            <span className="metric-value">$0.02</span>
            <span className="metric-label">Base x402 settlement</span>
          </div>
        </div>
      </section>

      <section className="section shell" id="lab">
        <div className="section-heading">
          <div>
            <span className="section-kicker">THE FIRST TRANSACTION LAB</span>
            <h2>Six guarded steps. One complete proof.</h2>
          </div>
          <div className="progress-card" aria-live="polite">
            <div className="progress-copy">
              <span>{statusCopy}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <div style={{ width: `${progress}%` }} />
            </div>
            <button
              onClick={() => setCompleted(steps.map(() => false))}
              type="button"
            >
              Reset locally
            </button>
          </div>
        </div>

        <div className="steps">
          {steps.map((step, index) => (
            <article
              className={`step-card ${completed[index] ? "complete" : ""}`}
              key={step.number}
            >
              <div className="step-rail">
                <span>{step.number}</span>
                <div />
              </div>
              <div className="step-content">
                <span className="step-eyebrow">{step.eyebrow}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className="code-panel">
                  <div className="code-label">
                    <span>{step.action}</span>
                    <CopyButton value={step.code} />
                  </div>
                  <pre>
                    <code>{step.code}</code>
                  </pre>
                </div>
                <div className="step-foot">
                  <p>
                    <span>i</span>
                    {step.note}
                  </p>
                  {step.links?.map((link) => (
                    <a
                      href={link.href}
                      key={link.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label} ↗
                    </a>
                  ))}
                </div>
              </div>
              <button
                aria-label={`${completed[index] ? "Mark incomplete" : "Mark complete"}: ${step.title}`}
                aria-pressed={completed[index]}
                className="check-button"
                onClick={() => toggleStep(index)}
                type="button"
              >
                {completed[index] ? "✓" : ""}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="doctor-wrap" id="doctor">
        <div className="section shell">
          <div className="section-heading doctor-heading">
            <div>
              <span className="section-kicker coral">EVIDENCE-BASED ERROR DOCTOR</span>
              <h2>Match the signal. Stop the blind retry.</h2>
              <p>
                Official behavior and firsthand failures are labeled separately.
                No workaround asks for a private key.
              </p>
            </div>
          </div>

          <div className="doctor-grid">
            <div className="issue-list" role="tablist" aria-label="Error signals">
              {diagnoses.map((item, index) => (
                <button
                  aria-selected={selectedIssue === index}
                  className={selectedIssue === index ? "selected" : ""}
                  key={item.label}
                  onClick={() => setSelectedIssue(index)}
                  role="tab"
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.label}</strong>
                  <i>→</i>
                </button>
              ))}
            </div>

            <article className="diagnosis" role="tabpanel">
              <div className="diagnosis-top">
                <span className={`evidence-tag ${diagnosis?.status}`}>
                  {diagnosis?.status === "observed"
                    ? "OBSERVED BY VIGIL"
                    : "OFFICIAL PATH"}
                </span>
                <span>DIAGNOSIS / {String(selectedIssue + 1).padStart(2, "0")}</span>
              </div>
              <h3>{diagnosis?.label}</h3>
              <p className="signal">{diagnosis?.signal}</p>

              <div className="diagnosis-block">
                <span>LIKELY CAUSE</span>
                <p>{diagnosis?.cause}</p>
              </div>

              <div className="diagnosis-block">
                <span>CHECK IN THIS ORDER</span>
                <ol>
                  {diagnosis?.checks.map((check) => <li key={check}>{check}</li>)}
                </ol>
              </div>

              <div className="fix-block">
                <span>SAFE NEXT MOVE</span>
                <p>{diagnosis?.fix}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section shell" id="proof">
        <div className="section-heading">
          <div>
            <span className="section-kicker">THE RECEIPT, NOT THE CLAIM</span>
            <h2>A working transaction beats a polished mockup.</h2>
          </div>
        </div>

        <div className="proof-cards">
          <a
            className="proof-card rescue"
            href="https://sepolia.etherscan.io/tx/0xa03a49a8213415e9fc0ec53c423c707ed2c869b92841781c4174abced9a958bb"
            rel="noreferrer"
            target="_blank"
          >
            <div className="proof-card-top">
              <span>CORE PRODUCT PROOF</span>
              <i>↗</i>
            </div>
            <h3>Aave v3 partial repayment</h3>
            <p>
              KeeperHub execution <code>3r554lkdru7bn225qdwsz</code>
            </p>
            <div className="proof-result">
              <span>HEALTH FACTOR</span>
              <strong>1.1786 → 1.5000</strong>
            </div>
            <small>Ethereum Sepolia · sponsored · 205,376 gas</small>
          </a>

          <a
            className="proof-card payment"
            href="https://basescan.org/tx/0x440baa100eb85a9b586ead523c05a1918247fccb610098718e2f2fd0317d4122"
            rel="noreferrer"
            target="_blank"
          >
            <div className="proof-card-top">
              <span>MONETIZATION PROOF</span>
              <i>↗</i>
            </div>
            <h3>Agent-to-agent x402 payment</h3>
            <p>
              KeeperHub execution <code>vn5ghanemwgvwr6gg5h5i</code>
            </p>
            <div className="proof-result">
              <span>SETTLED ONCHAIN</span>
              <strong>$0.02 Base USDC</strong>
            </div>
            <small>Base mainnet · public Transfer verified</small>
          </a>
        </div>
      </section>

      <section className="improvements-wrap">
        <div className="section shell">
          <div className="section-heading">
            <div>
              <span className="section-kicker mint">PR-SHAPED IMPROVEMENTS</span>
              <h2>What would get the next builder there faster?</h2>
            </div>
            <a
              className="text-link"
              href="https://github.com/tang-vu/vigil/blob/main/docs/teardown.md"
              rel="noreferrer"
              target="_blank"
            >
              Read the full teardown ↗
            </a>
          </div>

          <div className="improvements">
            {improvements.map((item) => (
              <article key={item.id}>
                <span>{item.id}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>

          <div className="cta-panel">
            <div>
              <span>OPEN SOURCE · BUILT IN PUBLIC</span>
              <h2>Take the lab. Improve the last mile.</h2>
              <p>
                The source, reproducible proofs, teardown, and PR-ready proposal
                all live in the Vigil repository.
              </p>
            </div>
            <div className="cta-actions">
              <a
                className="primary-button"
                href="https://github.com/tang-vu/vigil"
                rel="noreferrer"
                target="_blank"
              >
                Explore Vigil ↗
              </a>
              <a
                className="secondary-button"
                href="https://github.com/tang-vu/vigil/blob/main/docs/keeperhub-pr-proposal.md"
                rel="noreferrer"
                target="_blank"
              >
                View PR proposal
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#top">
          <ShieldMark />
          <span>
            <strong>VIGIL</strong>
            <small>KEEPERHUB FIRST TX LAB</small>
          </span>
        </a>
        <p>
          Community onboarding resource. Always confirm current schemas with
          KeeperHub before executing.
        </p>
        <div>
          <a
            href="https://docs.keeperhub.com/quickstart"
            rel="noreferrer"
            target="_blank"
          >
            Official docs ↗
          </a>
          <a
            href="https://youtu.be/1a25RRZmkJ8"
            rel="noreferrer"
            target="_blank"
          >
            Demo ↗
          </a>
        </div>
      </footer>
    </main>
  );
}
