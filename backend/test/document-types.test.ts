import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedDocumentType } from "../src/utils/document-types.js";

test("accepts JSON documents supported by the AI extractor", () => {
  assert.equal(isSupportedDocumentType("knowledge.json"), true);
});

test("rejects legacy DOC files that the AI extractor cannot parse", () => {
  assert.equal(isSupportedDocumentType("legacy.doc"), false);
});

test("rejects file types that have no extractor", () => {
  assert.equal(isSupportedDocumentType("payload.exe"), false);
});
