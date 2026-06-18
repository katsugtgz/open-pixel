# Security model

Open Pixel is designed to avoid the wallet-drain patterns users fear in Web3 games.

## Default mode

Players can play as guests. Wallet connection is optional.

## Wallet proof mode

The claim page uses a readable `personal_sign` message only.

Allowed:

- `eth_requestAccounts`
- `personal_sign`

Not allowed in MVP:

- `eth_sendTransaction`
- `eth_signTransaction`
- token `approve`
- NFT `setApprovalForAll`
- EIP-2612 `permit`
- swap calls
- marketplace order signing
- opaque hex blind-signing
- smart contract writes

## User-facing receipt

After signing, the UI shows:

```text
Method: personal_sign
Transaction: none
Contract call: none
Token approval: none
NFT approval: none
Spender: none
```

## Supabase keys

- Browser: anon key only.
- Never expose `service_role` in Vite env.
- RLS is enabled in `supabase/schema.sql`.

MVP policies allow public inserts for hackathon simplicity. Tighten before production with server-side verification or authenticated per-player sessions.

## Threats outside MVP scope

- Sybil attacks on guest IDs.
- Bot farming.
- Economic exploit resistance.
- Production wallet-proof replay protection beyond nonce/expiration in signed message.

These are acceptable for a contest demo and must be solved before any real rewards.
