import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const configured = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (configured) {
    if (/^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
    throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes in hex or base64 format");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SETTINGS_ENCRYPTION_KEY is required in production");
  }

  return crypto
    .createHash("sha256")
    .update(process.env.JWT_SECRET || "development-settings-key")
    .digest();
}

export function encryptSecret(value: string): string {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string | undefined): string {
  if (!value || !value.startsWith(PREFIX)) return value || "";
  const [, , ivEncoded, tagEncoded, ciphertextEncoded] = value.split(":");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value: string | undefined): string {
  const plain = decryptSecret(value);
  return plain ? `••••••••${plain.slice(-4)}` : "";
}

