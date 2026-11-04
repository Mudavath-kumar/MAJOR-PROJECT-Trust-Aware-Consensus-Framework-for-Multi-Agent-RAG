import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { hasValidServiceToken } from "../src/utils/service-auth.js";
import { normalizeServiceUrl } from "../src/config/environment.js";
import {
  hasAuthorizedClerkParty,
  hasValidClerkStandardClaims,
  recoverClerkUserAfterDuplicate,
  verifyClerkSignature,
} from "../src/middleware/auth.js";

test("accepts only an exact configured internal service token", () => {
  assert.equal(hasValidServiceToken("service-secret", "service-secret"), true);
  assert.equal(hasValidServiceToken("wrong-secret", "service-secret"), false);
  assert.equal(hasValidServiceToken(undefined, "service-secret"), false);
  assert.equal(hasValidServiceToken("service-secret", ""), false);
});

test("normalizes Render hostport values to private HTTP URLs", () => {
  assert.equal(normalizeServiceUrl("trustrag-ai-service.internal:8000"), "http://trustrag-ai-service.internal:8000");
  assert.equal(normalizeServiceUrl("https://trustrag-ai-service.onrender.com"), "https://trustrag-ai-service.onrender.com");
});

test("verifies Clerk ES256 signatures in the JWS IEEE-P1363 encoding", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const signingInput = Buffer.from("header.payload");
  const signature = sign("SHA256", signingInput, {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  assert.equal(signature.length, 64);
  assert.equal(verifyClerkSignature("ES256", signingInput, signature, publicKey), true);
  assert.equal(
    verifyClerkSignature("ES256", Buffer.from("header.changed"), signature, publicKey),
    false,
  );
});

test("continues to verify Clerk RS256 signatures", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const signingInput = Buffer.from("header.payload");
  const signature = sign("RSA-SHA256", signingInput, privateKey);

  assert.equal(verifyClerkSignature("RS256", signingInput, signature, publicKey), true);
  assert.equal(
    verifyClerkSignature("RS256", Buffer.from("header.changed"), signature, publicKey),
    false,
  );
});

test("accepts Clerk tokens only from configured authorized parties", () => {
  assert.equal(
    hasAuthorizedClerkParty("https://major-project-trust-aware-consensus.vercel.app", [
      "https://major-project-trust-aware-consensus.vercel.app",
    ]),
    true,
  );
  assert.equal(
    hasAuthorizedClerkParty("https://attacker.vercel.app", [
      "https://major-project-trust-aware-consensus.vercel.app",
    ]),
    false,
  );
  assert.equal(hasAuthorizedClerkParty(undefined, ["https://example.com"]), false);
});

test("requires valid Clerk expiration and configured issuer claims", () => {
  const now = 1_800_000_000;
  const valid = { exp: now + 60, iss: "https://issuer.clerk.accounts.dev/" };

  assert.equal(hasValidClerkStandardClaims(valid, "https://issuer.clerk.accounts.dev", now), true);
  assert.equal(hasValidClerkStandardClaims({ iss: valid.iss }, "https://issuer.clerk.accounts.dev", now), false);
  assert.equal(hasValidClerkStandardClaims({ ...valid, exp: "later" }, "https://issuer.clerk.accounts.dev", now), false);
  assert.equal(hasValidClerkStandardClaims({ ...valid, exp: now }, "https://issuer.clerk.accounts.dev", now), false);
  assert.equal(hasValidClerkStandardClaims({ exp: valid.exp }, "https://issuer.clerk.accounts.dev", now), false);
  assert.equal(hasValidClerkStandardClaims({ ...valid, iss: "https://attacker.example" }, "https://issuer.clerk.accounts.dev", now), false);
});

test("recovers the existing Clerk user after a concurrent unique-index insert wins", async () => {
  const duplicateError = Object.assign(new Error("duplicate key"), { code: 11000 });
  const existingUser = { id: "clerk-user-1" };
  let lookups = 0;

  const user = await recoverClerkUserAfterDuplicate(duplicateError, async () => {
    lookups += 1;
    return existingUser;
  });

  assert.equal(user, existingUser);
  assert.equal(lookups, 1);
});

test("does not hide unrelated errors or unrecoverable duplicate-key errors", async () => {
  const ordinaryError = new Error("database unavailable");
  const duplicateError = Object.assign(new Error("duplicate key"), { code: 11000 });

  await assert.rejects(
    recoverClerkUserAfterDuplicate(ordinaryError, async () => null),
    (error) => error === ordinaryError,
  );
  await assert.rejects(
    recoverClerkUserAfterDuplicate(duplicateError, async () => null),
    (error) => error === duplicateError,
  );
});
