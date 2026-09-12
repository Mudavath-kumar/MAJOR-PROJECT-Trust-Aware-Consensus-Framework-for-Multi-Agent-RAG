import mongoose, { Schema, Document } from "mongoose";

export interface IConversationRecord extends Document {
  user_id: mongoose.Types.ObjectId;
  title: string;
  created_at: Date;
  updated_at: Date;
}

const ConversationSchema = new Schema<IConversationRecord>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, default: "New Conversation" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

export const Conversation = mongoose.model<IConversationRecord>("Conversation", ConversationSchema);
export default Conversation;
