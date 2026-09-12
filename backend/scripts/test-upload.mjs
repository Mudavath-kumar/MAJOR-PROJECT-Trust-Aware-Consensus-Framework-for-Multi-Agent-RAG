import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const storageConfigured = Boolean(
  process.env.B2_ENDPOINT &&
    process.env.B2_REGION &&
    process.env.B2_KEY_ID &&
    process.env.B2_APPLICATION_KEY &&
    process.env.B2_BUCKET_NAME,
);

console.log("B2 configured:", storageConfigured);

const client = storageConfigured
  ? new S3Client({
      endpoint: process.env.B2_ENDPOINT,
      region: process.env.B2_REGION,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
    })
  : null;

async function testStorage() {
  if (!client) throw new Error("Storage not configured");
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: `debug/${randomUUID()}.txt`,
      Body: Buffer.from("test"),
      ContentType: "text/plain",
    }),
  );
  console.log("Storage upload OK");
}

async function testMongo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Mongo connected OK");
  await mongoose.disconnect();
}

try {
  await testStorage();
  await testMongo();
  console.log("ALL OK");
} catch (error) {
  console.error("FAIL:", error?.name, error?.message);
  process.exit(1);
}
