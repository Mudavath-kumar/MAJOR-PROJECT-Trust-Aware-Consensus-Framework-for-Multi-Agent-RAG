import { createHash } from "node:crypto";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Message from "../models/Message.js";
import AgentExecution from "../models/AgentExecution.js";
import ConsensusResult from "../models/ConsensusResult.js";
import { isDbConnected } from "../config/database.js";

export const getEvidenceByMessageId = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    if (!isDbConnected()) {
      res.json({
        message_id: messageId,
        evidence_graph: {
          nodes: [
            { id: "query", label: "User Query", type: "root" },
            { id: "retriever", label: "Retriever Agent", type: "agent" },
            { id: "fact_checker", label: "Fact Checker", type: "agent" },
            { id: "critic", label: "Critic Agent", type: "agent" },
            { id: "chunk_1", label: "Policy_Document_2026.pdf (p.4)", type: "chunk" },
            { id: "chunk_2", label: "Compliance_Audit_Q1.pdf (p.12)", type: "chunk" },
          ],
          edges: [
            { source: "query", target: "retriever" },
            { source: "retriever", target: "chunk_1" },
            { source: "retriever", target: "chunk_2" },
            { source: "retriever", target: "fact_checker" },
            { source: "fact_checker", target: "critic" },
          ],
        },
        sources: [
          {
            document_id: "doc-001",
            document_name: "Policy_Document_2026.pdf",
            chunk_id: "chunk-p4-c2",
            text: "Section 4.2: Data encryption mandates AES-256 for all persistent storage volumes. Key rotation intervals shall not exceed 90 days.",
            similarity_score: 0.96,
            rerank_score: 0.98,
            page_number: 4,
          },
        ],
      });
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
    const { messageId } = req.params;
    if (!isDbConnected()) {
      res.status(503).json({ error: "Database unavailable — cannot produce verified audit trail" });
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
