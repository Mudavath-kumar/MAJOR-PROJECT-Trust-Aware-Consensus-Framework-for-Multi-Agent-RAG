import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  BadgeCheck,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode,
  FileText,
  Filter,
  Layers,
  Loader2,
  MessageSquare,
  PanelLeft,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  SearchCheck,
  ShieldCheck,
  Sparkle,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Zap,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { parseAnswerBlocks } from "@/lib/answer-format";
import {
  formatSourcePage,
  getChatErrorMessage,
  hasMatchingEvidence,
  mapAgentExecutions,
  mapEvidenceSources,
  mapChatScores,
  resolveChatDisplayState,
  type AgentExecutionView,
  type ChatScoreSignals,
  type EvidencePresentation,
} from "@/lib/chat-presentation";
import { ingestFile, useKnowledgeStore } from "@/lib/doc-store";
import {
  ApiClient,
  type ChatBackendMessage,
  type DecisionScoreComponents,
  type DecisionStatus,
} from "@/lib/api-client";
import { Meter, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import type { EvaluationMatrixData } from "@/components/app/EvaluationMatrixModal";

export const Route = createFileRoute("/app/chat")({
  head: () => ({
    meta: [
      { title: "AI Chat — TrustRAG Console" },
      {
        name: "description",
        content:
          "Ask questions about your uploaded documents and inspect the evidence and decision returned by TrustRAG.",
      },
      { property: "og:title", content: "TrustRAG AI Chat" },
      {
        property: "og:description",
        content:
          "Document-grounded answers with backend-returned evidence, citations, and recorded agent checks.",
      },
    ],
  }),
  component: ChatPage,
});

type Retrieved = EvidencePresentation;

type Turn = {
  id: number;
  question: string;
  answer: string;
  hits: Retrieved[];
  scores: ChatScoreSignals;
  decisionStatus: DecisionStatus;
  abstentionReason?: string | null;
  scoreComponents?: DecisionScoreComponents;
  evaluationMatrix?: EvaluationMatrixData;
  agents: AgentExecutionView[];
  consensusSummary: string;
  scopeDocs: string[];
  timestamp: string;
};

const SUGGESTIONS = [
  "Summarise the key findings",
  "What compliance risks are mentioned?",
  "List every numeric claim with citations",
  "Compare retention policies across sources",
];

function formatMetric(value: number | null): string {
  return value === null ? "Not measured" : `${value.toFixed(1)}%`;
}

function ChatMessage({ from, children }: { from: "user" | "assistant"; children: ReactNode }) {
  return (
    <div
      className={`group flex w-full max-w-[95%] flex-col gap-2 ${
        from === "user" ? "is-user ml-auto justify-end" : "is-assistant"
      }`}
    >
      {children}
    </div>
  );
}

function ChatMessageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground group-[.is-assistant]:text-foreground ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function getFileTypeColor(type: string) {
  switch (type.toUpperCase()) {
    case "PDF":
      return "border-rose-500/30 bg-rose-500/10 text-rose-400";
    case "DOCX":
      return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    case "MD":
      return "border-purple-500/30 bg-purple-500/10 text-purple-400";
    case "TXT":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }
}

function renderInline(
  text: string,
  onCitationClick: ((index: number) => void) | undefined,
  evidenceCount: number,
): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={index} className="text-muted-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const citation = part.match(/^\[(\d+)\]$/);
    if (citation) {
      const citationIndex = Number(citation[1]);
      if (!hasMatchingEvidence(citationIndex, evidenceCount)) {
        return (
          <span
            key={index}
            className="mx-0.5 font-mono text-[11px] text-muted-foreground"
            title={`Citation ${citationIndex} has no matching evidence passage in this response`}
          >
            [{citationIndex}]
          </span>
        );
      }
      return (
        <button
          key={index}
          type="button"
          onClick={() => onCitationClick?.(citationIndex)}
          className="mx-0.5 inline-flex items-center justify-center rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
          title={`Jump to citation ${citationIndex}`}
        >
          [{citationIndex}]
        </button>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

/** Render the answer-agent Markdown subset without exposing raw # or - tokens. */
function Markdown({
  text,
  onCitationClick,
  evidenceCount,
}: {
  text: string;
  onCitationClick?: (index: number) => void;
  evidenceCount: number;
}) {
  const blocks = parseAnswerBlocks(text);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={index}
              className={`${block.level === 1 ? "text-base" : "text-sm"} font-semibold tracking-tight text-foreground`}
            >
              {renderInline(block.text, onCitationClick, evidenceCount)}
            </h3>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index} className="space-y-1.5 pl-5 text-muted-foreground marker:text-accent">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-1">
                  {renderInline(item, onCitationClick, evidenceCount)}
                </li>
              ))}
            </List>
          );
        }
        return <p key={index}>{renderInline(block.text, onCitationClick, evidenceCount)}</p>;
      })}
    </div>
  );
}

