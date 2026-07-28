# PR proposal: expose action plan entitlements in schema discovery

## Why this is the best small onboarding fix

During Vigil development, both `code/run-code` and `HTTP Request` appeared in
`list_action_schemas` with complete parameter schemas and no availability
warning. The first workflow mutation using either action returned HTTP 402
`upgrade_required`. The builder cannot discover this limitation before changing
a live workflow.

This is small enough for one focused KeeperHub pull request and prevents wasted
workflow design work for every MCP-first builder.

## Proposed response change

Add an `entitlement` object to each action schema:

```json
{
  "actionType": "HTTP Request",
  "requiresCredentials": false,
  "entitlement": {
    "minimumPlan": "pro",
    "availableToOrg": false,
    "upgradeRequired": true
  }
}
```

Free actions would return:

```json
{
  "entitlement": {
    "minimumPlan": "free",
    "availableToOrg": true,
    "upgradeRequired": false
  }
}
```

## Implementation sketch

1. Reuse the same feature-to-plan registry already used by
   `update_workflow` to produce `upgrade_required`.
2. Resolve the caller's organization entitlement once per
   `list_action_schemas` request.
3. Decorate actions without removing them; agents can still design portable
   workflows while knowing what the current organization can execute.
4. When the call is unauthenticated, omit `availableToOrg` or return `null`
   rather than guessing.

## Acceptance tests

- a free organization sees Code and HTTP Request with
  `availableToOrg=false`, `minimumPlan=pro`;
- `math/aggregate`, Condition, and read-contract show
  `availableToOrg=true`;
- a Pro organization sees the same schema shapes with both actions available;
- filtering by category preserves entitlement metadata;
- the entitlement feature IDs match the IDs returned by
  `upgrade_required`; and
- no secret, billing identifier, or internal plan object is exposed.

## Optional follow-up

Let `validate_workflow` accept an inline definition and return entitlement
errors before `create_workflow` or `update_workflow`. That solves the separate
validate-before-create gap, but it should not expand the first PR.
