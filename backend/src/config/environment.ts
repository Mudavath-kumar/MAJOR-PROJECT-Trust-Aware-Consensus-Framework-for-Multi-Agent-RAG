import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
];
const envFile = envCandidates.find((candidate) => fs.existsSync(candidate));
const initialNodeEnv = process.env.NODE_ENV || "development";
dotenv.config(envFile ? { path: envFile, override: initialNodeEnv !== "production" } : undefined);

/**
 * Render's `fromService.property: hostport` provides an internal host and
 * port, which must use plain HTTP inside the private network. Public values
 * may still be supplied as complete URLs or bare HTTPS hostnames.
 */
export function normalizeServiceUrl(rawValue: string | undefined): string {
  const raw = (rawValue || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.includes(":")) return `http://${raw}`;
  return `https://${raw}`;
}

// --- Startup Validation ---
const NODE_ENV = process.env.NODE_ENV || "development";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  if (NODE_ENV === "production") {
    // Hard fail in production — no weak secret allowed
    throw new Error(
      "🚫 FATAL: JWT_SECRET env var is missing or too short (min 32 chars). Refusing to start in production.",
    );
  } else {
    // In development, warn loudly but allow a safe local default
    console.warn(
      "⚠️  WARNING: JWT_SECRET not set or too short. Using a temporary dev secret. DO NOT use this in production!",
    );
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8080",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trustrag",
  // Use env var; only fall back to dev default if not in production
  JWT_SECRET: JWT_SECRET || "dev_only_secret_replace_before_production_deploy_32chars",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  // Render fromService property:host returns a bare hostname (no protocol).
  // hostport values are internal HTTP URLs; public hostnames become HTTPS.
  AI_SERVICE_URL: normalizeServiceUrl(process.env.AI_SERVICE_URL || "http://127.0.0.1:8000"),
  AI_SERVICE_TIMEOUT_MS: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || "120000", 10),
  AI_SERVICE_TOKEN:
    process.env.AI_SERVICE_TOKEN ||
    (NODE_ENV === "production" ? "" : "dev-only-trustrag-service-token-change-me"),
  SETTINGS_ENCRYPTION_KEY: process.env.SETTINGS_ENCRYPTION_KEY || "",
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "500", 10),
  B2_ENDPOINT: process.env.B2_ENDPOINT || "",
  B2_REGION: process.env.B2_REGION || "us-east-005",
  B2_KEY_ID: process.env.B2_KEY_ID || "",
  B2_APPLICATION_KEY: process.env.B2_APPLICATION_KEY || "",
  B2_BUCKET_NAME: process.env.B2_BUCKET_NAME || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
  // Comma-separated extra browser origins allowed to call the API.
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Preview deployments live on *.vercel.app; disable with ALLOW_VERCEL_PREVIEWS=false.
  ALLOW_VERCEL_PREVIEWS: process.env.ALLOW_VERCEL_PREVIEWS !== "false",

  // Clerk session-token verification. Provide CLERK_ISSUER (e.g.
  // https://your-app.clerk.accounts.dev) and/or CLERK_JWKS_URL; otherwise the
  // JWKS URL is derived from CLERK_PUBLISHABLE_KEY.
  CLERK_ISSUER: (process.env.CLERK_ISSUER || "").replace(/\/+$/, ""),
  CLERK_JWKS_URL: process.env.CLERK_JWKS_URL || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",

};
