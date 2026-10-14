/**
 * Gmail-style "+" subaddressing helpers.
 *
 * An address like `john+amazon@signic.email` is delivered to the account found
 * by the base local part (`john`); the `+amazon` tag is informational and is
 * preserved on the message so a reply can send from the same tagged address.
 *
 * Pure and dependency-free.
 */

export interface ParsedSubaddress {
  /** Full local part including any tag, e.g. "john+amazon". */
  localPart: string;
  /** Base local part before the first "+", e.g. "john". */
  baseLocal: string;
  /** Tag after the first "+" (up to "@"), or null if none, e.g. "amazon". */
  tag: string | null;
  /** Domain part, e.g. "signic.email". */
  domain: string;
}

/**
 * Parse an email into base local part, tag, and domain. Returns null if the
 * input is not a valid single-"@" address.
 */
export function parseSubaddress(email: string): ParsedSubaddress | null {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;
  const [localPart, domain] = parts;
  if (!localPart || !domain) return null;

  const plusIdx = localPart.indexOf('+');
  const baseLocal = plusIdx >= 0 ? localPart.slice(0, plusIdx) : localPart;
  const tag = plusIdx >= 0 ? localPart.slice(plusIdx + 1) : null;

  // A leading "+" (empty base) is not a valid subaddress.
  if (!baseLocal) return null;

  return { localPart, baseLocal, tag, domain };
}

/**
 * The base address with any "+tag" removed: `base@domain` (domain lowercased).
 * Returns the input trimmed unchanged if it is not a valid address.
 */
export function stripSubaddressTag(email: string): string {
  const parsed = parseSubaddress(email);
  if (!parsed) return (email || '').trim();
  return `${parsed.baseLocal}@${parsed.domain.toLowerCase()}`;
}

/** The tag portion of an address, or null if there is none. */
export function getSubaddressTag(email: string): string | null {
  return parseSubaddress(email)?.tag ?? null;
}

/** Whether an address carries a "+tag". */
export function hasSubaddressTag(email: string): boolean {
  return getSubaddressTag(email) !== null;
}

/**
 * Build a tagged address from a base address and a tag: `base+tag@domain`.
 * If `tag` is empty/null the base address is returned (with any existing tag
 * stripped). Any existing tag on `baseEmail` is replaced.
 */
export function buildSubaddress(baseEmail: string, tag: string | null): string {
  const parsed = parseSubaddress(baseEmail);
  if (!parsed) return (baseEmail || '').trim();
  const domain = parsed.domain.toLowerCase();
  const cleanTag = (tag || '').trim();
  if (!cleanTag) return `${parsed.baseLocal}@${domain}`;
  return `${parsed.baseLocal}+${cleanTag}@${domain}`;
}

/**
 * Whether two addresses resolve to the same mailbox — i.e. share the same base
 * local part and domain, ignoring any "+tag" and case.
 */
export function sameBaseAddress(a: string, b: string): boolean {
  const pa = parseSubaddress(a);
  const pb = parseSubaddress(b);
  if (!pa || !pb) return false;
  return (
    pa.baseLocal.toLowerCase() === pb.baseLocal.toLowerCase() &&
    pa.domain.toLowerCase() === pb.domain.toLowerCase()
  );
}
