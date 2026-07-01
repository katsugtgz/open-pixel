# Web App Knowledge Base

## Overview

React/Vite claim shell: landing, Guest Badge claim, optional Wallet Proof, Supabase sync, leaderboard mock.

Current implementation can create a demo quest run locally. Target product truth: real Guest Badge claim should depend on a Game Completion Receipt from the RPG-JS game. Until that bridge exists, label claim-only completion as demo behavior.

## Where To Look

| Task                | Location                              | Notes                                                      |
| ------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Page flow           | `src/App.tsx`                         | Major React sections and handlers.                         |
| Claim/proof logic   | `src/lib/claimProof.ts`               | Guest claim, wallet connect, readable proof signing.       |
| Leaderboard loading | `src/lib/leaderboard.ts`              | Supabase or demo rows.                                     |
| Visual polish       | `src/App.css`                         | Pixel UI, responsive layout, animations.                   |
| Supabase init       | `src/lib/supabase/client.ts`          | Optional; app uses local status fallback when env missing. |
| Vite aliases        | `vite.config.ts`, `tsconfig.app.json` | `@` maps to `src`.                                         |
| Public assets       | `public/`                             | Favicons/icons/media.                                      |

## Code Map

| Symbol           | Location                     | Role                                                               |
| ---------------- | ---------------------------- | ------------------------------------------------------------------ |
| `Topbar`         | `src/App.tsx`                | In-page nav + repo link.                                           |
| `HeroSection`    | `src/App.tsx`                | First viewport pitch game CTA.                                     |
| `ClaimSection`   | `src/App.tsx`                | Guest Badge controls, wallet connect/sign controls.                |
| `StatusBar`      | `src/App.tsx`                | User-facing operation status.                                      |
| `saveGuestClaim` | `src/lib/claimProof.ts`      | Upserts `players` and `quest_runs` when Supabase configured.       |
| `connectWallet`  | `src/lib/claimProof.ts`      | Requests `eth_requestAccounts`; guest flow still works without it. |
| `signQuestProof` | `src/lib/claimProof.ts`      | Builds message, requests `personal_sign`, upserts `wallet_proofs`. |
| `createClient`   | `src/lib/supabase/client.ts` | `@supabase/ssr` browser client.                                    |

## Product Rules

- Do not make wallet connect a prerequisite for Guest Badge eligibility.
- Do not let the claim page pretend it verified game completion unless it consumed a Game Completion Receipt.
- Do not call `eth_sendTransaction`, `wallet_switchEthereumChain`, approvals, permits, swaps, or contract methods.
- Do not remove visible no-token/no-approval/no-contract-call copy near signing.
- Do not store Supabase service-role key in any `VITE_*` env.

## Commands

```bash
npm run dev -w @open-pixel/web
npm run build -w @open-pixel/web
npm run lint -w @open-pixel/web
npm run typecheck -w @open-pixel/web
```
