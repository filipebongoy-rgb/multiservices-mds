import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { fail } from "./workflow";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const allowedMime = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export function validateFile(base64: string, mimeType: string, kind: string) {
  if (!allowedMime.includes(mimeType as typeof allowedMime[number])) fail("Format non accepté. Utilisez JPG, PNG, WebP ou PDF.");
  if (kind === "photo" && mimeType === "application/pdf") fail("Une photo doit être une image JPG, PNG ou WebP.");
  // Linear character scan; nested repetition over multi-megabyte strings can overflow V8's regex stack.
  if (base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64)) fail("Le fichier est invalide ou dépasse 5 Mo.");
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || bytes.toString("base64") !== base64) fail("Le fichier est invalide ou dépasse 5 Mo.");
  const valid = mimeType === "image/jpeg" ? bytes.length > 4 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
    : mimeType === "image/png" ? bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(12, 16).toString("ascii") === "IHDR"
    : mimeType === "image/webp" ? bytes.length >= 16 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length
    : bytes.length > 10 && bytes.subarray(0, 5).toString("ascii") === "%PDF-" && bytes.subarray(-1024).includes(Buffer.from("%%EOF"));
  if (!valid) fail("La signature du fichier ne correspond pas au format annoncé.");
  return bytes;
}
export function encryptFile(bytes: Buffer) {
  const encryptionKey = randomBytes(32); const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { ciphertext, encryptionKey: encryptionKey.toString("hex"), iv: iv.toString("hex"), authTag: cipher.getAuthTag().toString("hex") };
}
export function decryptFile(ciphertext: Buffer, metadata: { encryptionKey: string; iv: string; authTag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(metadata.encryptionKey, "hex"), Buffer.from(metadata.iv, "hex"));
  decipher.setAuthTag(Buffer.from(metadata.authTag, "hex"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
