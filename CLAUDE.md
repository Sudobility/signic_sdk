# Signic SDK

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it. Always stay on the current branch — do not
> create feature branches for code changes.

TypeScript/JavaScript SDK for the Signic decentralized email platform. Runs in Node.js (>=20) and the browser. Authenticates wallets via SIWE (Ethereum) or SIWS (Solana) and provides read/send/manage access to emails on a WildDuck mail server.

Published to **GitHub Packages** as `@sudobility/signic_sdk` (not public npm). ESM-only. License BUSL-1.1.

## Stack

- TypeScript ~5.9, target ES2020, module ESNext, `moduleResolution: bundler`
- **Zero runtime dependencies** — wallet signing is injected by the consumer via a `signMessage` callback. No viem/ethers/axios/node-fetch.
- Native `fetch`, `btoa`, `globalThis.crypto` (hence Node >=20 + browser).
- Dev/tooling: Vitest, ESLint (flat config) + Prettier, tsc. Package manager: Bun (`bun.lock`).

## Commands

```bash
bun run build         # Compile to ESM (dist/) via tsconfig.esm.json
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint (lint:fix to auto-fix)
bun run test:run      # Vitest single run (also: test:unit; test:watch; test:coverage)
bun run verify        # typecheck + lint + test:unit + build — run before declaring done
```

There is **no** `npm run test` script — use `test:run` / `test:unit` / `test:watch`. All scripts also work with `npm run`.

## Architecture

```
SignicClient (src/client.ts)
├── Indexer API  — sign-in message, signature verification, custom addresses
└── WildDuck API — access token, read/send email, mailbox/message ops
```

**Auth flow** (`connect(address)`, 5 steps): fetch sign-in message from Indexer → pass to the `signMessage` callback → verify signature with Indexer (get wallet accounts) → authenticate with WildDuck (get Bearer token) → find INBOX mailbox id. The address **returned by `signMessage`** (not the `connect` argument) is the authenticated identity; it is stored in `authState`.

**Email addresses** derive from wallet addresses: `{walletAddress}@{emailDomain}`. Wallets can also claim a human-readable custom local part.

**Two auth header styles:**
- WildDuck reads/updates use `Authorization: Bearer <token>` (`wildduckHeaders()`).
- Indexer writes + WildDuck `submit` use the signature trio `x-signature` / `x-message` / `x-signer`, re-signing a fresh random message each call (`generateIndexerAuth()` / `indexerAuthHeaders()`). `x-message` is URL-encoded; signatures are base64 (hex `0x…` is converted via `formatSignatureToBase64`).

## Project structure

```
src/
├── index.ts          — Public exports (SignicClient, types, errors, subaddress helpers)
├── client.ts         — SignicClient class (all public methods + private helpers)
├── types.ts          — Public types (top) + internal API response types (bottom)
├── errors.ts         — Error hierarchy: SignicError > Auth | Network | Validation
├── subaddress.ts     — Pure Gmail-style "+tag" helpers (dependency-free, no auth)
└── network/
    └── http.ts       — fetch wrapper (httpGet/httpPost/httpPut) + status→error mapping
# *.test.ts files sit beside their modules
```

## Conventions

- ESM-only (`"type": "module"`) — use `.js` extensions in all relative imports.
- All public API surface is re-exported from `src/index.ts` — add new exports there.
- Public types go in the **top** section of `types.ts`; internal API response shapes in the **bottom** section. Never expose raw WildDuck/Indexer shapes — map them to public `Signic*` types.
- Auth-required methods call `this.requireAuth()` first (throws `SignicAuthError`). Public methods that skip it: constructor, `isConnected`, `checkCustomAddressAvailability`. Note `getAddress`/`getEmailAddress` **do** require `connect()`.
- API calls go through `httpGet`/`httpPost`/`httpPut`, then check `response.data.success` before mapping.
- Error mapping (in `http.ts` `handleApiError`): 401/403 → `SignicAuthError`, 400/422 → `SignicValidationError`, other non-2xx → `SignicError`, fetch failure → `SignicNetworkError`.
- Tests use Vitest with `vi.stubGlobal('fetch', mockFetch)`; `client.test.ts` has `makeClient()` and `createConnectedClient()` helpers plus a `TEST_SIGN_MESSAGE` vi.fn.

## Adding a new public method

1. Add internal response types to the bottom of `types.ts`; public return types to the top.
2. Implement on `SignicClient` in `client.ts` — call `this.requireAuth()` if auth is needed, use `httpGet`/`httpPost`/`httpPut`, check `response.data.success`, map to public types.
3. Export new public types from `index.ts`.
4. Add tests in `client.test.ts` using `createConnectedClient()` + mocked fetch.
5. Run `bun run verify`.

## Related projects (same machine)

- `mail_box_indexer` — Blockchain indexer backend (Ponder + Hono): SIWE/SIWS auth, custom addresses, delivers on-chain email to WildDuck.
- `wildduck` — WildDuck mail server (Node.js + MongoDB): stores/serves email via REST/IMAP/POP3.
- `signic_sdk_demo` — React demo app consuming this SDK.

## Gotchas

- The SDK never touches private keys — all signing is the consumer's `signMessage` callback. Don't add key-management or a `privateKey` config.
- `.npmrc` scopes `@sudobility` to `npm.pkg.github.com`; installs need a GitHub Packages token.
- `connect()` requires an `address` argument; the signer address from the callback can legitimately differ and wins.
