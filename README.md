# @sudobility/signic_sdk

TypeScript/JavaScript SDK for the [Signic](https://signic.email) decentralized email platform. Works in Node.js and the browser. Authenticate with an Ethereum (SIWE) or Solana (SIWS) wallet, then read, send, and manage emails stored on a WildDuck mail server.

Signic email addresses are derived from wallet addresses: `{walletAddress}@{emailDomain}` (e.g. `0xabc...@signic.email`). Wallets may also claim a human-readable custom address (e.g. `john@signic.email`).

## Installation

```bash
npm install @sudobility/signic_sdk
# or
bun add @sudobility/signic_sdk
```

This package is published to **GitHub Packages**, not the public npm registry. Consumers must point the `@sudobility` scope at GitHub Packages (the repo's `.npmrc` already does this for local development) and provide an auth token:

```ini
# .npmrc
@sudobility:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_READ_TOKEN}
```

**Requirements:** Node.js >= 20.0.0 (uses native `fetch`, `btoa`, and `globalThis.crypto`). The SDK has **zero runtime dependencies** — wallet signing is supplied by you via a callback.

## Quick Start

```typescript
import { SignicClient } from '@sudobility/signic_sdk';

const client = new SignicClient({
  indexerUrl: 'https://api.signic.email/idx',
  wildduckUrl: 'https://api.signic.email/api',
  // You own the key. The SDK never sees it — it only asks you to sign.
  signMessage: async (message) => ({
    address: wallet.address,
    signature: await wallet.signMessage(message),
  }),
});

// Authenticate via SIWE/SIWS. Pass the wallet address to sign in with.
await client.connect(wallet.address);

console.log(client.getAddress());      // "0xf39F..."
console.log(client.getEmailAddress()); // "0xf39F...@signic.email"

// Fetch unread emails
const { emails, total } = await client.getUnreadEmails(10);
console.log(`${total} unread emails`);

// Get full email content
const full = await client.getEmail(emails[0].id);
console.log(full.subject, full.text);

// Mark as read
await client.markAsRead(emails[0].id);

// Send an email
await client.sendEmail({
  to: 'someone@example.com',
  subject: 'Hello from Signic',
  html: '<p>Sent from my wallet.</p>',
});
```

## The `signMessage` callback

The SDK does not hold or manage private keys. Instead you provide a `signMessage` callback that signs an arbitrary string with the user's wallet and returns the signer address alongside the signature. This keeps the SDK wallet-agnostic (viem, ethers, browser extension, Solana wallet adapter, hardware wallet, etc.) and dependency-free.

```typescript
signMessage: (message: string) => Promise<{ address: string; signature: string }>
```

- `address` — the wallet address that produced the signature (EVM hex or Solana base58). This is the address actually used for authentication.
- `signature` — a hex string (`0x`-prefixed) or base64 string. Hex is converted to base64 internally.

The callback is invoked during `connect()` and again (with a fresh random message) for `sendEmail()` and the custom-address write methods.

## API Reference

### `new SignicClient(config)`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `indexerUrl` | `string` | Yes | Indexer API base URL (trailing slashes trimmed) |
| `wildduckUrl` | `string` | Yes | WildDuck API base URL (trailing slashes trimmed) |
| `signMessage` | `(msg: string) => Promise<SignMessageResult>` | Yes | Wallet signing callback (see above) |
| `emailDomain` | `string` | No | Email / SIWE domain (default: `signic.email`) |
| `chainId` | `number` | No | EVM chain ID for the SIWE message (default: `1`) |

### Methods

#### `connect(address: string): Promise<void>`

Authenticate with the Signic platform via SIWE/SIWS. Must be called before any method that requires auth.

Performs a 5-step flow:
1. Fetch a sign-in message from the Indexer for `address`
2. Pass the message to your `signMessage` callback
3. Verify the signature with the Indexer (retrieves wallet accounts)
4. Authenticate with WildDuck to obtain an access token
5. Locate the INBOX mailbox

The address returned by `signMessage` (not the `address` argument) becomes the authenticated identity.

**Throws:** `SignicAuthError` on auth failure, `SignicNetworkError` on network failure.

#### `getAddress(): string`

Returns the authenticated wallet address. **Requires `connect()`** — throws `SignicError` if called first.

#### `getEmailAddress(): string`

Returns the Signic email address (e.g. `0xabc...@signic.email`). **Requires `connect()`**.

#### `isConnected(): boolean`

Returns `true` if `connect()` has completed successfully.

#### `getUnreadEmails(limit?: number): Promise<UnreadEmailsResult>`

Fetch unread emails from the inbox. Returns summary objects (use `getEmail()` for full content). `limit` defaults to `50`. **Returns:** `{ emails: SignicEmail[], total: number }`.

#### `getEmail(emailId: number, mailboxId?: string): Promise<SignicEmailDetail>`

Fetch the complete email by ID, including HTML/text body, all recipients, attachments, flags, and verification results. `mailboxId` defaults to INBOX.

#### `markAsRead(messageId: number, mailboxId?: string): Promise<MarkAsReadResult>`

Mark a message as read (sets the `\Seen` flag). `mailboxId` defaults to INBOX. **Returns:** `{ success: boolean, updated: number }`.

#### `sendEmail(params: SendEmailParams): Promise<SendEmailResult>`

Send an email via WildDuck. Authenticates the submission by signing a fresh random message through the `signMessage` callback. **Returns:** `{ messageId: string, queueId: string }`.

#### `checkCustomAddressAvailability(name: string): Promise<CustomAddressAvailability>`

Check whether a desired custom local part is available. **Public — does not require `connect()`.** When unavailable, `reason` explains why (`taken`, `reserved`, `wallet_address`, `name_service_postfix`, `invalid_format`, `no_credits`, `already_set`).

#### `getCustomAddress(): Promise<CustomAddressState>`

Get the connected wallet's custom-address state (active custom address, if any, and remaining set allowance). **Requires `connect()`**.

#### `setCustomAddress(name: string): Promise<CustomAddressState>`

Claim a custom address for the connected wallet. Can be set only once per credit, and is rejected if taken, reserved, wallet-like, or ending in an ENS/SNS postfix. **Requires `connect()`.** Throws `SignicValidationError` (400) if the name is rejected.

### Subaddressing helpers

Pure, dependency-free helpers for Gmail-style `+tag` subaddresses (e.g. `john+amazon@signic.email` delivers to `john`):

| Function | Returns | Description |
|----------|---------|-------------|
| `parseSubaddress(email)` | `ParsedSubaddress \| null` | Split into `localPart`, `baseLocal`, `tag`, `domain` |
| `stripSubaddressTag(email)` | `string` | `base@domain` with any `+tag` removed |
| `getSubaddressTag(email)` | `string \| null` | The tag, or `null` |
| `hasSubaddressTag(email)` | `boolean` | Whether the address carries a `+tag` |
| `buildSubaddress(baseEmail, tag)` | `string` | Build/replace a `base+tag@domain` address |
| `sameBaseAddress(a, b)` | `boolean` | Whether two addresses resolve to the same mailbox |

### Types

Key exported types: `SignicClientConfig`, `SignMessageResult`, `SignicEmail`, `SignicEmailAddress`, `SignicEmailDetail`, `SignicEmailAttachment`, `UnreadEmailsResult`, `MarkAsReadResult`, `SendEmailParams`, `SendEmailResult`, `CustomAddressAvailability`, `CustomAddressState`, `ParsedSubaddress`.

#### `SignicEmail`

Summary email object returned by `getUnreadEmails()`.

```typescript
interface SignicEmail {
  id: number;                   // Message UID
  mailboxId: string;            // Mailbox ID
  from: SignicEmailAddress;     // Sender
  to: SignicEmailAddress[];     // Recipients
  subject: string;              // Subject line
  date: string;                 // ISO 8601 date
  intro: string;                // Preview (~128 chars)
  seen: boolean;                // Read status
  hasAttachments: boolean;      // Has file attachments
}
```

#### `SignicEmailDetail`

Full email object returned by `getEmail()`.

```typescript
interface SignicEmailDetail {
  id: number;
  mailboxId: string;
  thread: string;                        // Conversation thread ID
  from: SignicEmailAddress;
  replyTo?: SignicEmailAddress;
  to: SignicEmailAddress[];
  cc: SignicEmailAddress[];
  bcc: SignicEmailAddress[];
  subject: string;
  messageId: string;                     // Message-ID header
  date: string;                          // Date header (ISO 8601)
  idate: string;                         // Server receive date (ISO 8601)
  size: number;                          // Size in bytes
  seen: boolean;
  flagged: boolean;
  deleted: boolean;
  draft: boolean;
  answered: boolean;
  forwarded: boolean;
  html: string[];                        // HTML body parts
  text: string;                          // Plain text body
  attachments: SignicEmailAttachment[];   // File attachments
  verificationResults?: {                // TLS, SPF, DKIM results
    tls: { name: string; version: string } | false;
    spf: Record<string, unknown> | false;
    dkim: Record<string, unknown> | false;
  };
}
```

#### `SignicEmailAttachment`

```typescript
interface SignicEmailAttachment {
  id: string;               // Attachment ID
  hash: string;             // SHA-256 hash (hex)
  filename: string;         // Original filename
  contentType: string;      // MIME type
  disposition: string;      // "attachment" or "inline"
  transferEncoding: string; // Transfer encoding
  related: boolean;         // Inline/embedded image
  sizeKb: number;           // Approximate size in KB
}
```

### Error Classes

All errors extend `SignicError`, which carries `operation` and `statusCode` properties.

| Error | When |
|-------|------|
| `SignicError` | Base class for all SDK errors (also: non-JSON response, other non-2xx) |
| `SignicAuthError` | Authentication failure (401/403) or calling auth-required methods before `connect()` |
| `SignicNetworkError` | Network failure (DNS, timeout, no response) — no `statusCode` |
| `SignicValidationError` | Input validation failure (400/422) |

```typescript
import { SignicError, SignicAuthError } from '@sudobility/signic_sdk';

try {
  await client.getUnreadEmails();
} catch (err) {
  if (err instanceof SignicAuthError) {
    console.error('Auth failed:', err.operation, err.statusCode);
  }
}
```

## Development

```bash
bun install           # install dev dependencies
bun run build         # compile to ESM in dist/
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint (lint:fix to auto-fix)
bun run test:run      # run the Vitest suite once
bun run test:watch    # Vitest in watch mode
bun run test:coverage # Vitest with v8 coverage
bun run verify        # typecheck + lint + test:unit + build (full check)
```

Scripts work with `npm run …` as well. `verify` is what `prepublishOnly` runs.

## License

BUSL-1.1
