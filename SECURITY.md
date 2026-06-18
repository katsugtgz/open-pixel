# Security policy

## Supported version

Open Pixel is currently a hackathon prototype. Security fixes target `main`.

## Reporting a vulnerability

Please open a private report through GitHub Security Advisories if available, or contact the maintainers directly.

Do not publicly disclose wallet, Supabase, or signing issues before maintainers can respond.

## Wallet safety policy

Open Pixel must remain guest-first. Wallet proof is optional.

MVP wallet code may only use:

- `eth_requestAccounts`
- `personal_sign`

Do not add these without review:

- transactions
- token approvals
- NFT approvals
- permits
- swaps
- marketplace order signing
- blind hex signing

## Secret handling

Never commit:

- Supabase `service_role` keys
- wallet private keys
- seed phrases
- API keys
- `.env` files

Frontend may use Supabase anon key only.
