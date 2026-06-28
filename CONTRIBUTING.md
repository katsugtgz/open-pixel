# Contributing

Thanks for helping build Open Pixel.

## Development

```bash
npm install
npm run build
npm run dev:game
npm run dev:web
```

## Repo hygiene

- Keep the game playable without wallet connection.
- Do not add token, marketplace, approval, or transaction flows without a security review.
- Put reusable proof/types code in `packages/shared`.
- Keep Supabase `service_role` keys out of frontend env files.
- Update docs when behavior changes.

## Commit style

Use small, descriptive commits:

```text
feat(game): add village resource loop
feat(web): add wallet proof receipt
docs: document security model
```

## Pull request checklist

- [ ] `npm run build` passes.
- [ ] README/docs updated if user-facing behavior changed.
- [ ] No secret keys committed.
- [ ] Wallet changes do not introduce tx/approval flows.
- [ ] Supabase changes include RLS considerations.
