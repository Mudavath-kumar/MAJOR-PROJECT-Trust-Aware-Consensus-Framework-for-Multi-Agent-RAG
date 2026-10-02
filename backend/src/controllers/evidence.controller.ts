import { createHash } from "node:crypto";
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import AgentExecution from "../models/AgentExecution.js";
import ConsensusResult from "../models/ConsensusResult.js";
import { isDbConnected } from "../config/database.js";

/**
 * Tenant isolation guard: a message may only be read by the user who owns the
 * conversation it belongs to. Without this, any authenticated user could read
 * another tenant's evidence by guessing a message id.
 */
const isMessageOwnedByUser = async (
  messageId: string,
  userId?: string,
): Promise<boolean> => {
  if (!userId || !mongoose.Types.ObjectId.isValid(messageId)) return false;
  const message = await Message.findById(messageId).select("conversation_id").lean();
  if (!message) return false;
  const conversation = await Conversation.findOne({
    _id: message.conversation_id,
    user_id: userId,
  })
    .select("_id")
    .lean();
  return Boolean(conversation);
};

export const getEvidenceByMessageId = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId as string;

    if (!isDbConnected()) {
      res.status(503).json({ error: "Database unavailable — cannot retrieve verified evidence" });
      return;
    }

    if (!(await isMessageOwnedByUser(messageId, req.user?._id))) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const [consensus, executions] = await Promise.all([
      ConsensusResult.findOne({ message_id: messageId }),
      AgentExecution.find({ message_id: messageId }),
    ]);

    res.json({
      message_id: messageId,
      evidence_sources: message.evidence_sources || [],
      consensus,
      agent_executions: executions,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve evidence", message: err.message });
  }
};

export const exportAuditTrail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId as string;
    if (!isDbConnected()) {
      res.status(503).json({ error: "Database unavailable — cannot produce verified audit trail" });
      return;
    }
    if (!(await isMessageOwnedByUser(messageId, req.user?._id))) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    const message = await Message.findById(messageId);
    if (!message) { res.status(404).json({ error: "Message not found" }); return; }

    const [consensus, executions] = await Promise.all([
      ConsensusResult.findOne({ message_id: messageId }),
      AgentExecution.find({ message_id: messageId }),
    ]);

    const stablePayload = {
      message_id:       messageId,
      consensus_status: consensus?.status ?? "unknown",
      consensus_score:  consensus?.consensus_score ?? 0,
      decision_status:  consensus?.decision_status ?? null,
      decision_score:   consensus?.decision_score ?? null,
      abstention_reason: consensus?.abstention_reason ?? null,
      score_components: consensus?.score_components ?? null,
    };
    const integrity_hash = "sha256-" + createHash("sha256").update(JSON.stringify(stablePayload)).digest("hex");

    const payload = {
      export_timestamp: new Date().toISOString(),
      verified_by:      "TrustRAG Multi-Agent Consensus Framework",
      ...stablePayload,
      evidence_sources: message.evidence_sources ?? [],
      agent_executions: executions.map((e) => ({
        agent_name: e.agent_name,
        confidence: e.confidence,
        latency_ms: e.latency_ms,
      })),
      integrity_hash,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="audit_trail_${messageId}.json"`);
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to export audit trail", message: err.message });
  }
};

export const listAuditRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const userConvs = await Conversation.find({ user_id: req.user?._id }).select("_id").lean();
    const convIds = userConvs.map((c: any) => c._id);

    const asstMessages = await Message.find({
      conversation_id: { $in: convIds },
      sender: "assistant",
    })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    const asstIds = asstMessages.map((m) => m._id);
    const consensusDocs = await ConsensusResult.find({ message_id: { $in: asstIds } }).lean();
    const consensusMap = new Map(consensusDocs.map((c) => [c.message_id.toString(), c]));

    // Fetch matching user queries
    const allMessages = await Message.find({
      conversation_id: { $in: convIds },
    })
      .sort({ created_at: 1 })
      .lean();

    const queryByConv = new Map<string, string>();
    for (const msg of allMessages) {
      if (msg.sender === "user") {
        queryByConv.set(msg.conversation_id.toString(), msg.content);
      }
    }

    const records = asstMessages.map((msg) => {
      const c = consensusMap.get(msg._id.toString());
      const evalMatrix = (c as any)?.evaluation_matrix ?? {
        faithfulness: 0,
        context_precision: 0,
        answer_relevance: 0,
        consensus_alignment: 0,
        hallucination_risk: "high",
        composite_confidence: 0,
      };

      return {
        id: msg._id.toString(),
        conversation_id: msg.conversation_id.toString(),
        query: queryByConv.get(msg.conversation_id.toString()) || "Document Query",
        answer: msg.content,
        confidence_score: msg.confidence_score ?? 0,
        consensus_status: c?.status ?? "failed",
        consensus_score: c?.consensus_score ?? msg.confidence_score ?? 0,
        decision_status:
          c?.decision_status ??
          (c?.status === "reached" ? "answer" : c?.status === "partial" ? "partial" : "abstain"),
        decision_score:
          c?.decision_score ??
          ((c?.consensus_score ?? msg.confidence_score ?? 0) / 100),
        abstention_reason: c?.abstention_reason ?? null,
        score_components: c?.score_components ?? {},
        evaluation_matrix: evalMatrix,
        sources_count: msg.evidence_sources?.length || 0,
        created_at: msg.created_at,
      };
    });

    // Summary calculations
    const total = records.length;
    const avgFaith = total
      ? Math.round(records.reduce((acc, r) => acc + (r.evaluation_matrix.faithfulness ?? 0), 0) / total)
      : 0;
    const avgPrecision = total
      ? Math.round(records.reduce((acc, r) => acc + (r.evaluation_matrix.context_precision ?? 0), 0) / total)
      : 0;
    const avgRelevance = total
      ? Math.round(records.reduce((acc, r) => acc + (r.evaluation_matrix.answer_relevance ?? 0), 0) / total)
      : 0;
    const hallucinationFreeCount = records.filter(
      (r) => r.evaluation_matrix.hallucination_risk === "low"
    ).length;
    const hallucinationFreeRate = total
      ? Math.round((hallucinationFreeCount / total) * 100)
      : 0;

    res.json({
      records,
      summary: {
        total_evaluations: total,
        avg_faithfulness: avgFaith,
        avg_context_precision: avgPrecision,
        avg_answer_relevance: avgRelevance,
        hallucination_free_rate: hallucinationFreeRate,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list audit records", message: err.message });
  }
};
