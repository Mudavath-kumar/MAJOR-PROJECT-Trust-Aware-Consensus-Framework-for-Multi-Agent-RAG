import rateLimit from "express-rate-limit";
import { env } from "../config/environment.js";

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    message: "Rate limit exceeded. Please try again after 15 minutes.",
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 login/signup attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts",
    message: "Please try again after 15 minutes.",
  },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 12, // max 12 queries per minute per user/IP (prevents LLM quota exhaustion)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many chat queries",
    message: "You are sending queries too quickly. Please wait a few seconds before asking another question to protect service limits.",
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 15, // max 15 document uploads per 5 minutes per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Upload rate limit reached",
    message: "You have uploaded too many documents recently. Please wait a few minutes before uploading more files.",
  },
});
