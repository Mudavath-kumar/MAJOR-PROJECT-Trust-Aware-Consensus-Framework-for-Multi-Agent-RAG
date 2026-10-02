import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import AgentExecution from "../models/AgentExecution.js";
import ConsensusResult from "../models/ConsensusResult.js";
import Settings from "../models/Settings.js";
import { AIService } from "../services/ai.service.js";
import { isDbConnected } from "../config/database.js";
import DocumentModel from "../models/Document.js";
import mongoose from "mongoose";
import { assertRequestedDocumentIdsAreOwned } from "../utils/security-scope.js";
import { decryptSecret } from "../utils/secret-box.js";

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }

    const conversations = await Conversation.find({ user_id: req.user?._id }).sort({
      updated_at: -1,
    });
    res.json({ conversations });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch conversations", message: err.message });
  }
};

export const createConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title } = req.body;

    if (!isDbConnected()) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }

    const newConv = await Conversation.create({
      user_id: req.user?._id,
      title: title || "New Conversation",
    });

    res.status(201).json({ conversation: newConv });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create conversation", message: err.message });
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    if (!isDbConnected() || !req.user?._id) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }

    const conv = await Conversation.findOneAndDelete({ _id: conversationId, user_id: req.user._id });
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await Message.deleteMany({ conversation_id: conversationId });
    res.json({ success: true, message: "Conversation deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete conversation", message: err.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId as string;

    if (!isDbConnected()) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }

    // --- SECURITY: Verify the conversation belongs to the requesting user ---
    const conv = await Conversation.findOne({ _id: conversationId, user_id: req.user?._id });
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = await Message.find({ conversation_id: conversationId }).sort({
      created_at: 1,
    });

    // Populate consensus and agent executions for each assistant message
    const enrichedMessages = await Promise.all(
      messages.map(async (msg) => {
        const msgObj = msg.toObject();
        if (msg.sender === "assistant") {
          const [consensus, executions] = await Promise.all([
            ConsensusResult.findOne({ message_id: msg._id }),
            AgentExecution.find({ message_id: msg._id }),
          ]);
          return {
            ...msgObj,
            consensus: consensus || undefined,
            evaluation_matrix: (consensus as any)?.evaluation_matrix || undefined,
            agent_executions: executions || [],
          };
        }
        return msgObj;
      }),
    );

    res.json({ messages: enrichedMessages });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch messages", message: err.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId as string;
    const { content, document_ids } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    if (!isDbConnected()) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }

    const conversation = await Conversation.findOne({ _id: conversationId, user_id: req.user?._id });
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const requestedDocumentIds = Array.isArray(document_ids)
      ? document_ids.map((id: unknown) => String(id))
      : undefined;
    let scopedDocumentIds: string[] | undefined;
    if (requestedDocumentIds?.length) {
      const validRequestedIds = requestedDocumentIds.filter((id) => mongoose.isValidObjectId(id));
      const ownedDocuments = await DocumentModel.find({
        user_id: req.user?._id,
        _id: { $in: validRequestedIds },
      })
        .select("_id")
        .lean();
      scopedDocumentIds = assertRequestedDocumentIdsAreOwned(
        requestedDocumentIds,
        ownedDocuments.map((document) => document._id.toString()),
      );
    }

    // Forward user's saved LLM settings to the AI pipeline
    let aiSettings: Record<string, unknown> | undefined;
    if (isDbConnected() && req.user?._id) {
      const saved = await Settings.findOne({ user_id: req.user._id }).lean();
      if (saved) {
        aiSettings = {
          gemini_api_key:      decryptSecret((saved as any).gemini_api_key) || undefined,
          tavily_api_key:      decryptSecret((saved as any).tavily_api_key) || undefined,
          preferred_model:     (saved as any).preferred_model     ?? undefined,
          consensus_threshold: (saved as any).consensus_threshold ?? undefined,
          similarity_top_k:    (saved as any).similarity_top_k    ?? undefined,
        };
      }
    }

    const aiResult = await AIService.queryPipeline({
      query: content,
      conversation_id: conversationId,
      user_id: req.user?._id || "",
      document_ids: scopedDocumentIds,
      settings: aiSettings,
    });
    if (!aiResult.synthesis.trim()) {
      throw new Error("AI service returned no grounded synthesis");
    }

    // Save user message to MongoDB
    const userMsg = await Message.create({
      conversation_id: conversationId,
      sender: "user",
      content,
      status: "done",
    });

    const evalMatrix = aiResult.evaluation_matrix || aiResult.consensus?.evaluation_matrix || {
      faithfulness: 0,
      context_precision: 0,
      answer_relevance: 0,
      consensus_alignment: 0,
      hallucination_risk: "high",
      composite_confidence: 0,
    };

    // Safe confidence score (supports both 0..1 and 0..100)
    const rawConf = typeof aiResult.confidence_score === "number" ? aiResult.confidence_score : 0;
    const finalConfidence = rawConf <= 1 ? Math.round(rawConf * 100) : Math.min(Math.round(rawConf), 100);

    // Normalize evidence sources
    const normalizedEvidence = (aiResult.evidence_sources || [])
      .filter((s: any) => s && typeof s.text === "string" && s.text.trim())
      .map((s: any) => ({
      document_id: s.document_id || "",
      document_name: s.document_name || "Unknown source",
      chunk_id: s.chunk_id || "",
      text: s.text || "",
      similarity_score: typeof s.similarity_score === "number" ? s.similarity_score : 0,
      rerank_score: s.rerank_score,
      page_number: s.page_number,
    }));

    // Save assistant message to MongoDB
    const asstMsg = await Message.create({
      conversation_id: conversationId,
      sender: "assistant",
      content: aiResult.synthesis,
      confidence_score: finalConfidence,
      status: "done",
      evidence_sources: normalizedEvidence,
    });

    // Normalize consensus
    const consensusStatusRaw = String(aiResult.consensus?.status || "failed").toLowerCase();
    const consensusStatus =
      consensusStatusRaw === "reached"
        ? "reached"
        : consensusStatusRaw === "failed"
        ? "failed"
        : consensusStatusRaw === "partial"
          ? "partial"
        : "failed";

    const consensusScore =
      typeof aiResult.consensus?.consensus_score === "number"
        ? aiResult.consensus.consensus_score
        : 0;

    const decisionStatus = aiResult.consensus?.decision_status ||
      (consensusStatus === "reached" ? "answer" : consensusStatus === "partial" ? "partial" : "abstain");
    const decisionScore =
      typeof aiResult.consensus?.decision_score === "number"
        ? aiResult.consensus.decision_score
        : consensusScore / 100;

    const agreementRatio =
      typeof aiResult.consensus?.agreement_ratio === "number"
        ? aiResult.consensus.agreement_ratio
        : 0;

    // Save consensus result with evaluation_matrix
    const consensusDoc = await ConsensusResult.create({
      message_id: asstMsg._id,
      status: consensusStatus,
      consensus_score: consensusScore,
      agreement_ratio: agreementRatio,
      conflicts: Array.isArray(aiResult.consensus?.conflicts) ? aiResult.consensus.conflicts : [],
      synthesis: aiResult.consensus?.synthesis || aiResult.synthesis || "",
      evaluation_matrix: evalMatrix,
      decision_status: decisionStatus,
      decision_score: decisionScore,
      abstention_reason: aiResult.consensus?.abstention_reason || null,
      score_components: aiResult.consensus?.score_components || {},
    });

    // Normalize and save agent executions
    const executionDocs = await Promise.all(
      (aiResult.agent_executions || []).map((exec: any) => {
        const rawName = String(exec.agent_name || "retriever").toLowerCase().replace(/\s+/g, "_");
        const normalizedName =
          rawName.includes("retriever") || rawName.includes("researcher")
            ? "retriever"
            : rawName.includes("fact")
              ? "fact_checker"
              : rawName.includes("critic")
                ? "critic"
                : rawName.includes("trust")
                  ? "trust_assessor"
                  : "reasoner";

        const defaultRole =
          normalizedName === "retriever"
            ? "Primary Evidence Extractor"
            : normalizedName === "fact_checker"
              ? "Factual Verification Specialist"
              : normalizedName === "critic"
                ? "Hallucination and Consistency Reviewer"
                : normalizedName === "trust_assessor"
                  ? "Source Trust Assessor"
                  : "Synthesizer and Reasoner";

        const modelUsed = exec.model_used || exec.model || "unknown";
        const rawOutput = exec.raw_output || exec.output_response || exec.output || "";
        const confVal =
          typeof exec.confidence === "number"
            ? exec.confidence
            : typeof exec.confidence_score === "number"
              ? exec.confidence_score
              : 0;
        const confidence = confVal > 1 ? confVal / 100 : confVal;

        const latencyMs =
          typeof exec.latency_ms === "number"
            ? exec.latency_ms
            : typeof exec.execution_time_ms === "number"
              ? exec.execution_time_ms
              : 0;

        return AgentExecution.create({
          message_id: asstMsg._id,
          agent_name: normalizedName,
          agent_role: exec.agent_role || defaultRole,
          model_used: modelUsed,
          claim_propositions: Array.isArray(exec.claim_propositions) ? exec.claim_propositions : [],
          raw_output: rawOutput,
          confidence: confidence,
          latency_ms: latencyMs,
          sources_cited: Array.isArray(exec.sources_cited) ? exec.sources_cited : [],
        });
      }),
    );

    // Update conversation timestamp
    await Conversation.findByIdAndUpdate(conversationId, { updated_at: new Date() });

    res.status(201).json({
      user_message: userMsg,
      assistant_message: {
        ...asstMsg.toObject(),
        consensus: consensusDoc,
        evaluation_matrix: evalMatrix,
        agent_executions: executionDocs,
      },
    });
  } catch (err: any) {
    const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    res.status(statusCode).json({ error: statusCode === 403 ? "Document scope rejected" : "Failed to process message", message: err.message });
  }
};
