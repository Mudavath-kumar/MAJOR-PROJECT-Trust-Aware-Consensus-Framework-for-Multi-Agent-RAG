import mongoose, { Schema, Document } from "mongoose";

export interface IConsensusResultRecord extends Document {
  message_id: mongoose.Types.ObjectId;
  status: "reached" | "partial" | "failed";
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
    status: { type: String, enum: ["reached", "partial", "failed"], required: true },
    consensus_score: { type: Number, required: true },
    agreement_ratio: { type: Number, required: true },
    conflicts: [{ type: Schema.Types.Mixed }],
    synthesis: { type: String, required: true },
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
