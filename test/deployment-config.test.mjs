import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const render = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

test("Render blueprint targets the live Express backend and repository root", () => {
  assert.match(render, /name:\s+trustrag-ai-service/);
  assert.match(render, /name:\s+trustrag-backend-j3oe/);
  assert.match(render, /dockerfilePath:\s+\.\/Dockerfile\.ai-service/);
  assert.match(render, /dockerContext:\s+\./);
  assert.match(render, /rootDir:\s+backend/);
  assert.match(render, /key:\s+AI_SERVICE_URL[\s\S]*?property:\s+hostport/);
  assert.doesNotMatch(render, /trustarc-core\/backend|trustarc-core\/Dockerfile/);
});

test("backend and AI service are linked with one internal token", () => {
  const tokenDeclarations = [...render.matchAll(/key:\s+AI_SERVICE_TOKEN/g)];
  assert.equal(tokenDeclarations.length, 2);
  assert.match(render, /name:\s+trustrag-backend-j3oe[\s\S]*?key:\s+AI_SERVICE_TOKEN[\s\S]*?generateValue:\s+true/);
  assert.match(render, /name:\s+trustrag-ai-service[\s\S]*?key:\s+AI_SERVICE_TOKEN[\s\S]*?envVarKey:\s+AI_SERVICE_TOKEN/);
  assert.match(render, /name:\s+trustrag-ai-service[\s\S]*?key:\s+AI_SERVICE_URL[\s\S]*?name:\s+trustrag-ai-service/);
  assert.match(render, /name:\s+trustrag-backend-j3oe[\s\S]*?key:\s+AI_SERVICE_URL[\s\S]*?name:\s+trustrag-ai-service/);
});

test("Render generates the backend settings encryption key", () => {
  assert.match(render, /key:\s+SETTINGS_ENCRYPTION_KEY\s*\n\s+generateValue:\s+true/);
});

test("Vercel uses the repository's pnpm lockfile rather than the retired Bun setup", () => {
  assert.equal(vercel.installCommand, "pnpm install --frozen-lockfile");
  assert.equal(vercel.buildCommand, "pnpm run build");
});
