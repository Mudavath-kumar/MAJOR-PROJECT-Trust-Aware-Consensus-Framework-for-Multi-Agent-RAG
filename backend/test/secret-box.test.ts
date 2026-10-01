import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret, maskSecret } from "../src/utils/secret-box.js";

test("encrypts and decrypts a provider secret without storing plaintext", () => {
  const encrypted = encryptSecret("provider-secret");
  assert.notEqual(encrypted, "provider-secret");
  assert.match(encrypted, /^enc:v1:/);
  assert.equal(decryptSecret(encrypted), "provider-secret");
});

test("masks configured secrets without exposing their value", () => {
  assert.equal(maskSecret("provider-secret"), "••••••••cret");
  assert.equal(maskSecret(""), "");
});

