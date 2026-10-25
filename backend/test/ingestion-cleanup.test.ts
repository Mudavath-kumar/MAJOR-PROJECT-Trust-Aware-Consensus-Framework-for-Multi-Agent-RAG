import test from "node:test";
import assert from "node:assert/strict";
import { cleanupFailedIngestion } from "../src/services/document-ingestion-cleanup.js";

test("attempts vector and object cleanup even if one rollback action fails", async () => {
  const attempted: string[] = [];
  const failures = await cleanupFailedIngestion("doc-1", "user-1", "bucket/path", {
    deleteVectors: async (documentId, userId) => {
      attempted.push(`vectors:${documentId}:${userId}`);
      throw new Error("AI service unavailable");
    },
    deleteStoredObject: async (storagePath) => {
      attempted.push(`object:${storagePath}`);
    },
  });

  assert.deepEqual(attempted.sort(), ["object:bucket/path", "vectors:doc-1:user-1"]);
  assert.deepEqual(failures, ["AI service unavailable"]);
});
