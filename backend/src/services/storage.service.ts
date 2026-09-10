import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/environment.js";

const storageConfigured = Boolean(
  env.B2_ENDPOINT &&
    env.B2_REGION &&
    env.B2_KEY_ID &&
    env.B2_APPLICATION_KEY &&
    env.B2_BUCKET_NAME,
);

const client = storageConfigured
  ? new S3Client({
      endpoint: env.B2_ENDPOINT,
      region: env.B2_REGION,
      credentials: {
        accessKeyId: env.B2_KEY_ID,
        secretAccessKey: env.B2_APPLICATION_KEY,
      },
    })
  : null;

export class StorageService {
  static isConfigured(): boolean {
    return storageConfigured;
  }

  static async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!client) {
      throw new Error("Backblaze B2 storage is not configured");
    }

    await client.send(
      new PutObjectCommand({
        Bucket: env.B2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  static async delete(key: string): Promise<void> {
    if (!client) {
      throw new Error("Backblaze B2 storage is not configured");
    }
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.B2_BUCKET_NAME,
        Key: key,
      }),
    );
  }

  /** Upload if configured; return "local-only" otherwise. Never throws. */
  static async softUpload(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!storageConfigured || !client) return "local-only";
    try {
      return await StorageService.upload(key, body, contentType);
    } catch (err) {
      return "local-only";
    }
  }

  /** Delete if configured; skip "local-only" keys silently. */
  static async softDelete(key: string): Promise<void> {
    if (!storageConfigured || !client || key === "local-only") return;
    try {
      await StorageService.delete(key);
    } catch {
      // non-fatal
    }
  }
}

export default StorageService;
