import mongoose, { Schema, Document } from "mongoose";

export type ResearchReviewDecision = "approved" | "needs_correction";

export interface IResearchBenchmarkReview extends Document {
  user_id: mongoose.Types.ObjectId;
  dataset_version: string;
  record_id: string;
  decision: ResearchReviewDecision;
  notes: string;
  created_at: Date;
  updated_at: Date;
}

const ResearchBenchmarkReviewSchema = new Schema<IResearchBenchmarkReview>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dataset_version: { type: String, required: true },
    record_id: { type: String, required: true },
    decision: { type: String, enum: ["approved", "needs_correction"], required: true },
    notes: { type: String, maxlength: 2000, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

ResearchBenchmarkReviewSchema.index(
  { user_id: 1, dataset_version: 1, record_id: 1 },
  { unique: true },
);

export const ResearchBenchmarkReview = mongoose.model<IResearchBenchmarkReview>(
  "ResearchBenchmarkReview",
  ResearchBenchmarkReviewSchema,
);
export default ResearchBenchmarkReview;
