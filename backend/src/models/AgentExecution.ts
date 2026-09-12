import mongoose, { Schema, Document } from "mongoose";

export interface IAgentExecutionRecord extends Document {
  message_id: mongoose.Types.ObjectId;
  agent_name: "retriever" | "fact_checker" | "critic" | "trust_assessor" | "reasoner";
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
      enum: ["retriever", "fact_checker", "critic", "trust_assessor", "reasoner"],
      required: true,
    },
    agent_role: { type: String, required: true },
    model_used: { type: String, required: true },
    claim_propositions: [{ type: String }],
    raw_output: { type: String, required: true },
    confidence: { type: Number, required: true },
    latency_ms: { type: Number, required: true },
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
