# SHARED PACKAGE KNOWLEDGE BASE

## OVERVIEW

Tiny TypeScript package for cross-app proof types, readable signing message, security receipt, and Supabase error diagnostics.

## WHERE TO LOOK

| Task       | Location              | Notes                                          |
| ---------- | --------------------- | ---------------------------------------------- |
| Public API | `src/index.ts`        | Exports all package types/functions/constants. |
| Tests      | `test/index.test.mjs` | Imports built `dist`; run build first.         |
| TS output  | `tsconfig.json`       | Emits declarations and JS into `dist`.         |

## CODE MAP

| Symbol                        | Role                                                 |
| ----------------------------- | ---------------------------------------------------- |
| `QuestRun`                    | Shared shape for local/Supabase quest result.        |
| `WalletProof`                 | Shared shape for signed proof records.               |
| `createGuestId`               | Generates `guest_${crypto.randomUUID()}` IDs.        |
| `buildProofMessage`           | Produces the exact readable `personal_sign` payload. |
| `SECURITY_RECEIPT`            | Canonical no-tx/no-approval receipt values.          |
| `isSupabaseMissingTableError` | Detects schema-cache/missing-table failures.         |
| `formatSupabaseError`         | Adds operator action for missing schema.             |

## CONVENTIONS

- Keep exports centralized in `src/index.ts`; there is no internal module tree yet.
- Tests use Node's built-in `node:test` and `assert/strict`.
- `npm run test -w @open-pixel/shared` runs `tsc`, then tests `dist`.
- Proof message text is product/security surface; update tests with any intentional wording change.
- Wallet proof method type is the literal string `"personal_sign"`.

## ANTI-PATTERNS

- Do not add chain transaction, approval, spender, or contract-call fields to `SECURITY_RECEIPT` unless they remain explicit `"none"` values.
- Do not make `createGuestId` depend on wallet address.
- Do not loosen missing-schema detection so permission errors look like setup errors.
- Do not import browser-only APIs except guarded Web APIs already available in target runtimes.

## COMMANDS

```bash
npm run build -w @open-pixel/shared
npm run test -w @open-pixel/shared
npm run typecheck -w @open-pixel/shared
```
