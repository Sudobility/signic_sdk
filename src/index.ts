export { SignicClient } from './client.js';
export type { SignicClientConfig, SignMessageResult } from './types.js';
export type {
  SignicEmail,
  SignicEmailAddress,
  SignicEmailDetail,
  SignicEmailAttachment,
  UnreadEmailsResult,
  MarkAsReadResult,
  SendEmailParams,
  SendEmailResult,
  CustomAddressAvailability,
  CustomAddressState,
} from './types.js';
export {
  SignicError,
  SignicAuthError,
  SignicNetworkError,
  SignicValidationError,
} from './errors.js';
export type { ParsedSubaddress } from './subaddress.js';
export {
  parseSubaddress,
  stripSubaddressTag,
  getSubaddressTag,
  hasSubaddressTag,
  buildSubaddress,
  sameBaseAddress,
} from './subaddress.js';
