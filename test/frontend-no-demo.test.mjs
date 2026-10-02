import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("frontend does not silently replace backend documents with demo data", () => {
  const source = read("src/lib/doc-store.ts");
  assert.doesNotMatch(source, /SEED_(?:DOCS|CHUNKS)_RAW/);
  assert.doesNotMatch(source, /offline demonstrations|client-side ingestion for testing/i);
  assert.doesNotMatch(source, /Fallback sequential ingest/i);
});

test("dashboard and analytics render measured zero-state values when the API is unavailable", () => {
  const dashboard = read("src/routes/app.index.tsx");
  const analytics = read("src/routes/app.analytics.tsx");
  assert.doesNotMatch(dashboard, /\|\|\s*true/);
  assert.doesNotMatch(
    dashboard,
    /total_queries:\s*184|avg_confidence_score:\s*94\.2|avg_consensus_score:\s*96\.8/,
  );
  assert.doesNotMatch(analytics, /fallbackTrends|fallbackAgents|total_queries:\s*418/);
});

test("frontend requires configured authentication and does not use hardcoded credentials", () => {
  const rootRoute = read("src/routes/__root.tsx");
  assert.doesNotMatch(rootRoute, /pk_test_[A-Za-z0-9_-]+/);
  assert.equal(fs.existsSync(path.join(root, "src/lib/mock-auth.tsx")), false);
});

test("upload progress and chat telemetry are based on server responses", () => {
  const upload = read("src/routes/app.upload.tsx");
  const chat = read("src/routes/app.chat.tsx");
  assert.doesNotMatch(upload, /Math\.random/);
  assert.doesNotMatch(chat, /340\s*\+\s*Math\.round|420\s*\+\s*Math\.round|290\s*\+\s*Math\.round/);
  assert.doesNotMatch(chat, /trust:\s*92|consensus:\s*94/);
});

test("production API requests never fall back to localhost", () => {
  const apiClient = read("src/lib/api-client.ts");
  assert.match(
    apiClient,
    /DEFAULT_PRODUCTION_API_URL\s*=\s*"https:\/\/trustrag-backend-j3oe\.onrender\.com\/api\/v1"/,
  );
  assert.match(apiClient, /import\.meta\.env\.PROD/);
  assert.doesNotMatch(apiClient, /VITE_API_URL\s*\|\|\s*["']http:\/\/localhost:3001\/api\/v1/);
});
