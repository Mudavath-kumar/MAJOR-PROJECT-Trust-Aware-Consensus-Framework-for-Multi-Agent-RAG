/** Labels used by the live execution timeline. All status and scores come from the API. */
export const AGENT_STEPS = [
  {
    key: "retrieve",
    label: "Retrieving documents",
    detail: "Searching the authenticated document scope",
  },
  {
    key: "research",
    label: "Research agent",
    detail: "Preparing a grounded proposition outline",
  },
  { key: "verify", label: "Fact verification", detail: "Checking claims against source text" },
  { key: "trust", label: "Trust assessment", detail: "Assessing source authority and recency" },
  { key: "reason", label: "Reasoning", detail: "Resolving supported claims and conflicts" },
  { key: "consensus", label: "Consensus engine", detail: "Calculating agent agreement" },
  { key: "final", label: "Final response", detail: "Assembling the cited answer" },
];
