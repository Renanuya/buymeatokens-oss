import { decrypt } from "./crypto";
import { keyLast4 } from "./stripe";

/**
 * The last four characters of a creator's saved Stripe key, for display. The key is decrypted on the server only;
 * the full key never leaves it. Null when no key is saved or it can't be read.
 */
export function storedStripeKeyLast4(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return keyLast4(decrypt(encrypted));
  } catch {
    return null;
  }
}
