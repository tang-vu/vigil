# Vigil

Vigil is an auditable liquidation circuit breaker for Aave positions. It reads
risk signals, applies deterministic safety policy, routes every state-changing
operation through KeeperHub, and records transaction and execution proofs.

## Current status

- M1: real KeeperHub-sponsored Sepolia transaction confirmed and recorded.
- M2: Aave v3 health monitor, Chainlink freshness checks, and jittered backoff.
- M3: deterministic policy engine with tightening-only advisory.

See [PROGRESS.md](./PROGRESS.md) for evidence and milestone details.

## Why the advisory cannot loosen policy

An LLM is useful for interpreting unusual context such as oracle divergence or
market stress, but it is not an execution authority. Vigil's deterministic
engine owns the health-factor threshold, cooldown, per-rescue cap, daily cap,
and idempotency window.

The advisory schema deliberately has no `allow` field. It may only:

- veto a rescue;
- reduce the per-rescue spending cap; or
- increase the cooldown.

Vigil combines advisory constraints using `min` for spend and `max` for
cooldown. Consequently, every advisory-approved execution was already allowed
by deterministic policy. Unit tests enforce this invariant across every denial
class.

## Safety boundary

- No local private key signs or submits transactions.
- Reads and fixed-point calculations use `viem`.
- Writes must go through KeeperHub.
- Confirmed KeeperHub execution IDs and transaction hashes are appended to
  `ledger/txs.json`.

