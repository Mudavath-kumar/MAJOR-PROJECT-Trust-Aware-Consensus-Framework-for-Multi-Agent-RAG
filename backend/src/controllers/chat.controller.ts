import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import AgentExecution from "../models/AgentExecution.js";
import ConsensusResult from "../models/ConsensusResult.js";
import Settings from "../models/Settings.js";
import { AIService } from "../services/ai.service.js";
import { isDbConnected } from "../config/database.js";

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

    // Forward user's saved LLM settings to the AI pipeline
    let aiSettings: Record<string, unknown> | undefined;
    if (isDbConnected() && req.user?._id) {
      const saved = await Settings.findOne({ user_id: req.user._id }).lean();
      if (saved) {
        aiSettings = {
          gemini_api_key:      (saved as any).gemini_api_key      || undefined,
          tavily_api_key:      (saved as any).tavily_api_key      || undefined,
          preferred_model:     (saved as any).preferred_model     || undefined,
          consensus_threshold: (saved as any).consensus_threshold || undefined,
          similarity_top_k:    (saved as any).similarity_top_k    || undefined,
        };
      }
    }

    const aiResult = await AIService.queryPipeline({
      query: content,
      conversation_id: conversationId,
      user_id: req.user?._id || "",
      document_ids,
      settings: aiSettings,
    });

    // Save user message to MongoDB
    const userMsg = await Message.create({
      conversation_id: conversationId,
      sender: "user",
      content,
      status: "done",
    });

    // Save assistant message to MongoDB
    const asstMsg = await Message.create({
      conversation_id: conversationId,
      sender: "assistant",
      content: aiResult.synthesis,
      confidence_score: aiResult.confidence_score,
      status: "done",
      evidence_sources: aiResult.evidence_sources,
    });

    // Save consensus result
    const consensusDoc = await ConsensusResult.create({
      message_id: asstMsg._id,
      status: aiResult.consensus.status,
      consensus_score: aiResult.consensus.consensus_score,
      agreement_ratio: aiResult.consensus.agreement_ratio,
      conflicts: aiResult.consensus.conflicts,
      synthesis: aiResult.consensus.synthesis,
    });

    // Save agent executions
    const executionDocs = await Promise.all(
      aiResult.agent_executions.map((exec) =>
        AgentExecution.create({
          message_id: asstMsg._id,
          agent_name: exec.agent_name,
          agent_role: exec.agent_role,
          model_used: exec.model_used,
          claim_propositions: exec.claim_propositions,
          raw_output: exec.raw_output,
          confidence: exec.confidence,
          latency_ms: exec.latency_ms,
          sources_cited: exec.sources_cited,
        }),
      ),
    );

    // Update conversation timestamp
    await Conversation.findByIdAndUpdate(conversationId, { updated_at: new Date() });

    res.status(201).json({
      user_message: userMsg,
      assistant_message: {
        ...asstMsg.toObject(),
        consensus: consensusDoc,
        agent_executions: executionDocs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process message", message: err.message });
  }
};
