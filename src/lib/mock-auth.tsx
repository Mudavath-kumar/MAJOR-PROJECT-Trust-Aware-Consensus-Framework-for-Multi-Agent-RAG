/**
 * mock-auth.tsx
 *
 * Drop-in mock for @clerk/clerk-react.
 * When VITE_MOCK_AUTH=true this replaces ClerkProvider and all Clerk hooks
 * with a hardcoded demo user so the full app can be tested without real auth.
 *
 * To restore real auth: remove VITE_MOCK_AUTH from .env.local (or set it to false)
 */

import React, { createContext, useContext, useEffect, type ReactNode } from "react";

// ── Demo user ────────────────────────────────────────────────────────────────
export const DEMO_USER = {
  id: "demo_user_001",
  fullName: "Demo Enterprise User",
  firstName: "Demo",
  lastName: "Enterprise",
  imageUrl: "",
  primaryEmailAddress: { emailAddress: "demo@trustrag.dev" },
};

// ── Contexts ─────────────────────────────────────────────────────────────────
interface MockAuthCtx {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string;
  getToken: () => Promise<string>;
}

interface MockUserCtx {
  isLoaded: boolean;
  user: typeof DEMO_USER;
}

interface MockClerkCtx {
  signOut: (opts?: { redirectUrl?: string }) => Promise<void>;
}

const AuthCtx = createContext<MockAuthCtx>({
  isLoaded: true,
  isSignedIn: true,
  userId: DEMO_USER.id,
  getToken: async () => "mock_token_demo",
});

const UserCtx = createContext<MockUserCtx>({
  isLoaded: true,
  user: DEMO_USER,
});

const ClerkCtx = createContext<MockClerkCtx>({
  signOut: async (opts) => {
    localStorage.removeItem("trustrag_demo_signed_in");
    window.location.href = opts?.redirectUrl ?? "/login";
  },
});

// ── Provider ─────────────────────────────────────────────────────────────────
export function MockAuthProvider({ children }: { children: ReactNode }) {
  // Sync demo user into localStorage so ApiClient picks it up immediately
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("trustrag_token", "mock_token_demo");
      localStorage.setItem("trustrag_user_email", DEMO_USER.primaryEmailAddress.emailAddress);
      localStorage.setItem("trustrag_user_name", DEMO_USER.fullName);
    }
  }, []);

  const authValue: MockAuthCtx = {
    isLoaded: true,
    isSignedIn: true,
    userId: DEMO_USER.id,
    getToken: async () => "mock_token_demo",
  };

  const userValue: MockUserCtx = {
    isLoaded: true,
    user: DEMO_USER,
  };

  const clerkValue: MockClerkCtx = {
    signOut: async (opts) => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("trustrag_token");
      }
      window.location.href = opts?.redirectUrl ?? "/login";
    },
  };

  return (
    <AuthCtx.Provider value={authValue}>
      <UserCtx.Provider value={userValue}>
        <ClerkCtx.Provider value={clerkValue}>{children}</ClerkCtx.Provider>
      </UserCtx.Provider>
    </AuthCtx.Provider>
  );
}

// ── Hooks (match @clerk/clerk-react API) ──────────────────────────────────────
export function useAuth() {
  return useContext(AuthCtx);
}

export function useUser() {
  return useContext(UserCtx);
}

export function useClerk() {
  return useContext(ClerkCtx);
}

export function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      create: async (params: { identifier?: string; password?: string }) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("trustrag_token", "mock_token_demo");
          if (params.identifier) {
            localStorage.setItem("trustrag_user_email", params.identifier);
            localStorage.setItem("trustrag_user_name", params.identifier.split("@")[0] || "Demo User");
          }
        }
        return { status: "complete", createdSessionId: "mock_session_001" };
      },
      authenticateWithRedirect: async (params?: { redirectUrlComplete?: string }) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("trustrag_token", "mock_token_demo");
          window.location.href = params?.redirectUrlComplete || "/app";
        }
      },
    },
    setActive: async (_opts: { session: string | null }) => {},
  };
}

export function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      create: async (params: { emailAddress?: string; password?: string; firstName?: string; lastName?: string }) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("trustrag_token", "mock_token_demo");
          if (params.emailAddress) {
            localStorage.setItem("trustrag_user_email", params.emailAddress);
          }
          if (params.firstName) {
            localStorage.setItem("trustrag_user_name", `${params.firstName} ${params.lastName || ""}`.trim());
          }
        }
        return { status: "complete", createdSessionId: "mock_session_001" };
      },
      prepareEmailAddressVerification: async (_params: any) => {},
      authenticateWithRedirect: async (params?: { redirectUrlComplete?: string }) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("trustrag_token", "mock_token_demo");
          window.location.href = params?.redirectUrlComplete || "/app";
        }
      },
    },
    setActive: async (_opts: { session: string | null }) => {},
  };
}

// ── Components ────────────────────────────────────────────────────────────────
/** Renders children only when signed in (always true in mock mode). */
export function SignedIn({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Renders children only when signed out (never in mock mode). */
export function SignedOut({ children: _children }: { children: ReactNode }) {
  return null;
}

/** Callback redirect component in mock mode redirects directly to /app */
export function AuthenticateWithRedirectCallback() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/app";
    }
  }, []);
  return null;
}
