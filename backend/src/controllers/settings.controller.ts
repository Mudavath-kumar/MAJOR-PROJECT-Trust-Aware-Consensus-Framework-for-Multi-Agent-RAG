import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Settings from "../models/Settings.js";
import { isDbConnected } from "../config/database.js";
import { encryptSecret, maskSecret } from "../utils/secret-box.js";

interface ISettingsPayload {
  gemini_api_key?: string;
  tavily_api_key?: string;
  preferred_model?: string;
  similarity_top_k?: number;
  consensus_threshold?: number;
  enable_external_search?: boolean;
}

export const getSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected() || !req.user?._id) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }
    let settings = await Settings.findOne({ user_id: req.user._id });
    if (!settings) {
      settings = await Settings.create({ user_id: req.user._id });
    }
    const { gemini_api_key, tavily_api_key, ...safeSettings } = settings.toObject();
    res.json({
      settings: {
        ...safeSettings,
        gemini_api_key_configured: Boolean(gemini_api_key),
        tavily_api_key_configured: Boolean(tavily_api_key),
        gemini_api_key: maskSecret(gemini_api_key),
        tavily_api_key: maskSecret(tavily_api_key),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch settings", message: err.message });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected() || !req.user?._id) {
      res.status(503).json({ error: "Database is unavailable" });
      return;
    }
    const updates = (req.body ?? {}) as ISettingsPayload;
    const updatePayload: Record<string, unknown> = {};
    const allowedFields: Array<keyof ISettingsPayload> = [
      "preferred_model",
      "similarity_top_k",
      "consensus_threshold",
      "enable_external_search",
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) updatePayload[field] = updates[field];
    }

    if (typeof updates.gemini_api_key === "string" && !updates.gemini_api_key.startsWith("••••")) {
      updatePayload.gemini_api_key = encryptSecret(updates.gemini_api_key.trim());
    }
    if (typeof updates.tavily_api_key === "string" && !updates.tavily_api_key.startsWith("••••")) {
      updatePayload.tavily_api_key = encryptSecret(updates.tavily_api_key.trim());
    }

    if (typeof updatePayload.similarity_top_k === "number") {
      updatePayload.similarity_top_k = Math.max(1, Math.min(20, Math.round(updatePayload.similarity_top_k)));
    }
    if (typeof updatePayload.consensus_threshold === "number") {
      updatePayload.consensus_threshold = Math.max(0, Math.min(100, updatePayload.consensus_threshold));
    }
    const settings = await Settings.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: updatePayload },
      { new: true, upsert: true },
    );
    const saved = settings.toObject();
    res.json({
      message: "Settings saved successfully",
      settings: {
        ...saved,
        gemini_api_key: maskSecret(saved.gemini_api_key),
        tavily_api_key: maskSecret(saved.tavily_api_key),
        gemini_api_key_configured: Boolean(saved.gemini_api_key),
        tavily_api_key_configured: Boolean(saved.tavily_api_key),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update settings", message: err.message });
  }
};
