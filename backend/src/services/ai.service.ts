import axios from "axios";
import { env } from "../config/environment.js";

const aiClient = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: env.AI_SERVICE_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface QueryRAGRequest {
  query: string;
  conversation_id: string;
  user_id: string;
  document_ids?: string[];
  settings?: any;
}

export interface IngestDocumentRequest {
  document_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  user_id: string;
}

export class AIService {
  static async checkHealth(): Promise<{ status: "healthy" | "offline"; service: string }> {
    try {
      const res = await aiClient.get("/health", { timeout: 3000 });
      return res.data;
    } catch (err: any) {
      return { status: "offline", service: "trustrag-ai-service" };
    }
  }

  static async ingestDocument(
    data: IngestDocumentRequest,
  ): Promise<{ chunks_count: number; status: string }> {
    try {
      const res = await aiClient.post("/rag/ingest", data);
      return res.data;
    } catch (err: any) {
      throw new Error(`AI ingestion failed: ${err.message}`);
    }
  }

  static async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      await aiClient.delete(`/rag/documents/${encodeURIComponent(documentId)}`, {
        data: { user_id: userId },
      });
    } catch (err: any) {
      throw new Error(`AI vector deletion failed: ${err.message}`);
    }
  }

  static async getDocumentChunks(documentId: string, userId: string): Promise<{ chunks: any[] }> {
    try {
      const res = await aiClient.get(`/rag/documents/${encodeURIComponent(documentId)}/chunks`, {
        params: { user_id: userId },
      });
      return res.data;
    } catch (err: any) {
      throw new Error(`AI chunk inspection failed: ${err.message}`);
    }
  }

  static async queryPipeline(payload: QueryRAGRequest): Promise<{
    synthesis: string;
    confidence_score: number;
    consensus: {
      status: "reached" | "partial" | "failed";
      consensus_score: number;
      agreement_ratio: number;
      conflicts: any[];
      synthesis: string;
      evaluation_matrix?: Record<string, any>;
    };
    evaluation_matrix?: Record<string, any>;
    agent_executions: any[];
    evidence_sources: any[];
  }> {
    try {
      const res = await aiClient.post("/rag/query", payload);
      return res.data;
    } catch (err: any) {
      throw new Error(`AI service unavailable: ${err.message}`);
    }
  }
}
