// ============================================
// TrustRAG Shared Backend TypeScript Types
// ============================================

export type UserRole = "user" | "admin";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export type DocumentStatus = "uploaded" | "chunking" | "embedding" | "ready" | "failed";

export interface IDocument {
  _id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  chunks_count: number;
  status: DocumentStatus;
  storage_path: string;
  tags: string[];
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IConversation {
  _id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface IEvidenceSource {
  document_id: string;
  document_name: string;
  chunk_id: string;
  text: string;
  similarity_score: number;
  rerank_score?: number;
  page_number?: number;
}

export interface IConflictResolution {
  claim: string;
  agreeing_agents: string[];
  dissenting_agents: string[];
  resolution: string;
  confidence_penalty: number;
}

export interface IConsensusResult {
  _id?: string;
  message_id: string;
  status: "reached" | "partial" | "failed";
  consensus_score: number; // 0 - 100
  agreement_ratio: number; // 0.0 - 1.0
  conflicts: IConflictResolution[];
  synthesis: string;
  created_at?: Date;
}

export interface IAgentExecution {
  _id?: string;
  message_id: string;
  agent_name: "retriever" | "fact_checker" | "critic" | "trust_assessor" | "reasoner";
  agent_role: string;
  model_used: string;
  claim_propositions: string[];
  raw_output: string;
  confidence: number; // 0.0 - 1.0
  latency_ms: number;
  sources_cited: IEvidenceSource[];
  created_at?: Date;
}

export interface IMessage {
  _id: string;
  conversation_id: string;
  sender: "user" | "assistant";
  content: string;
  consensus?: IConsensusResult;
  agent_executions?: IAgentExecution[];
  evidence_sources?: IEvidenceSource[];
  confidence_score?: number;
  status?: "processing" | "done" | "failed";
  created_at: Date;
}

export interface ISettings {
  _id?: string;
  user_id: string;
  gemini_api_key?: string;
  tavily_api_key?: string;
  hf_token?: string;
  ollama_endpoint?: string;
  preferred_model: string;
  similarity_top_k: number;
  rerank_top_k: number;
  consensus_threshold: number;
  min_confidence_score: number;
  enable_external_search: boolean;
  enable_critic_agent: boolean;
  updated_at: Date;
}

export interface IFeedback {
  _id: string;
  user_id: string;
  message_id: string;
  rating: "positive" | "negative";
  comment?: string;
  created_at: Date;
}
