import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — TrustRAG" },
      { name: "description", content: "Create your TrustRAG account and start building evidence-backed answers." },
      { property: "og:title", content: "Create account — TrustRAG" },
      { property: "og:description", content: "Start building evidence-backed answers with TrustRAG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="signup" />,
});