import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be base64 of exactly 32 bytes");
  return key;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return secret;
}

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  // Only a full 16-byte tag: GCM would otherwise accept a truncated one, which is far easier to forge.
  if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function newId(): string {
  return randomUUID();
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
