import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Message from "../models/Message.js";
import ConsensusResult from "../models/ConsensusResult.js";
import AgentExecution from "../models/AgentExecution.js";
import DocumentModel from "../models/Document.js";
import Conversation from "../models/Conversation.js";
import { isDbConnected } from "../config/database.js";

export const getAnalyticsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const conversations = await Conversation.find({ user_id: req.user?._id }).select("_id").lean();
    const conversationIds = conversations.map((conversation) => conversation._id);
    const [documents, assistantMessages, consensusResults] = await Promise.all([
      DocumentModel.find({ user_id: req.user?._id }).select("status chunks_count").lean(),
      Message.find({ conversation_id: { $in: conversationIds }, sender: "assistant" })
        .select("_id confidence_score created_at")
        .sort({ created_at: -1 })
        .lean(),
      ConsensusResult.find({
        message_id: {
          $in: await Message.find({ conversation_id: { $in: conversationIds }, sender: "assistant" })
            .distinct("_id"),
        },
      })
        .select("message_id status consensus_score created_at")
        .lean(),
    ]);
    const assistantIds = assistantMessages.map((message) => message._id);
    const agentExecutions = await AgentExecution.find({ message_id: { $in: assistantIds } })
      .select("agent_name confidence latency_ms")
      .lean();

    const average = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const avgConfidence = average(
      assistantMessages.map((message) => Number(message.confidence_score ?? 0)),
    );
    const avgConsensus = average(consensusResults.map((result) => Number(result.consensus_score ?? 0)));
    const consensusPassed = consensusResults.filter((result) => result.status === "reached").length;
    const consensusRate = consensusResults.length ? (consensusPassed / consensusResults.length) * 100 : 0;
    const avgLatency = average(agentExecutions.map((execution) => Number(execution.latency_ms ?? 0)));

    const recentTrends = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - offset));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const dayMessages = assistantMessages.filter((message) => {
        const created = new Date(message.created_at);
        return created >= date && created < next;
      });
      return {
        date: date.toISOString().slice(0, 10),
        queries: dayMessages.length,
        avg_score: Math.round(average(dayMessages.map((message) => Number(message.confidence_score ?? 0))) * 10) / 10,
      };
    });

    const groupedAgents = new Map<string, { confidence: number[]; latency: number[] }>();
    for (const execution of agentExecutions) {
      const key = String(execution.agent_name ?? "unknown");
      const group = groupedAgents.get(key) ?? { confidence: [], latency: [] };
      group.confidence.push(Number(execution.confidence ?? 0) * 100);
      group.latency.push(Number(execution.latency_ms ?? 0));
      groupedAgents.set(key, group);
    }

    res.json({
      metrics: {
        total_queries: assistantMessages.length,
        avg_confidence_score: Math.round(avgConfidence * 10) / 10,
        consensus_rate: Math.round(consensusRate * 10) / 10,
        avg_consensus_score: Math.round(avgConsensus * 10) / 10,
        avg_latency_ms: Math.round(avgLatency),
        total_documents_indexed: documents.filter((document) => document.status === "ready").length,
        total_documents: documents.length,
        total_chunks: documents.reduce((sum, document) => sum + Number(document.chunks_count ?? 0), 0),
      },
      agent_performance: Array.from(groupedAgents, ([agent, values]) => ({
        agent,
        avg_confidence: Math.round(average(values.confidence) * 10) / 10,
        avg_latency: Math.round(average(values.latency)),
      })),
      recent_trends: recentTrends,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch analytics", message: err.message });
  }
};
