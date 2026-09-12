
import { Router } from "express";
import {
  getConversations,
  createConversation,
  deleteConversation,
  getMessages,
  sendMessage,
} from "../controllers/chat.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/conversations", getConversations);
router.post("/conversations", createConversation);
router.delete("/conversations/:conversationId", deleteConversation);
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);

export default router;
