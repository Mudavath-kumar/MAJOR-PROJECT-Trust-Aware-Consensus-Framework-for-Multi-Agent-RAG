import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/environment.js";
import { maintainDBConnection } from "./config/database.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { isDbConnected } from "./config/database.js";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import evidenceRoutes from "./routes/evidence.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import { AIService } from "./services/ai.service.js";

const app = express();

// Security and CORS
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Always allow .vercel.app deployments (our frontend host)
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/$/, "");

      if (normalized.includes("vercel.app")) {
        return callback(null, true);
      }

      // Allow localhost for development
      if (
        normalized.startsWith("http://localhost:") ||
        normalized.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }

      // Allow any explicitly configured FRONTEND_URL(s)
      if (env.FRONTEND_URL) {
        const allowed = env.FRONTEND_URL.split(",").map((u) => u.trim().replace(/\/$/, ""));
        if (allowed.includes(normalized)) {
          return callback(null, true);
        }
      }

      return callback(new Error(`CORS policy: Origin '${origin}' is not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-email", "x-user-name"],
  }),
);


app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(globalLimiter);

// Root welcome endpoint
app.get("/", (req, res) => {
  res.json({
    name: "TrustRAG API Server",
    status: "online",
    health: "/api/v1/health",
    version: "1.0.0",
    docs: "https://github.com/Mudavath-kumar/MAJOR-PROJECT-Trust-Aware-Consensus-Framework-for-Multi-Agent-RAG",
  });
});

// Health check endpoint
app.get("/api/v1/health", async (req, res) => {
  const aiHealth = await AIService.checkHealth();
  const ready = isDbConnected() && aiHealth.status === "healthy";
  res.json({
    status: ready ? "healthy" : "degraded",
    backend: "online",
    database: isDbConnected() ? "connected" : "offline",
    ready,
    timestamp: new Date().toISOString(),
    ai_service: aiHealth,
  });
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/evidence", evidenceRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/settings", settingsRoutes);

// Global error handler
app.use(errorHandler);

const PORT = env.PORT || 3001;

// Start server
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`
🚀 TrustRAG Backend Server is running!
📡 URL: http://localhost:${PORT}
🔗 Health: http://localhost:${PORT}/api/v1/health
⚙️  Environment: ${env.NODE_ENV}
    `);
  });
  void maintainDBConnection();
};

startServer();

export default app;
