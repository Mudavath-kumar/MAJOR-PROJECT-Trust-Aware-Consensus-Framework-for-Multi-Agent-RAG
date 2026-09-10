import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Settings from "../models/Settings.js";
import { isDbConnected } from "../config/database.js";

interface ISettingsPayload {
  gemini_api_key?: string;
  tavily_api_key?: string;
  ollama_endpoint?: string;
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
    const obj = settings.toObject();
    res.json({
      settings: {
        ...obj,
        gemini_api_key_configured: !!settings.gemini_api_key,
        tavily_api_key_configured:  !!settings.tavily_api_key,
        gemini_api_key: settings.gemini_api_key ? "••••••••" + settings.gemini_api_key.slice(-4) : "",
        tavily_api_key: settings.tavily_api_key  ? "••••••••" + settings.tavily_api_key.slice(-4)  : "",
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
    const updates = req.body as ISettingsPayload;
    const updatePayload: Record<string, unknown> = { ...updates };
    // Don't overwrite with masked values
    if (typeof updatePayload.gemini_api_key === "string" && (updatePayload.gemini_api_key as string).startsWith("••••")) {
      delete updatePayload.gemini_api_key;
    }
    if (typeof updatePayload.tavily_api_key === "string" && (updatePayload.tavily_api_key as string).startsWith("••••")) {
      delete updatePayload.tavily_api_key;
    }
    const settings = await Settings.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: updatePayload },
      { new: true, upsert: true },
    );
    res.json({ message: "Settings saved successfully", settings });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update settings", message: err.message });
  }
};
