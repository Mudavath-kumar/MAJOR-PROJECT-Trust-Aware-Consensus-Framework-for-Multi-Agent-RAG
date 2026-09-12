import mongoose, { Schema, Document } from "mongoose";

export interface IFeedbackRecord extends Document {
  user_id: mongoose.Types.ObjectId;
  message_id: mongoose.Types.ObjectId;
  rating: "positive" | "negative";
  comment?: string;
  created_at: Date;
}

const FeedbackSchema = new Schema<IFeedbackRecord>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message_id: { type: Schema.Types.ObjectId, ref: "Message", required: true, index: true },
    rating: { type: String, enum: ["positive", "negative"], required: true },
    comment: { type: String },
  },
  {
    timestamps: { createdAt: "created_at" },
  },
);

export const Feedback = mongoose.model<IFeedbackRecord>("Feedback", FeedbackSchema);
export default Feedback;
