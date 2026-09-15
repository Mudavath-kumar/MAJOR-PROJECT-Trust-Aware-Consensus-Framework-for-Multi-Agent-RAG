import mongoose, { Schema, Document } from "mongoose";

export interface IAgentExecutionRecord extends Document {
  message_id: mongoose.Types.ObjectId;
  agent_name: string;
  agent_role: string;
  model_used: string;
  claim_propositions: string[];
  raw_output: string;
  confidence: number;
  latency_ms: number;
  sources_cited: any[];
  created_at: Date;
}

const AgentExecutionSchema = new Schema<IAgentExecutionRecord>(
  {
    message_id: { type: Schema.Types.ObjectId, ref: "Message", required: true, index: true },
    agent_name: {
      type: String,
      default: "retriever",
      required: true,
    },
    agent_role: { type: String, default: "Consensus Agent" },
    model_used: { type: String, default: "gemini-1.5-flash" },
    claim_propositions: [{ type: String }],
    raw_output: { type: String, default: "" },
    confidence: { type: Number, default: 0.94 },
    latency_ms: { type: Number, default: 200 },
    sources_cited: [{ type: Schema.Types.Mixed }],
  },
  {
    timestamps: { createdAt: "created_at" },
  },
);

export const AgentExecution = mongoose.model<IAgentExecutionRecord>(
  "AgentExecution",
  AgentExecutionSchema,
);
export default AgentExecution;
