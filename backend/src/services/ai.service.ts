import axios, { AxiosError } from "axios";
import { env } from "../config/environment.js";

const aiClient = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: env.AI_SERVICE_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    "X-TrustRAG-Service-Token": env.AI_SERVICE_TOKEN,
  },
});

export interface QueryRAGRequest {
  query: string;
  conversation_id: string;
  user_id: string;
  document_ids?: string[];
  settings?: Record<string, unknown>;
}
export interface IngestDocumentRequest {
  document_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  user_id: string;
  extracted_text?: string;
  file_buffer?: Buffer;
}

type HealthResponse = { status: "healthy" | "offline"; service: string };

function serviceError(operation: string, error: unknown): Error {
  const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
  const providerMessage = axiosError.response?.data?.detail || axiosError.response?.data?.message;
  return new Error(
    providerMessage
      ? `AI service ${operation} failed: ${providerMessage}`
      : `AI service ${operation} is unavailable`,
  );
}

export class AIService {
  static async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await aiClient.get<HealthResponse>("/health", { timeout: 10_000 });
      if (response.data?.status === "healthy") return response.data;
      return { status: "offline", service: "trustrag-ai-service" };
    } catch {
      return { status: "offline", service: "trustrag-ai-service" };
    }
  }

  static async ingestDocument(data: IngestDocumentRequest): Promise<{ chunks_count: number; status: string }> {
    const payload: Record<string, unknown> = {
      document_id: data.document_id,
      filename: data.filename,
      file_path: data.file_path,
      mime_type: data.mime_type,
      user_id: data.user_id,
    };
    if (data.file_buffer?.length) payload.file_content_b64 = data.file_buffer.toString("base64");

    try {
      const response = await aiClient.post<{ chunks_count?: number; status?: string }>("/rag/ingest", payload, {
        timeout: Math.max(env.AI_SERVICE_TIMEOUT_MS, 120_000),
      });
      if (!response.data || typeof response.data.chunks_count !== "number" || response.data.chunks_count < 1) {
        throw new Error("AI service returned no indexed chunks");
      }
      return { chunks_count: response.data.chunks_count, status: response.data.status || "ready" };
    } catch (error) {
      throw serviceError("document ingestion", error);
    }
  }

  static async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      await aiClient.delete(`/rag/documents/${encodeURIComponent(documentId)}`, {
        data: { user_id: userId },
        timeout: 15_000,
      });
    } catch (error) {
      throw serviceError("document deletion", error);
    }
  }

  static async getDocumentChunks(documentId: string, userId: string): Promise<{ chunks: any[] }> {
    try {
      const response = await aiClient.get<{ chunks: any[] }>(`/rag/documents/${encodeURIComponent(documentId)}/chunks`, {
        params: { user_id: userId },
        timeout: 30_000,
      });
      return { chunks: Array.isArray(response.data?.chunks) ? response.data.chunks : [] };
    } catch (error) {
      throw serviceError("chunk inspection", error);
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
      const response = await aiClient.post("/rag/query", payload, { timeout: env.AI_SERVICE_TIMEOUT_MS });
      if (!response.data || typeof response.data.synthesis !== "string") {
        throw new Error("AI service returned an invalid query response");
      }
      return response.data;
    } catch (error) {
      throw serviceError("query", error);
    }
  }
}