function EvidenceCard({
  rank,
  doc,
  page,
  similarity,
  matchQuality,
  text,
  highlight,
  isSelected,
  onClick,
}: {
  rank: number;
  doc: string;
  page: number | null;
  similarity: number | null;
  matchQuality: "high" | "medium" | "low" | "unknown";
  text: string;
  highlight?: string;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const tone =
    matchQuality === "high"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : matchQuality === "medium"
        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
        : matchQuality === "low"
          ? "text-muted-foreground border-border bg-muted/30"
          : "text-muted-foreground border-border bg-muted/30";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(isSelected)}
      className={`group w-full cursor-pointer rounded-xl border p-3.5 text-left transition-all duration-300 hover:border-accent/40 hover:bg-muted/40 ${
        isSelected
          ? "border-accent bg-accent/10 shadow-[0_0_16px_rgba(var(--color-accent)/0.2)] ring-1 ring-accent"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 font-mono text-[11px] font-bold text-accent">
            [{rank}]
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {formatSourcePage(page)}
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] font-semibold ${tone}`}
        >
          {matchQuality === "unknown" ? "Similarity unavailable" : `${matchQuality} similarity`}
        </span>
      </div>

      <p className="mt-2 truncate text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
        {doc}
      </p>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">{text}</p>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
        <span className="text-[10px] text-muted-foreground font-medium">Retrieval similarity</span>
        {similarity === null ? (
          <span className="font-mono text-[11px] text-muted-foreground">Not recorded</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-16">
              <Meter value={similarity * 100} />
            </div>
            <span className="font-mono text-[11px] font-bold tabular-nums text-foreground">
              {Math.round(similarity * 100)}%
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function ChatPage() {
  const { docs, refresh } = useKnowledgeStore();
  const [scope, setScope] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<number, "up" | "down">>({});
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null);
  const [selectedEvidenceTurnId, setSelectedEvidenceTurnId] = useState<number | null>(null);
  const [expandedDeliberation, setExpandedDeliberation] = useState<Record<number, boolean>>({});
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestVersionRef = useRef(0);
  const conversationLoadVersionRef = useRef(0);
  const turnIdRef = useRef(0);

  const [conversations, setConversations] = useState<
    { _id: string; title: string; updated_at?: string }[]
  >([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [retryQuestion, setRetryQuestion] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [historyActionError, setHistoryActionError] = useState<string | null>(null);
  const [failedDeleteId, setFailedDeleteId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [historyReload, setHistoryReload] = useState(0);

  // Helper to parse backend messages into UI turns
  const parseMessagesToTurns = (msgs: ChatBackendMessage[]): Turn[] => {
    const loadedTurns: Turn[] = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].sender === "user") {
        const asst = msgs[i + 1]?.sender === "assistant" ? msgs[i + 1] : null;
        if (asst) {
          const loadedDecisionStatus: DecisionStatus =
            asst.consensus?.decision_status ||
            (asst.consensus?.status === "reached"
              ? "answer"
              : asst.consensus?.status === "partial"
                ? "partial"
                : "abstain");
          const historyHits = mapEvidenceSources(asst.evidence_sources);
          const createdAt = asst.created_at ? new Date(asst.created_at) : null;
          loadedTurns.push({
            id: ++turnIdRef.current,
            question: msgs[i].content,
            answer: asst.content,
            hits: historyHits,
            scores: mapChatScores({
              confidenceScore: asst.confidence_score,
              consensus: asst.consensus,
              evaluationMatrix: asst.evaluation_matrix,
            }),
            decisionStatus: loadedDecisionStatus,
            abstentionReason: asst.consensus?.abstention_reason || null,
            scoreComponents: asst.consensus?.score_components,
            agents: mapAgentExecutions(asst.agent_executions),
            consensusSummary:
              asst.consensus?.synthesis || "Decision loaded from the authenticated backend.",
            scopeDocs: ["Scope not recorded"],
            timestamp:
              createdAt && Number.isFinite(createdAt.getTime())
                ? createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Time unavailable",
          });
        }
      }
    }
    return loadedTurns;
  };

  const resetCurrentRequest = () => {
    requestVersionRef.current += 1;
    setPending(null);
    setQueryError(null);
    setRetryQuestion(null);
    setSelectedCitation(null);
    setSelectedEvidenceTurnId(null);
  };

  const loadConversation = async (convId: string, force = false) => {
    if (!force && convId === activeConvId) return;
    const loadVersion = ++conversationLoadVersionRef.current;
    resetCurrentRequest();
    setActiveConvId(convId);
    setTurns([]);
    setQuestion("");
    setConversationError(null);
    setHistoryActionError(null);
    setLoadingConversation(true);
    try {
      const msgRes = await ApiClient.getMessages(convId);
      if (loadVersion !== conversationLoadVersionRef.current) return;
      setTurns(msgRes?.messages ? parseMessagesToTurns(msgRes.messages) : []);
    } catch (error) {
      if (loadVersion !== conversationLoadVersionRef.current) return;
      setConversationError(getChatErrorMessage(error, "Unable to load this conversation."));
    } finally {
      if (loadVersion === conversationLoadVersionRef.current) setLoadingConversation(false);
    }
  };

  // Load history once, and discard results if the user starts/selects another chat first.
  useEffect(() => {
    const loadVersion = ++conversationLoadVersionRef.current;
    let mounted = true;
    const loadChatHistory = async () => {
      setConversationError(null);
      setHistoryActionError(null);
      setLoadingConversation(true);
      try {
        const convList = await ApiClient.getConversations();
        if (!mounted || loadVersion !== conversationLoadVersionRef.current) return;
        const items = convList?.conversations ?? [];
        setConversations(items);
        const firstConv = items[0];
        if (!firstConv) return;
        setActiveConvId(firstConv._id);
        const msgRes = await ApiClient.getMessages(firstConv._id);
        if (!mounted || loadVersion !== conversationLoadVersionRef.current) return;
        setTurns(msgRes?.messages ? parseMessagesToTurns(msgRes.messages) : []);
      } catch (error) {
        if (mounted && loadVersion === conversationLoadVersionRef.current) {
          setConversationError(getChatErrorMessage(error, "Unable to load chat history."));
        }
      } finally {
        if (mounted && loadVersion === conversationLoadVersionRef.current) {
          setLoadingConversation(false);
        }
      }
    };
    void loadChatHistory();
    return () => {
      mounted = false;
      conversationLoadVersionRef.current += 1;
    };
  }, [historyReload]);

  const handleSelectConversation = (convId: string) => {
    void loadConversation(convId);
  };

  const handleNewChat = () => {
    conversationLoadVersionRef.current += 1;
    resetCurrentRequest();
    setActiveConvId(null);
    setTurns([]);
    setQuestion("");
    setConversationError(null);
    setHistoryActionError(null);
    setLoadingConversation(false);
  };

  const handleDeleteConversation = async (convId: string) => {
    setHistoryActionError(null);
    setFailedDeleteId(null);
    try {
      await ApiClient.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConvId === convId) handleNewChat();
    } catch (error) {
      setHistoryActionError(getChatErrorMessage(error, "Unable to delete this conversation."));
      setFailedDeleteId(convId);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [conversations, searchQuery]);

  // Active documents in scope (if scope is empty, all documents are searched)
  const activeDocIds = scope.length
    ? docs.filter((doc) => scope.includes(doc.id)).map((doc) => doc.id)
    : null;
  const hasUnavailableScope = scope.length > 0 && activeDocIds?.length === 0;
  const hasMissingSelectedDocuments =
    scope.length > 0 && activeDocIds !== null && activeDocIds.length < scope.length;
  const activeDocNames = useMemo(() => {
    if (scope.length === 0) return ["All Indexed Sources"];
    const selectedNames = docs.filter((d) => scope.includes(d.id)).map((d) => d.name);
    return selectedNames.length ? selectedNames : ["Selected sources unavailable"];
  }, [docs, scope]);

  // Handle direct file upload right from chat page
  const handleSourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploadingSource(true);
    try {
      const doc = await ingestFile(file);
      await refresh();
      // Auto-select the newly uploaded file into active scope
      setScope((prev) => (prev.includes(doc.id) ? prev : [...prev, doc.id]));
    } catch (error) {
      console.error("Source upload failed", error);
      setUploadError(getChatErrorMessage(error, "Document upload failed. Try again."));
    } finally {
      setIsUploadingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  async function ask(q: string) {
    const prompt = q.trim();
    if (!prompt || pending) return;
    if (hasUnavailableScope) {
      setQueryError(
        "The selected source is no longer available. Refresh the document list or select another source.",
      );
      setRetryQuestion(null);
      return;
    }
    const requestVersion = ++requestVersionRef.current;
    conversationLoadVersionRef.current += 1;
    setLoadingConversation(false);
    const requestConversationId = activeConvId;
    const requestDocumentIds = activeDocIds ?? undefined;
    const requestScopeDocs = [...activeDocNames];
    setQueryError(null);
    setRetryQuestion(null);
    setConversationError(null);
    setPending(prompt);
    setSelectedEvidenceTurnId(null);
    setSelectedCitation(null);

    try {
      let cId = requestConversationId;
      if (!cId) {
        const title = prompt.length > 28 ? prompt.slice(0, 28) + "…" : prompt;
        const created = await ApiClient.createConversation(title);
        cId = created?.conversation?._id;
        if (requestVersion !== requestVersionRef.current) return;
        if (cId && created?.conversation) {
          setActiveConvId(cId);
          setConversations((prev) => [created.conversation, ...prev]);
        }
      }
      if (cId) {
        const liveRes = await ApiClient.sendMessage(cId, prompt, requestDocumentIds);
        if (requestVersion !== requestVersionRef.current) return;
        const asst = liveRes?.assistant_message;
        if (!asst || typeof asst.content !== "string" || !asst.content.trim()) {
          throw new Error("Backend did not provide a grounded assistant response");
        }

        const liveHits = mapEvidenceSources(asst.evidence_sources);
        const updatedTurn: Turn = {
          id: ++turnIdRef.current,
          question: prompt,
          answer: asst.content,
          hits: liveHits,
          scores: mapChatScores({
            confidenceScore: asst.confidence_score,
            consensus: asst.consensus,
            evaluationMatrix: asst.evaluation_matrix,
          }),
          decisionStatus:
            asst.consensus?.decision_status ||
            (asst.consensus?.status === "reached"
              ? "answer"
              : asst.consensus?.status === "partial"
                ? "partial"
                : "abstain"),
          abstentionReason: asst.consensus?.abstention_reason || null,
          scoreComponents: asst.consensus?.score_components,
          agents: mapAgentExecutions(asst.agent_executions),
          consensusSummary:
            asst.consensus?.synthesis || "Decision returned by the authenticated backend.",
          scopeDocs: requestScopeDocs,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setTurns((prev) => [...prev, updatedTurn]);
      } else {
        throw new Error("Backend did not provide a conversation");
      }
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) return;
      console.error("Backend RAG query failed", error);
      setQueryError(getChatErrorMessage(error, "The TrustRAG backend is unavailable."));
      setRetryQuestion(prompt);
    } finally {
      if (requestVersion === requestVersionRef.current) setPending(null);
    }
  }

  const latest = turns[turns.length - 1];
  const displayState = resolveChatDisplayState({
    pending: pending !== null,
    hasError: queryError !== null,
    decision: latest?.decisionStatus,
  });
  const evidenceTurn = selectedEvidenceTurnId
    ? (turns.find((turn) => turn.id === selectedEvidenceTurnId) ?? latest)
    : latest;
  const evidence =
    displayState === "pending" || displayState === "error" ? [] : (evidenceTurn?.hits ?? []);

  function exportTranscript() {
    const body = turns
      .map(
        (t) =>
          `[TRUST-RAG AUDIT LOG - ${t.timestamp}]\n` +
          `QUERY: ${t.question}\n\n` +
          `ANSWER:\n${t.answer}\n\n` +
          `DECISION SCORE: ${formatMetric(t.scores.decision)} | AGENT AGREEMENT: ${formatMetric(t.scores.agentAgreement)} | MEAN RETRIEVAL SIMILARITY: ${formatMetric(t.scores.retrievalSimilarity)}\n` +
          `ACTIVE SCOPE: ${t.scopeDocs.join(", ")}\n` +
          `EVIDENCE CITATIONS:\n` +
          t.hits
            .map(
              (h, i) =>
                `[${i + 1}] ${h.docName} (${formatSourcePage(h.page)}, Similarity: ${h.similarity === null ? "not recorded" : `${Math.round(h.similarity * 100)}%`})\n"${h.text}"\n`,
            )
            .join("\n") +
          `AGENT AUDIT TRAIL:\n` +
          t.agents
            .map(
              (a) =>
                `• ${a.name} (${a.model ?? "model not recorded"}) - Latency: ${a.latencyMs === null ? "not recorded" : `${a.latencyMs}ms`}\n  Claims: ${a.propositions.join(" | ")}`,
            )
            .join("\n") +
          `\n======================================================\n`,
      )
      .join("\n\n");

    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustrag-audit-trail-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow="Multi-Agent RAG Pipeline"
        title="Chat with your documents."
        description="Ask a question in your own words. Answers and citations come from the selected documents and the TrustRAG response."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={sidebarOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-full gap-1.5"
            >
              <PanelLeft size={13} />
              <span>History ({conversations.length})</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="rounded-full gap-1.5 border-accent/40 bg-accent/5 text-accent hover:bg-accent/15"
            >
              <Plus size={13} />
              <span>New Chat</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportTranscript}
              disabled={!turns.length}
              className="rounded-full gap-1.5"
            >
              <Download size={13} /> Export Log
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTurns([]);
                setVotes({});
              }}
              disabled={!turns.length}
              className="rounded-full gap-1.5"
            >
              <Trash2 size={13} /> Clear
            </Button>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-5 items-start mt-2">
        {/* ========================================================================= */}
        {/* 💬 CHAT HISTORY SIDEBAR */}
        {/* ========================================================================= */}
        {sidebarOpen && (
          <aside className="w-full lg:w-72 shrink-0 animate-fade-in">
            <Panel className="p-3.5 sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Chat Threads
                  </span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                    {conversations.length}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNewChat}
                  className="h-7 px-2 text-xs rounded-lg gap-1 text-accent hover:text-accent hover:bg-accent/10"
                  title="Start New Thread"
                >
                  <Plus size={12} />
                  <span>New</span>
                </Button>
              </div>

              {/* Search filter */}
              <div className="mt-3 relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search history…"
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-muted/40 outline-none focus:border-foreground/30 focus:bg-background transition-colors"
                />
              </div>

              {/* Threads list */}
              <div className="mt-3 max-h-[calc(100vh-320px)] overflow-y-auto space-y-1 pr-1">
                {loadingConversation ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading thread…</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {conversations.length === 0 ? "No chat history yet" : "No matching threads"}
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isActive = conv._id === activeConvId;
                    return (
                      <div
                        key={conv._id}
                        className={`group relative flex items-center justify-between rounded-xl px-2 py-1.5 text-xs transition-all duration-200 ${
                          isActive
                            ? "bg-accent/15 border border-accent/40 text-foreground font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                        }`}
                      >
                        <button
                          type="button"
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => handleSelectConversation(conv._id)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <MessageSquare
                            size={13}
                            className={isActive ? "text-accent shrink-0" : "shrink-0 opacity-50"}
                          />
                          <span className="truncate">{conv.title || "Untitled Conversation"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteConversation(conv._id)}
                          className="ml-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          aria-label={`Delete ${conv.title || "untitled conversation"}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              {conversationError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <p>{conversationError}</p>
                  {activeConvId && (
                    <button
                      type="button"
                      onClick={() => void loadConversation(activeConvId, true)}
                      className="mt-2 underline underline-offset-2"
                    >
                      Retry loading this thread
                    </button>
                  )}
                  {!activeConvId && (
                    <button
                      type="button"
                      onClick={() => setHistoryReload((reload) => reload + 1)}
                      className="mt-2 underline underline-offset-2"
                    >
                      Retry loading chat history
                    </button>
                  )}
                </div>
              )}
              {historyActionError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  {historyActionError}
                  {failedDeleteId && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteConversation(failedDeleteId)}
                      className="mt-2 block underline underline-offset-2"
                    >
                      Retry delete
                    </button>
                  )}
                </div>
              )}
            </Panel>
          </aside>
        )}

        {/* ========================================================================= */}
        {/* 🚀 MAIN CHAT COLUMN */}
        {/* ========================================================================= */}
        <div className="min-w-0 flex-1 w-full">
          {/* 📁 INTERACTIVE SOURCE DOCUMENT SELECTOR HUB (NEW MODERN DESIGN) */}
          <div className="mb-5 rounded-2xl border border-border/80 bg-card/70 p-4 shadow-sm backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Layers size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Source Documents
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                      {docs.length} Available
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Toggle documents below to scope retrieval. Selected files directly ground AI
                    answers.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={scope.length === 0}
                  onClick={() => setScope([])}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    scope.length === 0
                      ? "bg-foreground text-background font-semibold shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  All Sources ({docs.length})
                </button>
                {scope.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScope([])}
                    className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Clear Selection
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleSourceUpload}
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUploadingSource}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 rounded-lg gap-1.5 border-dashed border-accent/40 bg-accent/5 text-accent hover:bg-accent/15"
                >
                  {isUploadingSource ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Plus size={13} />
                  )}
                  <span>{isUploadingSource ? "Indexing…" : "Upload Source"}</span>
                </Button>
              </div>
            </div>

            {/* Horizontal Document Pills with Badges */}
            <div className="mt-3 flex flex-wrap gap-2 pt-1 max-h-40 overflow-y-auto pr-1">
              {docs.map((doc) => {
                const isSelected = scope.length === 0 || scope.includes(doc.id);
                const isExplicit = scope.includes(doc.id);

                return (
                  <button
                    key={doc.id}
                    type="button"
                    aria-pressed={scope.length === 0 || isExplicit}
                    onClick={() => {
                      setScope((prev) => {
                        if (prev.includes(doc.id)) {
                          return prev.filter((id) => id !== doc.id);
                        } else {
                          return [...prev, doc.id];
                        }
                      });
                    }}
                    className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-200 ${
                      isExplicit
                        ? "border-accent bg-accent/15 text-foreground shadow-[0_0_12px_rgba(var(--color-accent)/0.18)]"
                        : isSelected && scope.length === 0
                          ? "border-border/80 bg-secondary/40 text-foreground hover:border-accent/40"
                          : "border-border/40 bg-muted/20 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    {/* File Type Badge */}
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase border ${getFileTypeColor(doc.type)}`}
                    >
                      {doc.type}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold max-w-[170px]">{doc.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {doc.chunkCount} chunks · {doc.sizeLabel}
                      </p>
                    </div>

                    {doc.isUserUploaded && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                        Uploaded
                      </span>
                    )}

                    <div
                      className={`ml-1 flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                        isExplicit
                          ? "border-accent bg-accent text-accent-foreground"
                          : isSelected && scope.length === 0
                            ? "border-muted-foreground/40 bg-transparent"
                            : "border-border bg-transparent"
                      }`}
                    >
                      {isExplicit && <Check size={10} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {uploadError && (
              <div
                role="alert"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
              >
                <span>{uploadError}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingSource}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Retry upload
                </Button>
              </div>
            )}

            {hasMissingSelectedDocuments && !hasUnavailableScope && (
              <div
                role="status"
                className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200"
              >
                Some selected documents are no longer available. This query will use only the
                remaining selected sources.
              </div>
            )}

            {/* Current Scope Banner */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" />
                <span>
                  Active Grounding:{" "}
                  <strong className="text-foreground">
                    {scope.length === 0 ? "All Documents" : `${scope.length} Selected File(s)`}
                  </strong>{" "}
                  (
                  {scope.length === 0
                    ? docs.reduce((acc, d) => acc + d.chunkCount, 0)
                    : docs
                        .filter((d) => scope.includes(d.id))
                        .reduce((acc, d) => acc + d.chunkCount, 0)}{" "}
                  Chunks in Context)
                </span>
              </span>
              <span className="text-[11px] font-mono">TrustRAG retrieval</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 💬 CHAT & EVIDENCE WORKSPACE */}
          {/* ========================================================================= */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
            {/* Left Column: Conversation */}
            <div className="mx-auto flex min-h-[72vh] w-full max-w-4xl flex-col">
              {!sidebarOpen && (conversationError || historyActionError) && (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  <p>{conversationError || historyActionError}</p>
                  {conversationError && activeConvId && (
                    <button
                      type="button"
                      onClick={() => void loadConversation(activeConvId, true)}
                      className="mt-2 underline underline-offset-2"
                    >
                      Retry loading this thread
                    </button>
                  )}
                  {historyActionError && failedDeleteId && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteConversation(failedDeleteId)}
                      className="mt-2 block underline underline-offset-2"
                    >
                      Retry delete
                    </button>
                  )}
                </div>
              )}
              <Conversation className="h-[clamp(460px,60vh,700px)] flex-none rounded-2xl border border-border bg-card shadow-[0_10px_32px_rgba(15,23,42,0.04)]">
                <ConversationContent className="gap-5 px-0 py-0 pr-1">
                  {turns.map((t) => (
                    <div key={t.id} className="space-y-4">
                      {/* User message */}
                      <ChatMessage from="user">
                        <ChatMessageContent className="bg-primary text-primary-foreground shadow-sm">
                          {t.question}
                        </ChatMessageContent>
                      </ChatMessage>

                      {/* Assistant response card */}
                      <ChatMessage from="assistant">
                        <Panel className="animate-rise w-full p-5 shadow-sm">
                          {/* Meta header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={16} className="text-accent" />
                              <MonoLabel>Response and evidence</MonoLabel>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                                  t.decisionStatus === "answer"
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                    : t.decisionStatus === "partial"
                                      ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                      : "border-red-500/20 bg-red-500/10 text-red-400"
                                }`}
                              >
                                {t.decisionStatus === "answer"
                                  ? "Answer"
                                  : t.decisionStatus === "partial"
                                    ? "Partial evidence"
                                    : "Abstained"}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {t.timestamp}
                              </span>
                            </div>
                          </div>

                          {/* Scoped files pill */}
                          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Filter size={11} className="text-accent" />
                            <span>Grounded in:</span>
                            <span className="font-medium text-foreground truncate max-w-md">
                              {t.scopeDocs.join(", ")}
                            </span>
                          </div>

                          {/* Answer Content */}
                          <div className="mt-4">
                            {t.decisionStatus === "abstain" && (
                              <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                                {t.abstentionReason ||
                                  "The selected documents did not provide enough verified evidence."}
                              </div>
                            )}
                            <Markdown
                              text={t.answer}
                              evidenceCount={t.hits.length}
                              onCitationClick={(citIdx) => {
                                setSelectedEvidenceTurnId(t.id);
                                setSelectedCitation(citIdx);
                              }}
                            />
                          </div>

                          <dl
                            aria-label="Operational score signals"
                            className="mt-5 grid grid-cols-3 divide-x divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-muted/20"
                          >
                            <div className="min-w-0 px-3 py-2.5 sm:px-4">
                              <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Decision score
                              </dt>
                              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                                {formatMetric(t.scores.decision)}
                              </dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5 sm:px-4">
                              <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Agent agreement
                              </dt>
                              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                                {formatMetric(t.scores.agentAgreement)}
                              </dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5 sm:px-4">
                              <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Mean similarity
                              </dt>
                              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                                {formatMetric(t.scores.retrievalSimilarity)}
                              </dd>
                            </div>
                          </dl>
                          <p className="mt-1.5 text-[10px] text-muted-foreground">
                            Operational heuristics only; these are not calibrated accuracy scores.
                          </p>

                          {/* 🤖 Expandable Multi-Agent Deliberation Breakdown */}
                          <div className="mt-4 border-t border-border/70 pt-3">
                            <button
                              type="button"
                              aria-expanded={Boolean(expandedDeliberation[t.id])}
                              aria-controls={`agent-activity-${t.id}`}
                              onClick={() =>
                                setExpandedDeliberation((prev) => ({
                                  ...prev,
                                  [t.id]: !prev[t.id],
                                }))
                              }
                              className="flex w-full items-center justify-between rounded-xl bg-secondary/40 px-3.5 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary"
                            >
                              <span className="flex items-center gap-2">
                                <BrainCircuit size={14} className="text-accent" />
                                Agent activity
                              </span>
                              <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${
                                  expandedDeliberation[t.id] ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {expandedDeliberation[t.id] && (
                              <div
                                id={`agent-activity-${t.id}`}
                                role="region"
                                aria-label="Recorded agent activity"
                                className="mt-3 rounded-xl border border-border/80 bg-background/50 p-3.5 animate-fade-in"
                              >
                                <p className="mb-3 text-[10px] text-muted-foreground">
                                  Execution records show what ran; they do not independently prove a
                                  claim is correct.
                                </p>
                                {t.agents.length === 0 ? (
                                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                                    Per-agent details were not recorded for this answer.
                                  </p>
                                ) : (
                                  <ol className="space-y-3">
                                    {t.agents.map((agent, aIdx) => (
                                      <li
                                        key={`${agent.name}-${aIdx}`}
                                        className="relative flex gap-3 border-l border-border/80 pb-3 pl-4 last:border-l-transparent last:pb-0"
                                      >
                                        <span className="absolute -left-[5px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-accent bg-background" />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                            <div className="min-w-0">
                                              <p className="text-xs font-semibold text-foreground">
                                                {agent.name}
                                              </p>
                                              <p className="text-[10px] text-muted-foreground">
                                                {agent.role}
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                                              {agent.model && <span>{agent.model}</span>}
                                              {agent.latencyMs !== null && (
                                                <span>{agent.latencyMs} ms</span>
                                              )}
                                            </div>
                                          </div>
                                          {agent.propositions.length > 0 && (
                                            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground marker:text-accent">
                                              {agent.propositions.map((proposition, pIdx) => (
                                                <li key={pIdx}>{proposition}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Supporting Source Citations Bar */}
                          {t.hits.length > 0 && (
                            <div className="mt-4 border-t border-border/70 pt-3">
                              <MonoLabel>Retrieved supporting passages</MonoLabel>
                              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                                {t.hits.map((c, i) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedEvidenceTurnId(t.id);
                                      setSelectedCitation(i + 1);
                                    }}
                                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-all ${
                                      selectedEvidenceTurnId === t.id && selectedCitation === i + 1
                                        ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent"
                                        : "border-border bg-muted/20 hover:bg-muted/50"
                                    }`}
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/20 font-mono text-[10px] font-bold text-accent">
                                      [{i + 1}]
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-semibold text-foreground">
                                        {c.docName}
                                      </p>
                                      <p className="font-mono text-[10px] text-muted-foreground">
                                        {formatSourcePage(c.page)} ·{" "}
                                        {c.similarity === null
                                          ? "Similarity not recorded"
                                          : `${Math.round(c.similarity * 100)}% match`}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                            <button
                              onClick={async () => {
                                setCopyErrorId(null);
                                try {
                                  if (!navigator.clipboard?.writeText) {
                                    throw new Error(
                                      "Clipboard access is not available in this browser.",
                                    );
                                  }
                                  await navigator.clipboard.writeText(t.answer);
                                  setCopiedId(t.id);
                                  window.setTimeout(() => setCopiedId(null), 1500);
                                } catch {
                                  setCopyErrorId(t.id);
                                }
                              }}
                              type="button"
                              aria-label="Copy answer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
                            >
                              {copiedId === t.id ? (
                                <Check size={13} className="text-emerald-400" />
                              ) : (
                                <Copy size={13} />
                              )}
                              {copiedId === t.id ? "Copied" : "Copy Answer"}
                            </button>
                            <button
                              type="button"
                              onClick={() => ask(t.question)}
                              disabled={pending !== null}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
                            >
                              <RefreshCw size={13} /> Re-verify
                            </button>
                            <div className="ml-auto flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setVotes((v) => ({ ...v, [t.id]: "up" }))}
                                className={`rounded-full border border-border p-2 transition-colors hover:bg-secondary ${
                                  votes[t.id] === "up"
                                    ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10"
                                    : ""
                                }`}
                                aria-label="Helpful"
                              >
                                <ThumbsUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setVotes((v) => ({ ...v, [t.id]: "down" }))}
                                className={`rounded-full border border-border p-2 transition-colors hover:bg-secondary ${
                                  votes[t.id] === "down"
                                    ? "text-destructive border-destructive/50 bg-destructive/10"
                                    : ""
                                }`}
                                aria-label="Not helpful"
                              >
                                <ThumbsDown size={13} />
                              </button>
                            </div>
                          </div>
                          {copyErrorId === t.id && (
                            <p role="status" className="mt-2 text-xs text-destructive">
                              Clipboard access failed. Select and copy the answer manually.
                            </p>
                          )}
                        </Panel>
                      </ChatMessage>
                    </div>
                  ))}

                  {loadingConversation && turns.length === 0 && (
                    <div
                      role="status"
                      className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
                    >
                      <Loader2 size={16} className="animate-spin" /> Loading conversation…
                    </div>
                  )}

                  {!loadingConversation && turns.length === 0 && !pending && !conversationError && (
                    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                        <MessageSquare size={21} />
                      </div>
                      <h2 className="mt-4 text-base font-semibold text-foreground">
                        Ask your documents
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Enter a question in your own words. TrustRAG will use the source scope above
                        and show the returned evidence with its answer.
                      </p>
                    </div>
                  )}

                  {displayState === "pending" && pending && (
                    <>
                      <ChatMessage from="user">
                        <ChatMessageContent className="bg-primary text-primary-foreground">
                          {pending}
                        </ChatMessageContent>
                      </ChatMessage>
                      <ChatMessage from="assistant">
                        <div role="status" aria-live="polite" className="w-full">
                          <Panel className="animate-rise w-full p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                              <Loader2 size={17} className="shrink-0 animate-spin text-accent" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  Working on your question
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Retrieving from the selected sources and waiting for the verified
                                  response…
                                </p>
                              </div>
                            </div>
                          </Panel>
                        </div>
                      </ChatMessage>
                    </>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {/* Dynamic Suggestion Chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending !== null}
                    onClick={() => !pending && ask(s)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-secondary hover:text-foreground hover:border-accent/40"
                  >
                    <Sparkle size={12} className="text-accent" /> {s}
                  </button>
                ))}
              </div>

              {displayState === "error" && queryError && (
                <div
                  role="alert"
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  <p className="min-w-0 flex-1">{queryError} No answer was generated.</p>
                  {retryQuestion && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void ask(retryQuestion)}
                      disabled={pending !== null}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <RefreshCw size={13} className="mr-1.5" /> Retry question
                    </Button>
                  )}
                </div>
              )}

              {/* Modern Command Prompt Input */}
              <PromptInput
                onSubmit={(message) => {
                  if (!message.text.trim() || pending) return;
                  void ask(message.text.trim());
                  setQuestion("");
                }}
                className="sticky bottom-2 z-20 mt-3 rounded-2xl border-border bg-card/95 shadow-[0_10px_32px_rgba(15,23,42,0.14)] backdrop-blur-md"
              >
                <PromptInputTextarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  aria-label="Ask a question about your selected documents"
                  placeholder={
                    scope.length === 0
                      ? `Ask anything — searching all ${docs.length} indexed documents…`
                      : `Ask a question grounded in the ${scope.length} selected document(s)…`
                  }
                  className="min-h-20 px-4 py-3 text-sm placeholder:text-muted-foreground/60"
                />
                <PromptInputFooter className="items-center justify-between px-3 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="truncate">
                      {scope.length === 0
                        ? "Scope: All Sources"
                        : `Scope: ${activeDocIds?.length ?? 0} File(s)`}
                    </span>
                  </div>
                  <PromptInputSubmit
                    status={pending ? "submitted" : "ready"}
                    disabled={!question.trim() || !!pending}
                    className="rounded-full shadow-sm"
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>

            {/* Right Column: Evidence Inspector Panel */}
            <Panel className="animate-rise h-fit p-5 xl:sticky xl:top-24">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <button
                  type="button"
                  aria-expanded={inspectorOpen}
                  onClick={() => setInspectorOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ScanSearch size={16} className="text-accent" />
                  <MonoLabel>Evidence Inspector</MonoLabel>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${inspectorOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                  {evidence.length} Chunks
                </span>
              </div>

              {inspectorOpen &&
                (evidence.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
                    <FileText size={24} className="mx-auto text-muted-foreground/50" />
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      No Evidence Retrieved Yet
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Ask a question to see exact document chunks, similarity scores, and citations
                      highlighted here.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 max-h-[580px] overflow-y-auto pr-1">
                    {evidence.map((c, i) => (
                      <EvidenceCard
                        key={c.id}
                        rank={i + 1}
                        doc={c.docName}
                        page={c.page}
                        similarity={c.similarity}
                        matchQuality={c.matchQuality}
                        text={c.text}
                        isSelected={
                          selectedEvidenceTurnId === evidenceTurn?.id && selectedCitation === i + 1
                        }
                        onClick={() => {
                          if (evidenceTurn) setSelectedEvidenceTurnId(evidenceTurn.id);
                          setSelectedCitation(i + 1);
                        }}
                      />
                    ))}
                  </div>
                ))}

              {inspectorOpen && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Evidence and Retrieval provenance shown here are taken from the backend response.
                </p>
              )}

              {/* TrustRAG consensus safeguards */}
              {inspectorOpen && (
                <div className="mt-5 border-t border-border pt-4">
                  <MonoLabel>Consensus Safeguards</MonoLabel>
                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <BadgeCheck size={14} className="mt-0.5 text-emerald-400 shrink-0" />
                      <span>
                        <strong className="text-foreground">Retriever Agent:</strong> Top-K cosine
                        similarity semantic filtering.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <SearchCheck size={14} className="mt-0.5 text-cyan-400 shrink-0" />
                      <span>
                        <strong className="text-foreground">Fact-Checker:</strong> Cross-references
                        propositions with domain truth.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldCheck size={14} className="mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong className="text-foreground">Critic Auditor:</strong> Adversarial
                        check for ungrounded statements.
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
