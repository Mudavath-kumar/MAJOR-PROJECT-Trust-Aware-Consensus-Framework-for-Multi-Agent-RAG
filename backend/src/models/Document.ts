import mongoose, { Schema, Document as MDocument } from "mongoose";
import { DocumentStatus } from "../types/index.js";

export interface IDocumentRecord extends MDocument {
  user_id: mongoose.Types.ObjectId;
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

const DocumentSchema = new Schema<IDocumentRecord>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    filename: { type: String, required: true },
    original_name: { type: String, required: true },
    file_size: { type: Number, required: true },
    mime_type: { type: String, required: true },
    chunks_count: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["uploaded", "chunking", "embedding", "ready", "failed"],
      default: "uploaded",
      index: true,
    },
    storage_path: { type: String, required: true },
    tags: [{ type: String, trim: true }],
    error_message: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

export const DocumentModel = mongoose.model<IDocumentRecord>("Document", DocumentSchema);
export default DocumentModel;
