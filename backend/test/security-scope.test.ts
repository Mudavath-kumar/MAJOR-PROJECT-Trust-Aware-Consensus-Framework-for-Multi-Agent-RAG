import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRequestedDocumentIdsAreOwned,
  resolveReadyDocumentIds,
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

test("defaults chat retrieval to ready documents owned by the current user", () => {
  assert.deepEqual(
    resolveReadyDocumentIds(undefined, ["ready-a", "ready-b"]),
    ["ready-a", "ready-b"],
  );
});

test("an explicit empty selection stays empty instead of broadening to all documents", () => {
  assert.deepEqual(resolveReadyDocumentIds([], ["ready-a", "ready-b"]), []);
});

test("a selected document outside the ready-owned set is rejected", () => {
  assert.throws(
    () => resolveReadyDocumentIds(["failed"], ["ready-a"]),
    { name: "DocumentScopeError" },
  );
});
