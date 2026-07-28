import type { TighteningAdvisory } from "./engine.js";

const ALLOWED_FIELDS = new Set([
  "veto",
  "maxSpendPerRescueRaw",
  "minimumCooldownMs",
  "rationale",
]);

export function parseTighteningAdvisory(value: unknown): TighteningAdvisory {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Advisory must be a JSON object");
  }

  const record = value as Record<string, unknown>;
  for (const field of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(field)) {
      throw new Error(`Advisory field is not allowed: ${field}`);
    }
  }

  const advisory: {
    veto?: boolean;
    maxSpendPerRescueRaw?: bigint;
    minimumCooldownMs?: number;
    rationale?: string;
  } = {};

  if (record["veto"] !== undefined) {
    if (typeof record["veto"] !== "boolean") {
      throw new TypeError("Advisory veto must be boolean");
    }
    advisory.veto = record["veto"];
  }
  if (record["maxSpendPerRescueRaw"] !== undefined) {
    const raw = record["maxSpendPerRescueRaw"];
    if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
      throw new TypeError(
        "Advisory maxSpendPerRescueRaw must be a non-negative decimal string",
      );
    }
    advisory.maxSpendPerRescueRaw = BigInt(raw);
  }
  if (record["minimumCooldownMs"] !== undefined) {
    const cooldown = record["minimumCooldownMs"];
    if (
      typeof cooldown !== "number" ||
      !Number.isSafeInteger(cooldown) ||
      cooldown < 0
    ) {
      throw new TypeError(
        "Advisory minimumCooldownMs must be a non-negative safe integer",
      );
    }
    advisory.minimumCooldownMs = cooldown;
  }
  if (record["rationale"] !== undefined) {
    if (typeof record["rationale"] !== "string") {
      throw new TypeError("Advisory rationale must be a string");
    }
    advisory.rationale = record["rationale"];
  }

  return advisory;
}

