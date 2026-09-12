import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/sso-callback")({
  head: () => ({
    meta: [{ title: "Authenticating — TrustRAG" }],
  }),
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />

        <h2 className="text-lg font-semibold text-foreground">
          Completing authentication…
        </h2>

        <p className="text-sm text-muted-foreground">
          Redirecting you to your TrustRAG workspace.
        </p>
      </div>

      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/app"
        signUpForceRedirectUrl="/app"
        signInFallbackRedirectUrl="/app"
        signUpFallbackRedirectUrl="/app"
      />
    </div>
  );
}
