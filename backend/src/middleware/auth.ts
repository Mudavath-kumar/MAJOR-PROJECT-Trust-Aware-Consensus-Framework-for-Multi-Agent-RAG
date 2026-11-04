import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/environment.js";
import User from "../models/User.js";

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    email: string;
    role: string;
    name: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clerk session-token verification (JWKS / RS256-ES256, no external dependency)
//
// Clerk signs session tokens with its own keys. We fetch the JWKS, cache the
// keys, and verify the signature locally before trusting any claim. This is the
// only thing that makes a Clerk token trustworthy — decoding it is not enough.
// ─────────────────────────────────────────────────────────────────────────────

type Jwk = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
  alg?: string;
  use?: string;
};

interface ClerkClaims {
  sub: string;
  email?: string;
  name?: string;
}

export function hasAuthorizedClerkParty(
  authorizedParty: unknown,
  allowedParties: readonly string[],
): boolean {
  if (typeof authorizedParty !== "string" || !authorizedParty.trim()) return false;
  const normalized = authorizedParty.trim().replace(/\/+$/, "").toLowerCase();
  return allowedParties.some(
    (party) => party.trim().replace(/\/+$/, "").toLowerCase() === normalized,
  );
}

let jwksCache: { fetchedAt: number; keys: Map<string, Jwk> } | null = null;
const JWKS_TTL_MS = 12 * 60 * 60 * 1000; // refresh at most twice a day

export function verifyClerkSignature(
  algorithm: "RS256" | "ES256",
  signingInput: Buffer,
  signature: Buffer,
  publicKey: crypto.KeyObject,
): boolean {
  const verifyAlgorithm = algorithm === "RS256" ? "RSA-SHA256" : "SHA256";
  const key =
    algorithm === "ES256"
      ? { key: publicKey, dsaEncoding: "ieee-p1363" as const }
      : publicKey;
  return crypto.verify(verifyAlgorithm, signingInput, key, signature);
}

/** Enforce the time and issuer claims that bind a Clerk token to this service. */
export function hasValidClerkStandardClaims(
  payload: Record<string, unknown>,
  configuredIssuer: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const exp = payload.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= nowSeconds) return false;

  const nbf = payload.nbf;
  if (nbf !== undefined && (typeof nbf !== "number" || !Number.isFinite(nbf) || nbf > nowSeconds + 60)) {
    return false;
  }

  if (configuredIssuer) {
    const issuer = typeof payload.iss === "string" ? payload.iss.replace(/\/+$/, "") : "";
    if (!issuer || issuer !== configuredIssuer.replace(/\/+$/, "")) return false;
  }

  return true;
}

/** Recover when another concurrent request has already provisioned this Clerk subject. */
export async function recoverClerkUserAfterDuplicate<T>(
  error: unknown,
  findByClerkId: () => Promise<T | null>,
): Promise<T> {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== 11000
  ) {
    throw error;
  }

  const existingUser = await findByClerkId();
  if (!existingUser) throw error;
  return existingUser;
}

