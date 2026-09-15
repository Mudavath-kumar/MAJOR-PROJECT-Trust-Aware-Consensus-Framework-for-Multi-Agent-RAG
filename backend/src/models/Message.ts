import mongoose, { Schema, Document } from "mongoose";

const EvidenceSourceSchema = new Schema(
  {
    document_id: { type: String, default: "doc-unknown" },
    document_name: { type: String, default: "Document" },
    chunk_id: { type: String, default: "chunk-0" },
    text: { type: String, default: "" },
    similarity_score: { type: Number, default: 0.85 },
    rerank_score: { type: Number },
    page_number: { type: Number },
  },
  { _id: false },
);

export interface IMessageRecord extends Document {
  conversation_id: mongoose.Types.ObjectId;
  sender: "user" | "assistant";
  content: string;
  confidence_score?: number;
  status: "processing" | "done" | "failed";
  evidence_sources?: any[];
  created_at: Date;
  updated_at: Date;
}

const MessageSchema = new Schema<IMessageRecord>(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    confidence_score: { type: Number, min: 0, max: 100 },
    status: { type: String, enum: ["processing", "done", "failed"], default: "done" },
    evidence_sources: [EvidenceSourceSchema],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

export const Message = mongoose.model<IMessageRecord>("Message", MessageSchema);
export default Message;
