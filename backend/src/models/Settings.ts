import mongoose, { Schema, Document } from "mongoose";

export interface ISettingsRecord extends Document {
  user_id: mongoose.Types.ObjectId;
  gemini_api_key?: string;       // renamed from groq_api_key
  tavily_api_key?: string;
  hf_token?: string;
  ollama_endpoint?: string;
  preferred_model: string;
  similarity_top_k: number;
  rerank_top_k?: number;
  consensus_threshold: number;
  min_confidence_score?: number;
  enable_external_search: boolean;
  enable_critic_agent?: boolean;
  updated_at: Date;
}

const SettingsSchema = new Schema<ISettingsRecord>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    gemini_api_key:         { type: String },
    tavily_api_key:         { type: String },
    hf_token:               { type: String },
    ollama_endpoint:        { type: String, default: "http://localhost:11434" },
    preferred_model:        { type: String, default: "gemini-1.5-flash" },
    similarity_top_k:       { type: Number, default: 5 },
    rerank_top_k:           { type: Number, default: 3 },
    consensus_threshold:    { type: Number, default: 80 },
    min_confidence_score:   { type: Number, default: 70 },
    enable_external_search: { type: Boolean, default: true },
    enable_critic_agent:    { type: Boolean, default: true },
  },
  {
    timestamps: { updatedAt: "updated_at" },
  },
);

export const Settings = mongoose.model<ISettingsRecord>("Settings", SettingsSchema);
export default Settings;
