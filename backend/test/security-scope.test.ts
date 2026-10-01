import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRequestedDocumentIdsAreOwned,
  withUserScope,
} from "../src/utils/security-scope.js";

test("rejects a document scope containing an unowned document", () => {
  assert.throws(
    () => assertRequestedDocumentIdsAreOwned(["owned", "other-user"], ["owned"]),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 403);
      assert.equal((error as Error).message, "One or more selected documents are unavailable");
      return true;
    },
  );
});

test("normalizes duplicate document ids while preserving requested order", () => {
  assert.deepEqual(
    assertRequestedDocumentIdsAreOwned(["doc-b", "doc-a", "doc-b"], ["doc-a", "doc-b"]),
    ["doc-b", "doc-a"],
  );
});

test("always applies the authenticated user scope to a query filter", () => {
  assert.deepEqual(
    withUserScope({ document_id: { $in: ["doc-1"] } }, "user-1"),
    { document_id: { $in: ["doc-1"] }, user_id: "user-1" },
  );
});

