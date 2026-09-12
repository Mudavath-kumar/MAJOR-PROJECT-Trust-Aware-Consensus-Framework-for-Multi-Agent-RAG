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
