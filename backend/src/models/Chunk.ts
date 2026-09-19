import mongoose, { Schema, Document as MDocument } from "mongoose";

export interface IChunkRecord extends MDocument {
  document_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  chunk_index: number;
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
  created_at: Date;
}

const ChunkSchema = new Schema<IChunkRecord>(
  {
    document_id: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    chunk_index: { type: Number, required: true },
    text: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    embedding: { type: [Number], default: undefined },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  },
);

ChunkSchema.index({ document_id: 1, chunk_index: 1 });
ChunkSchema.index({ text: "text" });
// Note: MongoDB Atlas Vector Search index on `embedding` field must be created
// via Atlas UI or Atlas CLI with:
// { "fields": [{ "type": "vector", "path": "embedding", "numDimensions": 384, "similarity": "cosine" }] }
// Index name: embedding_index

export const ChunkModel = mongoose.model<IChunkRecord>("Chunk", ChunkSchema);
export default ChunkModel;
