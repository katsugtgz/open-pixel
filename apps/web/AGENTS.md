# WEB APP KNOWLEDGE BASE

## OVERVIEW

React/Vite claim shell: landing, guest badge, optional wallet proof, Supabase sync, leaderboard mock.

## WHERE TO LOOK

| Task          | Location                              | Notes                                                           |
| ------------- | ------------------------------------- | --------------------------------------------------------------- |
| Page flow     | `src/App.tsx`                         | All major React sections and handlers live here.                |
| Visual polish | `src/App.css`                         | Pixel UI, responsive layout, animations.                        |
| Supabase init | `src/lib/supabase/client.ts`          | Optional; app uses a local status fallback when env is missing. |
| Vite aliases  | `vite.config.ts`, `tsconfig.app.json` | `@` maps to `src`.                                              |
| Public assets | `public/`                             | Favicons/icons only.                                            |

## CODE MAP

| Symbol           | Location                     | Role                                                                                    |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `Topbar`         | `src/App.tsx`                | In-page nav + repo link.                                                                |
| `HeroSection`    | `src/App.tsx`                | First viewport pitch and game CTA.                                                      |
| `ClaimSection`   | `src/App.tsx`                | Guest badge controls, wallet connect/sign controls.                                     |
| `StatusBar`      | `src/App.tsx`                | User-facing operation status.                                                           |
| `saveGuestClaim` | `src/App.tsx`                | Creates local run, upserts `players`, upserts `quest_runs` when Supabase is configured. |
| `connectWallet`  | `src/App.tsx`                | Requests `eth_requestAccounts`; guest flow still works without it.                      |
| `signProof`      | `src/App.tsx`                | Builds message, requests `personal_sign`, upserts `wallet_proofs`.                      |
| `createClient`   | `src/lib/supabase/client.ts` | `@supabase/ssr` browser client wrapper.                                                 |

## CONVENTIONS

- State uses `useReducer`; keep new claim/proof state in `AppState`/`AppAction` unless it clearly needs extraction.
- `getGuestId()` persists `open_pixel_guest_id` in `localStorage`; do not switch to wallet-derived identity.
- Supabase is optional: no env -> local status path, no hard failure for guest badge UX.
- `personal_sign` params order is `[message, walletAddress]`.
- CSS uses custom properties in `:root`; preserve pixel-art hard shadows and high-contrast safety tags.

## ANTI-PATTERNS

- Do not add a transaction library just for proof signing.
- Do not call `eth_sendTransaction`, `wallet_switchEthereumChain`, approvals, permits, swaps, or contract methods from this app.
- Do not make wallet connect a prerequisite for `Claim guest badge`.
- Do not remove the visible no-token/no-approval/no-contract-call copy near signing.
- Do not store a Supabase service-role key in any `VITE_*` env.

## COMMANDS

```bash
npm run dev -w @open-pixel/web
npm run build -w @open-pixel/web
npm run lint -w @open-pixel/web
npm run typecheck -w @open-pixel/web
```