/** Extract the frontend API host encoded in a Clerk publishable key. */
function decodeClerkPublishableHost(key: string): string | null {
  const match = key.trim().match(/^pk_(?:test|live)_(.+)$/);
  if (!match) return null;
  try {
    // Clerk encodes `<frontend-api-host>$` as the suffix of the key.
    const decoded = Buffer.from(match[1], "base64").toString("utf-8").replace(/\$+$/, "").trim();
    return /^[a-z0-9.-]+$/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Resolve the Clerk JWKS endpoint from configuration, if any. */
export function resolveClerkJwksUrl(): string | null {
  if (env.CLERK_JWKS_URL) return env.CLERK_JWKS_URL;
  if (env.CLERK_ISSUER) return `${env.CLERK_ISSUER}/.well-known/jwks.json`;
  if (env.CLERK_PUBLISHABLE_KEY) {
    const host = decodeClerkPublishableHost(env.CLERK_PUBLISHABLE_KEY);
    if (host) return `https://${host}/.well-known/jwks.json`;
  }
  return null;
}

async function getClerkJwk(kid: string | undefined): Promise<Jwk | null> {
  const url = resolveClerkJwksUrl();
  if (!url) return null;

  const stale = !jwksCache || Date.now() - jwksCache.fetchedAt > JWKS_TTL_MS;
  // Only refetch when the cache is stale or the key id is unknown (key rotation).
  if (stale || (kid && !jwksCache?.keys.has(kid))) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Clerk JWKS request failed with status ${response.status}`);
    }
    const body = (await response.json()) as { keys?: Jwk[] };
    const keys = new Map<string, Jwk>();
    for (const key of body.keys ?? []) {
      if (key?.kid) keys.set(key.kid, key);
    }
    jwksCache = { fetchedAt: Date.now(), keys };
  }

  if (kid) return jwksCache?.keys.get(kid) ?? null;
  const only = jwksCache ? Array.from(jwksCache.keys.values()) : [];
  return only.length === 1 ? only[0] : null;
}

/** Verify a Clerk session token's signature and standard claims. */
async function verifyClerkToken(token: string): Promise<ClerkClaims | null> {
  if (!resolveClerkJwksUrl()) return null;

  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  const alg = header?.alg;
  if (alg !== "RS256" && alg !== "ES256") return null;

  const jwk = await getClerkJwk(header?.kid);
  if (!jwk) return null;

  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: "jwk" });
  } catch {
    return null;
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, "base64url");
  if (!verifyClerkSignature(alg, signingInput, signature, publicKey)) return null;

  if (!hasValidClerkStandardClaims(payload, env.CLERK_ISSUER)) return null;
  if (!hasAuthorizedClerkParty(payload.azp, env.CLERK_AUTHORIZED_PARTIES)) return null;

  const sub = payload.sub;
  if (typeof sub !== "string" || !sub) return null;

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

/** Find or create the MongoDB user that maps to a verified Clerk subject. */
async function provisionClerkUser(claims: ClerkClaims) {
  // Default Clerk session tokens omit the email claim; fall back to a stable
  // synthetic address so the unique email index still holds.
  const email = (claims.email?.trim() || `${claims.sub}@clerk.local`).toLowerCase();

  let user = await User.findOne({ $or: [{ clerk_user_id: claims.sub }, { email }] });
  if (!user) {
    try {
      user = await User.create({
        name: claims.name?.trim() || "TrustRAG User",
        email,
        password_hash: "clerk_managed_no_password",
        clerk_user_id: claims.sub,
        role: "user",
      });
    } catch (error) {
      user = await recoverClerkUserAfterDuplicate(error, () =>
        User.findOne({ clerk_user_id: claims.sub }),
      );
    }
  } else if (!user.clerk_user_id) {
    // Link a pre-existing local account to its Clerk identity.
    user.clerk_user_id = claims.sub;
    await user.save();
  }

  return {
    _id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (token) {
    // 1) Local JWT issued by /auth/register or /auth/login.
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id?: string;
        email?: string;
        role?: string;
        name?: string;
      };
      if (decoded?.id) {
        const localUser = await User.findById(decoded.id).select("_id email role name");
        if (!localUser) throw new Error("Local user no longer exists");
        req.user = {
          _id: localUser._id.toString(),
          email: localUser.email,
          role: localUser.role,
          name: localUser.name,
        };
        return next();
      }
    } catch {
      // Not a local token — fall through to Clerk verification.
    }

    // 2) Clerk session token, verified against Clerk's signed JWKS.
    try {
      const claims = await verifyClerkToken(token);
      if (claims) {
        req.user = await provisionClerkUser(claims);
        return next();
      }
    } catch (err) {
      console.warn(
        "Clerk token verification failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  res.status(401).json({ error: "Authentication required. Please log in." });
};
