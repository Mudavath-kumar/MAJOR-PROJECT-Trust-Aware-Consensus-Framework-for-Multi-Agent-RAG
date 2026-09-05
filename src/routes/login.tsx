import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — TrustRAG" },
      { name: "description", content: "Log in to your TrustRAG evidence-first AI workspace." },
      { property: "og:title", content: "Log in — TrustRAG" },
      { property: "og:description", content: "Continue to your evidence-first AI workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="login" />,
});