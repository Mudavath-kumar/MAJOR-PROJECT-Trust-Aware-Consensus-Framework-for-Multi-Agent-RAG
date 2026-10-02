import mongoose, { Schema, Document } from "mongoose";

export interface IConsensusResultRecord extends Document {
  message_id: mongoose.Types.ObjectId;
  status: "reached" | "partial" | "failed";
  decision_status?: "answer" | "partial" | "abstain";
  decision_score?: number;
  abstention_reason?: string | null;
  score_components?: {
    retrieval_quality?: number;
    claim_support?: number;
    citation_coverage?: number;
    critic_safety?: number;
  };
  consensus_score: number;
  agreement_ratio: number;
  conflicts: any[];
  synthesis: string;
  evaluation_matrix?: {
    faithfulness?: number;
    context_precision?: number;
    answer_relevance?: number;
    consensus_alignment?: number;
    hallucination_risk?: "low" | "medium" | "high";
    composite_confidence?: number;
  };
  created_at: Date;
}

const ConsensusResultSchema = new Schema<IConsensusResultRecord>(
  {
    message_id: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      unique: true,
      index: true,
    },
    status: { type: String, default: "failed" },
    decision_status: { type: String, enum: ["answer", "partial", "abstain"] },
    decision_score: { type: Number, min: 0, max: 1 },
    abstention_reason: { type: String, default: null },
    score_components: { type: Schema.Types.Mixed },
    consensus_score: { type: Number, default: 0 },
    agreement_ratio: { type: Number, default: 0 },
    conflicts: [{ type: Schema.Types.Mixed }],
    synthesis: { type: String, default: "" },
    evaluation_matrix: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: "created_at" },
  },
);

export const ConsensusResult = mongoose.model<IConsensusResultRecord>(
  "ConsensusResult",
  ConsensusResultSchema,
);
export default ConsensusResult;
