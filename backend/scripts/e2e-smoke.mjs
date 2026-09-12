import mongoose from "mongoose";
import { env } from "../dist/config/environment.js";
import { User } from "../dist/models/User.js";
import { Settings } from "../dist/models/Settings.js";
import { DocumentModel } from "../dist/models/Document.js";
import { Conversation } from "../dist/models/Conversation.js";
import { Message } from "../dist/models/Message.js";
import { ConsensusResult } from "../dist/models/ConsensusResult.js";
import { AgentExecution } from "../dist/models/AgentExecution.js";

const baseUrl = "http://127.0.0.1:3001/api/v1";
const email = `trustrag-e2e-${Date.now()}@example.invalid`;
const password = "e2e-test-password-123";
let token = "";
let userId = "";
let documentId = "";
let conversationId = "";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status}: ${body.message ?? body.error ?? "request failed"}`);
  }
  return body;
}

try {
  const registered = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "TrustRAG E2E Test", email, password }),
  });
  token = registered.token;
  userId = String(registered.user._id);

  const source = [
    "TrustRAG end-to-end verification source.",
    "The verification document states that the release checklist requires an evidence-backed answer.",
    "The exact checklist owner is the platform engineering team.",
  ].join(" ");
  const form = new FormData();
  form.append("file", new Blob([source], { type: "text/plain" }), "e2e-verification.txt");
  const uploaded = await request("/documents/upload", { method: "POST", body: form });
  documentId = String(uploaded.document._id);
  if (uploaded.document.status !== "ready" || Number(uploaded.document.chunks_count) < 1) {
    throw new Error("upload did not finish indexing");
  }

  const conversation = await request("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ title: "E2E verification" }),
  });
  conversationId = String(conversation.conversation._id);
  const answered = await request(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: "Who owns the release checklist according to the verification document?",
      document_ids: [documentId],
    }),
  });
  const assistant = answered.assistant_message;
  const evidenceCount = Array.isArray(assistant.evidence_sources)
    ? assistant.evidence_sources.length
    : 0;
  if (!assistant.content || evidenceCount < 1) {
    throw new Error("chat completed without an evidence source");
  }

  const chunks = await request(`/documents/${documentId}/chunks`);
  if (!Array.isArray(chunks.chunks) || chunks.chunks.length < 1) {
    throw new Error("indexed chunks could not be inspected");
  }

  console.log(JSON.stringify({
    upload: "ready",
    chunks: Number(uploaded.document.chunks_count),
    query: "answered",
    evidence: evidenceCount,
    consensus: assistant.consensus?.status ?? "unknown",
  }));
} finally {
  if (token && documentId) {
    await fetch(`${baseUrl}/documents/${documentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  if (userId) {
    await mongoose.connect(env.MONGODB_URI);
    const testUsers = await User.find({ email: /^trustrag-e2e-\d+@example\.invalid$/ }).select("_id");
    for (const user of testUsers) {
      const conversations = await Conversation.find({ user_id: user._id }).select("_id");
      const conversationIds = conversations.map((conversation) => conversation._id);
      const messages = await Message.find({ conversation_id: { $in: conversationIds } }).select("_id");
      const messageIds = messages.map((message) => message._id);
      await Promise.all([
        AgentExecution.deleteMany({ message_id: { $in: messageIds } }),
        ConsensusResult.deleteMany({ message_id: { $in: messageIds } }),
        Message.deleteMany({ conversation_id: { $in: conversationIds } }),
        Conversation.deleteMany({ user_id: user._id }),
        DocumentModel.deleteMany({ user_id: user._id }),
        Settings.deleteMany({ user_id: user._id }),
        User.deleteOne({ _id: user._id }),
      ]);
    }
    await mongoose.disconnect();
  }
}
